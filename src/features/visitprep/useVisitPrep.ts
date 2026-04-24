import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SUPABASE_URL, getSupabaseAccessToken, supabase } from '../../lib/supabase';
import { useFamilyStore } from '../../store/family';
import { useAuthStore } from '../../store/auth';
import type { VisitPrepSummary } from '../../types';
import { errorMessageFromUnknown } from '../../lib/errorMessage';
import { parseLlmGatewayResponseError } from '../../subscription/llmGatewayErrors';
import { userMessageFromLlmGatewayError } from '../../subscription/llmGatewayUserMessages';

const VISIT_PREP_CLIENT_TIMEOUT_MS = 180_000;
const VISIT_PREP_STREAM_INACTIVITY_MS = 20_000;
const VISIT_PREP_TOKEN_TIMEOUT_MS = 8_000;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let id: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    id = setTimeout(() => reject(new Error('timeout')), ms);
  });
  try {
    return (await Promise.race([p, timeout])) as T;
  } finally {
    if (id) clearTimeout(id);
  }
}

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof DOMException && e.name === 'AbortError') ||
    (e instanceof Error && e.name === 'AbortError')
  );
}

/** RN Hermes often has no `crypto` global; only needs uniqueness per run for React keys. */
function newSummaryRunId(): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c && typeof c.randomUUID === 'function') {
      return c.randomUUID();
    }
  } catch {
    // Hermes / JSC may throw when touching `crypto` on globalThis
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function useVisitPrep() {
  const { t } = useTranslation();
  const family = useFamilyStore((s) => s.family);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  /** Single state so loading + debug stage cannot diverge (Strict Mode / overlapping runs). */
  const [genUi, setGenUi] = useState<{ loading: boolean; stage: string }>({ loading: false, stage: '' });
  const isLoading = genUi.loading;
  const [error, setError] = useState<string | null>(null);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  /** Stable React keys for markdown lines; new id each `generate()` so lists reconcile correctly. */
  const [summaryId, setSummaryId] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const debugStageRef = useRef('');
  const generateGenerationRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const safeSetSummary = (v: string) => {
    if (mountedRef.current) setSummary(v);
  };
  const safeSetGeneratedAt = (v: string | null) => {
    if (mountedRef.current) setGeneratedAt(v);
  };
  /** Always set `loading: true` with the stage — never spread `{ ...s, stage }` or a stale render can leave `loading: false` (no spinner). */
  const showGenProgress = (stage: string) => {
    debugStageRef.current = stage;
    setGenUi({ loading: true, stage });
  };
  const safeSetError = (v: string | null) => {
    setError(v);
  };
  const safeSetSubscriptionBlocked = (v: boolean) => {
    if (mountedRef.current) setSubscriptionBlocked(v);
  };
  const safeSetPersistError = (v: string | null) => {
    if (mountedRef.current) setPersistError(v);
  };
  const safeSetSummaryId = (v: string) => {
    if (mountedRef.current) setSummaryId(v);
  };
  const historyQuery = useQuery({
    queryKey: ['visitPrepSummaries', family?.id],
    enabled: !!family?.id,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('visit_prep_summaries')
        .select('*')
        .eq('family_id', family!.id)
        .order('generated_at', { ascending: false })
        .limit(100);
      if (qError) {
        throw new Error(errorMessageFromUnknown(qError));
      }
      return (data ?? []) as VisitPrepSummary[];
    },
  });

  async function generate() {
    const fam = useFamilyStore.getState().family;
    if (!fam) {
      if (__DEV__) console.warn('[VisitPrep] generate skipped: no family in store');
      return;
    }
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const generation = ++generateGenerationRef.current;

    // Show spinner immediately — before summary-id / clears that can throw or be skipped when unmounted.
    showGenProgress('start');

    safeSetError(null);
    safeSetSubscriptionBlocked(false);
    safeSetPersistError(null);
    safeSetSummary('');
    safeSetGeneratedAt(null);
    safeSetSummaryId(newSummaryRunId());

    let clientTimedOut = false;
    let clientInactivityTimedOut = false;
    const timeoutId = setTimeout(() => {
      clientTimedOut = true;
      controller.abort();
    }, VISIT_PREP_CLIENT_TIMEOUT_MS);
    /** Stream idle watchdog — start only once we are reading NDJSON/stream (not during auth/fetch). */
    let inactivityId: ReturnType<typeof setTimeout> | null = null;
    const bumpInactivity = () => {
      if (inactivityId) clearTimeout(inactivityId);
      inactivityId = setTimeout(() => {
        clientInactivityTimedOut = true;
        controller.abort();
      }, VISIT_PREP_STREAM_INACTIVITY_MS);
    };

    try {
      showGenProgress('auth:getSession');
      const token = await withTimeout(getSupabaseAccessToken(), VISIT_PREP_TOKEN_TIMEOUT_MS);
      if (!token) {
        throw new Error('Sign in to generate a summary.');
      }
      showGenProgress('auth:token ok');

      const url = `${SUPABASE_URL}/functions/v1/llm-gateway/visit-prep`;
      showGenProgress(`fetch:requesting ${SUPABASE_URL}`);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ family_id: fam.id }),
        signal: controller.signal,
      });

      const gw = res.headers.get('x-kin-llm-gateway') ?? res.headers.get('X-Kin-Llm-Gateway');
      showGenProgress(`fetch:headers ok${gw ? ` gateway=${gw}` : ''}`);

      if (!res.ok) {
        const parsed = await parseLlmGatewayResponseError(res);
        safeSetSubscriptionBlocked(parsed.kind === 'subscription_required');
        throw new Error(userMessageFromLlmGatewayError(parsed));
      }

      const body = res.body as unknown as ReadableStream<Uint8Array> | null;
      let full = '';
      showGenProgress('stream:begin');
      bumpInactivity();

      if (!body || typeof (body as ReadableStream<Uint8Array>).getReader !== 'function') {
        const ndjson = await res.text();
        const lines = ndjson.split('\n').map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          let evt: { type?: string; text?: string; message?: string };
          try {
            evt = JSON.parse(line) as { type?: string; text?: string; message?: string };
          } catch {
            continue;
          }
          bumpInactivity();
          if (evt.type === 'delta' && evt.text) full += evt.text;
          if (evt.type === 'done' && typeof evt.text === 'string') full = evt.text;
          if (evt.type === 'error') throw new Error(evt.message || 'LLM error');
        }
        safeSetSummary(full);
      } else {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let sawDone = false;

        try {
          while (true) {
            if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
            const { value, done } = await reader.read();
            if (done) break;
            bumpInactivity();
            buffer += decoder.decode(value, { stream: true });

            let idx: number;
            while ((idx = buffer.indexOf('\n')) !== -1) {
              if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
              const line = buffer.slice(0, idx).trim();
              buffer = buffer.slice(idx + 1);
              if (!line) continue;

              let evt: { type?: string; text?: string; message?: string };
              try {
                evt = JSON.parse(line) as { type?: string; text?: string; message?: string };
              } catch {
                continue;
              }
              bumpInactivity();
              if (evt.type === 'delta' && evt.text) {
                full += evt.text;
                safeSetSummary(full);
              } else if (evt.type === 'done') {
                if (typeof evt.text === 'string') {
                  full = evt.text;
                  safeSetSummary(full);
                }
                sawDone = true;
                break;
              } else if (evt.type === 'error') {
                throw new Error(evt.message || 'LLM error');
              }
            }
            if (sawDone) break;
          }

          // Handle a final line without trailing newline (common when server closes right after "done")
          if (!sawDone) {
            const last = buffer.trim();
            if (last) {
              try {
                const evt = JSON.parse(last) as { type?: string; text?: string; message?: string };
                if (evt.type === 'delta' && evt.text) {
                  full += evt.text;
                  safeSetSummary(full);
                } else if (evt.type === 'done') {
                  if (typeof evt.text === 'string') {
                    full = evt.text;
                    safeSetSummary(full);
                  }
                } else if (evt.type === 'error') {
                  throw new Error(evt.message || 'LLM error');
                }
              } catch {
                // ignore
              }
            }
          }
        } finally {
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
        }
      }

      const text = full.trim();
      showGenProgress(`stream:done chars=${text.length}`);

      const at = new Date().toISOString();
      if (user?.id && text.trim()) {
        const ins = await supabase
          .from('visit_prep_summaries')
          .insert({
            family_id: fam.id,
            content: text,
            generated_at: at,
            created_by: user.id,
          })
          .select('generated_at')
          .single();
        if (ins.error) {
          safeSetPersistError(errorMessageFromUnknown(ins.error));
          safeSetGeneratedAt(at);
        } else {
          safeSetPersistError(null);
          if (ins.data?.generated_at) {
            safeSetGeneratedAt(ins.data.generated_at);
          } else {
            safeSetGeneratedAt(at);
          }
          void queryClient.invalidateQueries({ queryKey: ['visitPrepSummaries', fam.id] });
        }
      } else {
        safeSetGeneratedAt(at);
        if (!user?.id) {
          safeSetPersistError('Sign in to save summaries to History.');
        } else if (!text.trim()) {
          safeSetPersistError(null);
        }
      }
    } catch (e: unknown) {
      if (isAbortError(e)) {
        if (clientTimedOut) {
          safeSetError(t('visitPrep.generationTimeout'));
        } else if (clientInactivityTimedOut) {
          safeSetError(t('visitPrep.generationStalled'));
        }
        // Other aborts (navigation, newer run): no error surface.
      } else if (e instanceof Error) {
        if (e.message === 'timeout') {
          safeSetError(t('visitPrep.authTimeout'));
        } else {
          safeSetError(e.message);
        }
      } else {
        safeSetError('Failed to generate summary.');
        safeSetSubscriptionBlocked(false);
      }
    } finally {
      clearTimeout(timeoutId);
      if (inactivityId) clearTimeout(inactivityId);
      // Only the latest generation may update UI; older runs' finally must not clobber stage/loading.
      if (generation === generateGenerationRef.current) {
        const stage = debugStageRef.current;
        const finished = stage ? `${stage} (finished)` : 'finished';
        debugStageRef.current = finished;
        setGenUi({ loading: false, stage: finished });
      }
    }
  }

  return {
    summary,
    summaryId,
    generatedAt,
    isLoading,
    error,
    subscriptionBlocked,
    persistError,
    generate,
    history: historyQuery.data ?? [],
    historyLoading: historyQuery.isPending,
    historyError: historyQuery.error,
    historyErrorMessage: historyQuery.error ? errorMessageFromUnknown(historyQuery.error) : null,
    historyIsFetching: historyQuery.isFetching,
    refetchHistory: historyQuery.refetch,
  };
}
