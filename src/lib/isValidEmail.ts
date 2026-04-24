/**
 * Lightweight email shape validation.
 *
 * Intentionally not RFC-fully-compliant; it's meant to block obvious malformed
 * inputs (missing "@", missing domain dot, spaces, etc.) while avoiding false
 * negatives for common real-world addresses.
 */
export function isValidEmailShape(input: string): boolean {
  const email = input.trim();
  if (!email) return false;
  if (email.length > 254) return false;
  if (/\s/.test(email)) return false;

  // Basic "local@domain.tld" shape. Requires at least one dot in domain.
  // Rejects consecutive dots in domain and empty labels.
  const basic = /^[^@]+@[^@]+\.[^@]+$/;
  if (!basic.test(email)) return false;

  const at = email.indexOf('@');
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (!local || !domain) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  if (domain.includes('..')) return false;

  return true;
}

