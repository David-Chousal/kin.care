import { FunctionsHttpError } from '@supabase/supabase-js';

/** When `functions.invoke` returns `error`, JSON/text body lives on the Response in `FunctionsHttpError.context`. */
export async function readFunctionsHttpErrorPayload(
  error: unknown,
): Promise<Record<string, unknown> | string | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  const res = error.context as Response;
  try {
    const resRead = res.clone();
    const ct = resRead.headers.get('Content-Type') ?? '';
    if (ct.includes('application/json')) {
      return (await resRead.json()) as Record<string, unknown>;
    }
    return await resRead.text();
  } catch {
    return null;
  }
}

/** Short text for user-facing delete-account failure (server JSON or plain body). */
export function deleteAccountFailureUserHint(
  payload: Record<string, unknown> | string | null,
): string | null {
  if (payload == null) return null;
  if (typeof payload === 'string') {
    const t = payload.trim();
    return t.length > 0 ? t.slice(0, 400) : null;
  }
  const err = payload.error;
  if (typeof err === 'string' && err.trim()) return err.trim().slice(0, 400);
  const msg = payload.message;
  if (typeof msg === 'string' && msg.trim()) return msg.trim().slice(0, 400);
  return null;
}

export async function buildDeleteAccountFailureHint(err: unknown): Promise<string | undefined> {
  if (err instanceof FunctionsHttpError) {
    const p = await readFunctionsHttpErrorPayload(err);
    return deleteAccountFailureUserHint(p) ?? undefined;
  }
  if (err instanceof Error) {
    const m = err.message?.trim();
    return m && m.length > 0 ? m.slice(0, 400) : undefined;
  }
  return undefined;
}
