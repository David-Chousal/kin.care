import { parseLlmGatewayErrorBody, parseLlmGatewayResponseError } from '../llmGatewayErrors';
import { userMessageFromLlmGatewayError } from '../llmGatewayUserMessages';

describe('parseLlmGatewayErrorBody', () => {
  it('parses 401 with session_not_verified code', () => {
    const p = parseLlmGatewayErrorBody(
      401,
      { error: 'Unauthorized', code: 'session_not_verified' },
      'fallback',
    );
    expect(p.kind).toBe('unauthorized');
    expect(p.httpStatus).toBe(401);
    expect(p.rawCode).toBe('session_not_verified');
    expect(p.message).toContain('Unauthorized');
  });

  it('parses 401 with missing_authorization code', () => {
    const p = parseLlmGatewayErrorBody(401, { error: 'Unauthorized', code: 'missing_authorization' }, 'fallback');
    expect(p.rawCode).toBe('missing_authorization');
    expect(p.kind).toBe('unauthorized');
  });

  it('parses 401 without code (legacy edge)', () => {
    const p = parseLlmGatewayErrorBody(401, { error: 'Unauthorized' }, 'fallback');
    expect(p.kind).toBe('unauthorized');
    expect(p.rawCode).toBeUndefined();
  });

  it('parses 403 subscription_required', () => {
    const p = parseLlmGatewayErrorBody(
      403,
      { error: 'Subscription required', code: 'subscription_required', required_tier: 'family' },
      'fallback',
    );
    expect(p.kind).toBe('subscription_required');
    expect(p.requiredTier).toBe('family');
  });

  it('parses 403 without subscription code as forbidden_member', () => {
    const p = parseLlmGatewayErrorBody(403, { error: 'Forbidden' }, 'fallback');
    expect(p.kind).toBe('forbidden_member');
  });

  it('parses 429 with reset_at', () => {
    const reset = '2026-01-15T12:00:00.000Z';
    const p = parseLlmGatewayErrorBody(429, { error: 'Rate limit exceeded', reset_at: reset }, 'fallback');
    expect(p.kind).toBe('rate_limited');
    expect(p.resetAt).toBe(reset);
  });

  it('parses 400', () => {
    const p = parseLlmGatewayErrorBody(400, { error: 'Missing family_id' }, 'fallback');
    expect(p.kind).toBe('bad_request');
    expect(p.message).toBe('Missing family_id');
  });

  it('parses 500', () => {
    const p = parseLlmGatewayErrorBody(500, { error: 'Tier resolution failed' }, 'fallback');
    expect(p.kind).toBe('server');
    expect(p.message).toContain('Tier resolution failed');
  });
});

describe('parseLlmGatewayResponseError', () => {
  it('reads JSON body from Response', async () => {
    const res = {
      status: 403,
      json: async () => ({ code: 'subscription_required', error: 'Need plan', required_tier: 'care_team' }),
    } as Response;
    const p = await parseLlmGatewayResponseError(res);
    expect(p.kind).toBe('subscription_required');
    expect(p.requiredTier).toBe('care_team');
  });
});

describe('userMessageFromLlmGatewayError', () => {
  it('maps subscription_required to upgrade copy', () => {
    const msg = userMessageFromLlmGatewayError({
      kind: 'subscription_required',
      message: 'x',
      httpStatus: 403,
      requiredTier: 'family',
    });
    expect(msg).toContain('Family');
    expect(msg).toContain('Upgrade');
  });

  it('maps unauthorized session_not_verified without session-expired wording', () => {
    const msg = userMessageFromLlmGatewayError({
      kind: 'unauthorized',
      message: 'Unauthorized',
      httpStatus: 401,
      rawCode: 'session_not_verified',
    });
    expect(msg).toContain('verify');
    expect(msg.toLowerCase()).not.toContain('expired');
  });

  it('maps unauthorized missing_authorization', () => {
    const msg = userMessageFromLlmGatewayError({
      kind: 'unauthorized',
      message: 'Unauthorized',
      httpStatus: 401,
      rawCode: 'missing_authorization',
    });
    expect(msg).toContain('Sign in');
  });

  it('maps legacy 401 without rawCode to neutral copy', () => {
    const msg = userMessageFromLlmGatewayError({
      kind: 'unauthorized',
      message: 'Unauthorized',
      httpStatus: 401,
    });
    expect(msg).toContain('verify');
    expect(msg.toLowerCase()).not.toContain('expired');
  });

  it('maps 429 with resetAt', () => {
    const reset = '2026-06-01T10:00:00.000Z';
    const msg = userMessageFromLlmGatewayError({
      kind: 'rate_limited',
      message: 'Too many requests.',
      httpStatus: 429,
      resetAt: reset,
    });
    expect(msg).toContain('Too many requests');
    expect(msg).toMatch(/try again after/i);
  });
});
