/**
 * rc-webhook — RevenueCat → Supabase subscription cache
 *
 * Configure in RevenueCat dashboard → Project → Integrations → Webhooks.
 * Set the URL to: https://<project-ref>.supabase.co/functions/v1/rc-webhook
 * Set Authorization header to the same value as Edge secret REVENUECAT_WEBHOOK_AUTHORIZATION
 * (exact match, or Bearer <token> if you store only the token in that secret).
 *
 * app_user_id in RevenueCat must be a Supabase auth UUID — we skip updates for non-UUID ids.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Json = Record<string, unknown>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

/** True if RevenueCat dashboard Authorization matches this request. */
function authorizeRequest(req: Request): boolean {
  const configured = Deno.env.get('REVENUECAT_WEBHOOK_AUTHORIZATION')?.trim();
  if (!configured) return false;
  const header = (req.headers.get('Authorization') ?? '').trim();
  if (!header) return false;
  if (header === configured) return true;
  const bearer = parseBearerToken(header);
  if (bearer && bearer === configured) return true;
  if (header === `Bearer ${configured}`) return true;
  return false;
}

function extractEvent(body: unknown): Json | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Json;
  const ev = o.event;
  if (ev && typeof ev === 'object') return ev as Json;
  if (typeof o.type === 'string' && typeof o.id === 'string') return o;
  return null;
}

function parseUuid(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
  ) {
    return s.toLowerCase();
  }
  return null;
}

function mapStoreToPlatform(store: unknown): 'ios' | 'android' | 'stripe' | 'promotional' | null {
  const s = typeof store === 'string' ? store.toUpperCase() : '';
  if (s === 'APP_STORE' || s === 'MAC_APP_STORE') return 'ios';
  if (s === 'PLAY_STORE') return 'android';
  if (s === 'PROMOTIONAL') return 'promotional';
  if (s === 'STRIPE' || s === 'RC_BILLING') return 'stripe';
  if (s === 'TEST_STORE' || s === 'AMAZON' || s === 'PADDLE' || s === 'ROKU') return null;
  return null;
}

function tierFromEntitlements(ids: unknown): 'family' | 'care_team' | null {
  if (!Array.isArray(ids)) return null;
  const careList = (Deno.env.get('RC_ENTITLEMENT_CARE_TEAM') ?? 'care_team')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const famList = (Deno.env.get('RC_ENTITLEMENT_FAMILY') ?? 'family')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const lowered = ids.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  for (const id of lowered) {
    if (careList.includes(id)) return 'care_team';
  }
  for (const id of lowered) {
    if (famList.includes(id)) return 'family';
  }
  return null;
}

function msToIso(ms: unknown): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

const EVENTS_NO_SUBSCRIPTION_ROW = new Set([
  'TEST',
  'EXPERIMENT_ENROLLMENT',
  'VIRTUAL_CURRENCY_TRANSACTION',
  'INVOICE_ISSUANCE',
  'TRANSFER',
]);

