/** Readable message from Supabase PostgREST errors, React Query payloads, etc. */
export function errorMessageFromUnknown(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    const msg = typeof o.message === 'string' ? o.message : '';
    const details = typeof o.details === 'string' ? o.details : '';
    const hint = typeof o.hint === 'string' ? o.hint : '';
    const code = typeof o.code === 'string' ? o.code : '';
    const parts = [msg, details, hint].filter(Boolean);
    if (parts.length) return code ? `${parts.join(' — ')} (${code})` : parts.join(' — ');
  }
  if (err instanceof Error) return err.message || 'Unknown error';
  return 'Unknown error';
}
