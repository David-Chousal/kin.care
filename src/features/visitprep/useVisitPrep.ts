import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Groq from 'groq-sdk';
import { supabase } from '../../lib/supabase';
import { useFamilyStore } from '../../store/family';
import { useAuthStore } from '../../store/auth';
import type { Medication, HealthLog, VisitPrepSummary } from '../../types';
import { errorMessageFromUnknown } from '../../lib/errorMessage';
import { formatHealthTrendSummaryForPrompt } from '../health/healthVitalSignals';

const client = new Groq({
  apiKey: process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '',
  dangerouslyAllowBrowser: true,
});

function buildPrompt(
  medications: Medication[],
  healthLogs: HealthLog[],
  careRecipientName: string
): string {
  const medList = medications.length > 0
    ? medications
        .map((m) => `- ${m.name} ${m.dosage}, ${m.frequency}${m.notes ? ` (${m.notes})` : ''}`)
        .join('\n')
    : 'None recorded';

  const logsByCategory = healthLogs.reduce<Record<string, HealthLog[]>>((acc, log) => {
    if (!acc[log.category]) acc[log.category] = [];
    acc[log.category].push(log);
    return acc;
  }, {});

  const logSections = Object.entries(logsByCategory)
    .map(([cat, logs]) => {
      const entries = logs
        .slice(0, 10)
        .map((l) => {
          const date = new Date(l.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const val = l.value ? ` — ${l.value}${l.unit ? ` ${l.unit}` : ''}` : '';
          const photo = l.photo_path ? ' [photo attached]' : '';
          return `  • ${date}: ${l.title}${val}${l.notes ? ` (${l.notes})` : ''}${photo}`;
        })
        .join('\n');
      return `${cat.toUpperCase()}:\n${entries}`;
    })
    .join('\n\n');

  const trendLines = formatHealthTrendSummaryForPrompt(healthLogs);

  return `You are a helpful family caregiver assistant. Prepare a concise doctor visit summary for a care recipient.

CURRENT MEDICATIONS:
${medList}

VITAL TRENDS (parsed from logs when available):
${trendLines || 'No structured BP/weight trend (need multiple parseable readings).'}

RECENT HEALTH LOG (last 30 days):
${logSections || 'No entries recorded'}

Please produce a visit prep summary with these sections:
1. **Key Concerns to Discuss** — top 3–5 issues based on recent health log
2. **Medication Review** — current medications, flag anything worth reviewing
3. **Questions to Ask the Doctor** — 3–5 suggested questions based on the data
4. **Trends to Watch** — any patterns in vitals or symptoms worth monitoring

Keep it concise and practical. Use plain language a family caregiver can read aloud. Do not include the care recipient's name or any identifying information in your response.`;
}

export function useVisitPrep() {
  const family = useFamilyStore((s) => s.family);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);

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
    if (!family) return;
    setIsLoading(true);
    setError(null);
    setPersistError(null);
    setSummary('');
    setGeneratedAt(null);

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [medsResult, logsResult] = await Promise.all([
        supabase
          .from('medications')
          .select('*')
          .eq('family_id', family.id)
          .eq('active', true),
        supabase
          .from('health_logs')
          .select('*')
          .eq('family_id', family.id)
          .gte('logged_at', thirtyDaysAgo)
          .order('logged_at', { ascending: false }),
      ]);

      if (medsResult.error) throw medsResult.error;
      if (logsResult.error) throw logsResult.error;

      const prompt = buildPrompt(
        medsResult.data as Medication[],
        logsResult.data as HealthLog[],
        family.care_recipient_name
      );

      const message = await client.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = message.choices[0]?.message?.content ?? '';
      setSummary(text);

      const at = new Date().toISOString();
      if (user?.id && text.trim()) {
        const ins = await supabase
          .from('visit_prep_summaries')
          .insert({
            family_id: family.id,
            content: text,
            generated_at: at,
            created_by: user.id,
          })
          .select('generated_at')
          .single();
        if (ins.error) {
          setPersistError(errorMessageFromUnknown(ins.error));
          setGeneratedAt(at);
        } else {
          setPersistError(null);
          if (ins.data?.generated_at) {
            setGeneratedAt(ins.data.generated_at);
          } else {
            setGeneratedAt(at);
          }
          void queryClient.invalidateQueries({ queryKey: ['visitPrepSummaries', family.id] });
        }
      } else {
        setGeneratedAt(at);
        if (!user?.id) {
          setPersistError('Sign in to save summaries to History.');
        } else if (!text.trim()) {
          setPersistError(null);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate summary.');
    } finally {
      setIsLoading(false);
    }
  }

  return {
    summary,
    generatedAt,
    isLoading,
    error,
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