async function recordWebhookEvent(params: {
  admin: ReturnType<typeof createClient>;
  eventId: string;
  userId: string | null;
  eventType: string;
  receivedAt: string;
}): Promise<'ok' | 'duplicate' | 'error'> {
  const { error } = await params.admin.from('rc_webhook_events').insert({
    rc_event_id: params.eventId,
    user_id: params.userId,
    event_type: params.eventType,
    received_at: params.receivedAt,
  });
  if (error?.code === '23505') return 'duplicate';
  if (error) {
    console.error('rc-webhook insert event', error);
    return 'error';
  }
  return 'ok';
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server misconfiguration' }, 500);
  }

  if (!authorizeRequest(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const event = extractEvent(body);
  if (!event) {
    return jsonResponse({ error: 'Missing event' }, 400);
  }

  const eventId = typeof event.id === 'string' ? event.id.trim() : '';
  const eventType = typeof event.type === 'string' ? event.type.trim() : '';
  if (!eventId || !eventType) {
    return jsonResponse({ error: 'Missing event id or type' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const appUserId = parseUuid(event.app_user_id);
  if (!appUserId && !EVENTS_NO_SUBSCRIPTION_ROW.has(eventType)) {
    // Non-UUID app_user_id (e.g. anonymous RC id) — acknowledge without FK writes
    console.warn(`rc-webhook: skip non-uuid app_user_id for ${eventType}`, event.app_user_id);
    return jsonResponse({ ok: true, skipped: 'non_uuid_app_user_id' }, 200);
  }

  const { data: existing, error: selErr } = await admin
    .from('rc_webhook_events')
    .select('rc_event_id')
    .eq('rc_event_id', eventId)
    .maybeSingle();
  if (selErr) {
    console.error('rc-webhook dedup select', selErr);
    return jsonResponse({ error: 'Dedup failed' }, 500);
  }
  if (existing?.rc_event_id) {
    return jsonResponse({ ok: true, duplicate: true }, 200);
  }

  const nowIso = new Date().toISOString();

  if (EVENTS_NO_SUBSCRIPTION_ROW.has(eventType)) {
    const rec = await recordWebhookEvent({
      admin,
      eventId,
      userId: appUserId,
      eventType,
      receivedAt: nowIso,
    });
    if (rec === 'duplicate') return jsonResponse({ ok: true, duplicate: true }, 200);
    if (rec === 'error') return jsonResponse({ error: 'Persist failed' }, 500);
    return jsonResponse({ ok: true, processed: eventType }, 200);
  }

  if (!appUserId) {
    const rec = await recordWebhookEvent({
      admin,
      eventId,
      userId: null,
      eventType,
      receivedAt: nowIso,
    });
    if (rec === 'duplicate') return jsonResponse({ ok: true, duplicate: true }, 200);
    if (rec === 'error') return jsonResponse({ error: 'Persist failed' }, 500);
    return jsonResponse({ ok: true, processed: eventType }, 200);
  }

  const store = event.store;
  const platform = mapStoreToPlatform(store);
  if (!platform) {
    console.warn(`rc-webhook: unsupported store "${String(store)}" for ${eventType}`);
    const rec = await recordWebhookEvent({
      admin,
      eventId,
      userId: appUserId,
      eventType,
      receivedAt: nowIso,
    });
    if (rec === 'duplicate') return jsonResponse({ ok: true, duplicate: true }, 200);
    if (rec === 'error') return jsonResponse({ error: 'Persist failed' }, 500);
    return jsonResponse({ ok: true, skipped: 'unsupported_store' }, 200);
  }

  const entitlementIds = event.entitlement_ids;
  const tier = tierFromEntitlements(entitlementIds);
  const expirationIso = msToIso(event.expiration_at_ms);
  const nowMs = Date.now();
  const expirationMs = typeof event.expiration_at_ms === 'number' ? event.expiration_at_ms : null;
  const notExpired = expirationMs == null || expirationMs > nowMs;

  const productId = typeof event.product_id === 'string' ? event.product_id : null;
  const rcAppUserId = typeof event.app_user_id === 'string' ? event.app_user_id : null;

  const deactivateTypes = new Set(['EXPIRATION']);
  const cancelTypes = new Set(['CANCELLATION']);

  let isActive = notExpired;
  let willRenew = true;

  if (deactivateTypes.has(eventType)) {
    isActive = false;
    willRenew = false;
  } else if (cancelTypes.has(eventType)) {
    willRenew = false;
    isActive = notExpired;
  }

  const activateTypes = new Set([
    'INITIAL_PURCHASE',
    'RENEWAL',
    'UNCANCELLATION',
    'PRODUCT_CHANGE',
    'SUBSCRIPTION_EXTENDED',
    'NON_RENEWING_PURCHASE',
    'TEMPORARY_ENTITLEMENT_GRANT',
    'BILLING_ISSUE',
  ]);

  if (activateTypes.has(eventType)) {
    if (!tier) {
      console.warn(`rc-webhook: no mapped tier for entitlements`, entitlementIds, eventType);
      const rec = await recordWebhookEvent({
        admin,
        eventId,
        userId: appUserId,
        eventType,
        receivedAt: nowIso,
      });
      if (rec === 'duplicate') return jsonResponse({ ok: true, duplicate: true }, 200);
      if (rec === 'error') return jsonResponse({ error: 'Persist failed' }, 500);
      return jsonResponse({ ok: true, skipped: 'no_tier_mapping' }, 200);
    }
    isActive = notExpired;
    if (eventType === 'BILLING_ISSUE') {
      isActive = notExpired;
    }
  } else if (!deactivateTypes.has(eventType) && !cancelTypes.has(eventType)) {
    // Unknown / future event types — do not fail delivery
    console.warn(`rc-webhook: unhandled event type ${eventType}`);
    const rec = await recordWebhookEvent({
      admin,
      eventId,
      userId: appUserId,
      eventType,
      receivedAt: nowIso,
    });
    if (rec === 'duplicate') return jsonResponse({ ok: true, duplicate: true }, 200);
    if (rec === 'error') return jsonResponse({ error: 'Persist failed' }, 500);
    return jsonResponse({ ok: true, skipped: 'unhandled_type' }, 200);
  }

  if (deactivateTypes.has(eventType) || cancelTypes.has(eventType)) {
    const { error: updErr } = await admin
      .from('rc_subscriptions')
      .update({
        is_active: isActive,
        will_renew: willRenew,
        expires_at: expirationIso,
        rc_event_id: eventId,
        raw_event: event as Json,
        synced_at: nowIso,
        rc_app_user_id: rcAppUserId,
      })
      .eq('user_id', appUserId)
      .eq('platform', platform);
    if (updErr) {
      console.error('rc-webhook update', updErr);
      return jsonResponse({ error: 'Subscription update failed' }, 500);
    }
    const rec = await recordWebhookEvent({
      admin,
      eventId,
      userId: appUserId,
      eventType,
      receivedAt: nowIso,
    });
    if (rec === 'duplicate') return jsonResponse({ ok: true, duplicate: true }, 200);
    if (rec === 'error') return jsonResponse({ error: 'Persist failed' }, 500);
    return jsonResponse({ ok: true, processed: eventType }, 200);
  }

  if (!tier) {
    const rec = await recordWebhookEvent({
      admin,
      eventId,
      userId: appUserId,
      eventType,
      receivedAt: nowIso,
    });
    if (rec === 'duplicate') return jsonResponse({ ok: true, duplicate: true }, 200);
    if (rec === 'error') return jsonResponse({ error: 'Persist failed' }, 500);
    return jsonResponse({ ok: true, skipped: 'no_tier' }, 200);
  }

  const row = {
    user_id: appUserId,
    platform,
    tier,
    product_id: productId,
    is_active: isActive,
    expires_at: expirationIso,
    will_renew: willRenew,
    rc_app_user_id: rcAppUserId,
    rc_event_id: eventId,
    raw_event: event as Json,
    synced_at: nowIso,
  };

  const { error: upErr } = await admin.from('rc_subscriptions').upsert(row, {
    onConflict: 'user_id,platform',
  });
  if (upErr) {
    console.error('rc-webhook upsert', upErr);
    return jsonResponse({ error: 'Subscription upsert failed' }, 500);
  }

  const rec = await recordWebhookEvent({
    admin,
    eventId,
    userId: appUserId,
    eventType,
    receivedAt: nowIso,
  });
  if (rec === 'duplicate') return jsonResponse({ ok: true, duplicate: true }, 200);
  if (rec === 'error') return jsonResponse({ error: 'Persist failed' }, 500);

  return jsonResponse({ ok: true, processed: eventType }, 200);
});
