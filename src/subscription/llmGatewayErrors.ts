import type { EffectiveTier } from './types';

export type LlmGatewayClientErrorKind =
  | 'subscription_required'
  | 'rate_limited'
  | 'forbidden_member'
  | 'unauthorized'
  | 'bad_request'
  | 'server'
  | 'network'
  | 'unknown';

export type ParsedLlmGatewayError = {
  kind: LlmGatewayClientErrorKind;
  /** Safe user-facing line */
  message: string;
  httpStatus: number;
  requiredTier?: EffectiveTier;
  resetAt?: string;
  rawCode?: string;
};

type ErrorBody = {
  error?: string;
  code?: string;
  required_tier?: string;
  reset_at?: string;
};

export function parseLlmGatewayErrorBody(
  status: number,
  body: ErrorBody | null,
  fallbackMessage: string,
): ParsedLlmGatewayError {
  const msg = (body?.error ?? fallbackMessage).trim() || fallbackMessage;
  const code = body?.code;

  if (status === 401) {
    const rawCode = typeof code === 'string' ? code : undefined;
    return {
      kind: 'unauthorized',
      message: (msg || 'Unauthorized').trim() || 'Unauthorized',
      httpStatus: status,
      rawCode,
    };
  }
  if (status === 403) {
    if (code === 'subscription_required') {
      const rt = body?.required_tier;
      const requiredTier =
        rt === 'care_team' || rt === 'family' ? (rt as EffectiveTier) : ('family' as const);
      return {
        kind: 'subscription_required',
        message: msg,
        httpStatus: status,
        requiredTier,
        rawCode: code,
      };
    }
    return {
      kind: 'forbidden_member',
      message: msg || 'You do not have access to this family’s data.',
      httpStatus: status,
    };
  }
  if (status === 429) {
    return {
      kind: 'rate_limited',
      message: msg || 'Too many requests. Try again in a little while.',
      httpStatus: status,
      resetAt: typeof body?.reset_at === 'string' ? body.reset_at : undefined,
    };
  }
  if (status === 400) {
    return { kind: 'bad_request', message: msg, httpStatus: status };
  }
  if (status >= 500) {
    return { kind: 'server', message: msg || 'Something went wrong on our side. Try again later.', httpStatus: status };
  }
  return { kind: 'unknown', message: msg, httpStatus: status };
}

export async function parseLlmGatewayResponseError(res: Response): Promise<ParsedLlmGatewayError> {
  let body: ErrorBody | null = null;
  try {
    body = (await res.json()) as ErrorBody;
  } catch {
    body = null;
  }
  return parseLlmGatewayErrorBody(res.status, body, `Request failed (HTTP ${res.status}).`);
}

export function networkParsedError(message: string): ParsedLlmGatewayError {
  return { kind: 'network', message, httpStatus: 0 };
}

/** Normalize optional server field */
export function parseRequiredTierFromPayload(raw: unknown): EffectiveTier | undefined {
  if (raw === 'care_team' || raw === 'family') return raw;
  return undefined;
}
