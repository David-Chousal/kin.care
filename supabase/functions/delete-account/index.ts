/**
 * delete-account — Supabase Edge Function
 *
 * Option A (privacy-strong): delete the user account and all associated data.
 *
 * Behavior:
 * - For families where the user is the only remaining member: delete the family (DB cascades) and delete all family
 *   Storage objects (documents + health-log-photos).
 * - Profile pictures: delete all objects under profile-avatars/{userId}/ before removing the auth user.
 * - For families with other members: remove the user from the family and delete user-created records/content within that
 *   family (and any user-owned Storage objects referenced by those records).
 * - Finally, delete the user from auth (`auth.users`), which cascades `public.profiles` and auth-linked logs/notes.
 *
 * Idempotency / retries:
 * - Safe to call again after a partial failure: remaining `family_members` rows drive work; storage removes are
 *   best-effort idempotent; `auth.admin.deleteUser` is idempotent if the user is already gone (verify behavior in logs).
 * - Ordering minimizes orphan risk: creator handoff and content cleanup before membership removal; auth delete last.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

/** PostgREST / Supabase errors from `.error` — throw to surface in JSON 500 body. */
function throwOnError(context: string, error: { message?: string; code?: string } | null) {
  if (!error) return;
  const detail = [error.code, error.message].filter(Boolean).join(' ');
  throw new Error(`${context}: ${detail || String(error)}`);
}

async function listAllObjectPaths(
  adminClient: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await adminClient.storage.from(bucket).list(prefix, { limit, offset });
    if (error) throw error;
    const items = data ?? [];
    for (const item of items) {
      if (!item?.name) continue;
      paths.push(`${prefix}/${item.name}`);
    }
    if (items.length < limit) break;
    offset += limit;
  }

  return paths;
}

async function removePaths(adminClient: SupabaseClient, bucket: string, paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;
  const { error } = await adminClient.storage.from(bucket).remove(unique);
  if (error) throw error;
}

/** Storage must not block account deletion (orphan files are acceptable). */
async function listAllObjectPathsLoose(
  adminClient: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  try {
    return await listAllObjectPaths(adminClient, bucket, prefix);
  } catch (err) {
    console.error('[delete-account] storage list', bucket, prefix, err);
    return [];
  }
}

async function removePathsLoose(adminClient: SupabaseClient, bucket: string, paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;
  const { error } = await adminClient.storage.from(bucket).remove(unique);
  if (error) console.error('[delete-account] storage remove', bucket, error);
}

/**
 * `families.created_by` references `profiles(id)` without ON DELETE. If the leaving user is the creator and other
 * members remain, reassign `created_by` before their profile row can be removed.
 */
async function handoffFamilyCreatorIfNeeded(params: {
  adminClient: SupabaseClient;
  familyId: string;
  leavingUserId: string;
}) {
  const { adminClient, familyId, leavingUserId } = params;

  const { data: fam, error: famErr } = await adminClient
    .from('families')
    .select('created_by')
    .eq('id', familyId)
    .single();
  throwOnError('families select for handoff', famErr);
  if (!fam || String(fam.created_by) !== String(leavingUserId)) return;

  const { data: others, error: oErr } = await adminClient
    .from('family_members')
    .select('user_id, role')
    .eq('family_id', familyId)
    .neq('user_id', leavingUserId);
  throwOnError('family_members select for handoff', oErr);

  const candidates = others ?? [];
  if (candidates.length === 0) return;

  const rank = (r: string) => (r === 'admin' ? 0 : r === 'member' ? 1 : 2);
  candidates.sort((a, b) => rank(a.role) - rank(b.role));
  const successor = candidates[0]!.user_id;

  const { error: updErr } = await adminClient
    .from('families')
    .update({ created_by: successor })
    .eq('id', familyId);
  throwOnError('families created_by handoff', updErr);
}

async function deleteUserContentInFamily(params: {
  adminClient: SupabaseClient;
  userId: string;
  familyId: string;
}) {
  const { adminClient, userId, familyId } = params;

  await handoffFamilyCreatorIfNeeded({ adminClient, familyId, leavingUserId: userId });

  const u = await adminClient.from('tasks').update({ assigned_to: null }).eq('family_id', familyId).eq(
    'assigned_to',
    userId,
  );
  throwOnError('tasks unassign', u.error);

  const d1 = await adminClient.from('tasks').delete().eq('family_id', familyId).eq('created_by', userId);
  throwOnError('tasks delete by creator', d1.error);
  const d2 = await adminClient.from('calendar_events').delete().eq('family_id', familyId).eq('created_by', userId);
  throwOnError('calendar_events delete', d2.error);
  const d3 = await adminClient.from('medications').delete().eq('family_id', familyId).eq('created_by', userId);
  throwOnError('medications delete', d3.error);
  const d4 = await adminClient.from('checkins').delete().eq('family_id', familyId).eq('submitted_by', userId);
  throwOnError('checkins delete', d4.error);
  const d5 = await adminClient.from('family_doctors').delete().eq('family_id', familyId).eq('created_by', userId);
  throwOnError('family_doctors delete', d5.error);
  const d6 = await adminClient.from('visit_prep_summaries').delete().eq('family_id', familyId).eq(
    'created_by',
    userId,
  );
  throwOnError('visit_prep_summaries delete', d6.error);

  const ml = await adminClient
    .from('medication_logs')
    .update({ logged_by: null })
    .eq('family_id', familyId)
    .eq('logged_by', userId);
  throwOnError('medication_logs anonymize', ml.error);

  const { data: healthRows, error: healthSelErr } = await adminClient
    .from('health_logs')
    .select('id, photo_path')
    .eq('family_id', familyId)
    .eq('logged_by', userId);
  throwOnError('health_logs select', healthSelErr);

  const healthPhotoPaths = (healthRows ?? []).map((r) => r.photo_path).filter((p): p is string => !!p);
  await removePathsLoose(adminClient, 'health-log-photos', healthPhotoPaths);
  const hl = await adminClient.from('health_logs').delete().eq('family_id', familyId).eq('logged_by', userId);
  throwOnError('health_logs delete', hl.error);

  const { data: docRows, error: docSelErr } = await adminClient
    .from('documents')
    .select('id, file_path')
    .eq('family_id', familyId)
    .eq('uploaded_by', userId);
  throwOnError('documents select', docSelErr);

  const docPaths = (docRows ?? []).map((r) => r.file_path).filter((p): p is string => !!p);
  await removePathsLoose(adminClient, 'documents', docPaths);

  const docIds = (docRows ?? []).map((r) => r.id).filter((id): id is string => !!id);
  if (docIds.length > 0) {
    const docDel = await adminClient.from('documents').delete().in('id', docIds);
    throwOnError('documents delete', docDel.error);
  }

  const fm = await adminClient.from('family_members').delete().eq('family_id', familyId).eq('user_id', userId);
  throwOnError('family_members delete', fm.error);
}

async function deleteEntireFamily(params: { adminClient: SupabaseClient; familyId: string }) {
  const { adminClient, familyId } = params;

  const [docPaths, photoPaths] = await Promise.all([
    listAllObjectPathsLoose(adminClient, 'documents', familyId),
    listAllObjectPathsLoose(adminClient, 'health-log-photos', familyId),
  ]);
  await removePathsLoose(adminClient, 'documents', docPaths);
  await removePathsLoose(adminClient, 'health-log-photos', photoPaths);

  const { error } = await adminClient.from('families').delete().eq('id', familyId);
  throwOnError('families delete', error);
}

/**
 * Per-family cleanup only touches families the user still belongs to. Orphan rows anywhere else
 * (e.g. tasks.assigned_to after an admin removed membership, or families.created_by with no handoff)
 * still reference public.profiles(id) and block auth.admin.deleteUser.
 */
async function purgeOrphanProfileReferences(adminClient: SupabaseClient, userId: string) {
  const { data: creatorFams, error: cfErr } = await adminClient.from('families').select('id').eq('created_by', userId);
  throwOnError('families list by created_by', cfErr);

  for (const row of creatorFams ?? []) {
    const familyId = row.id as string;
    const { count, error: cErr } = await adminClient
      .from('family_members')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', familyId);
    throwOnError('purge family_members count', cErr);
    const n = count ?? 0;
    if (n === 0) {
      await deleteEntireFamily({ adminClient, familyId });
      continue;
    }
    await handoffFamilyCreatorIfNeeded({ adminClient, familyId, leavingUserId: userId });
    const { data: famCheck, error: chkErr } = await adminClient
      .from('families')
      .select('created_by')
      .eq('id', familyId)
      .single();
    throwOnError('families recheck created_by', chkErr);
    if (String(famCheck?.created_by) !== String(userId)) continue;

    const { data: members, error: mErr } = await adminClient
      .from('family_members')
      .select('user_id, role')
      .eq('family_id', familyId);
    throwOnError('purge family_members list', mErr);
    const others = (members ?? []).filter((m) => String(m.user_id) !== String(userId));
    if (others.length === 0) {
      await deleteEntireFamily({ adminClient, familyId });
      continue;
    }
    const rank = (r: string) => (r === 'admin' ? 0 : r === 'member' ? 1 : 2);
    others.sort((a, b) => rank(a.role) - rank(b.role));
    const succ = others[0]!.user_id;
    const up = await adminClient.from('families').update({ created_by: succ }).eq('id', familyId);
    throwOnError('families forced created_by handoff', up.error);
  }

  const t0 = await adminClient.from('tasks').update({ assigned_to: null }).eq('assigned_to', userId);
  throwOnError('tasks global unassign assigned_to', t0.error);
  const t1 = await adminClient.from('tasks').delete().eq('created_by', userId);
  throwOnError('tasks global delete created_by', t1.error);

  const ce = await adminClient.from('calendar_events').delete().eq('created_by', userId);
  throwOnError('calendar_events global delete', ce.error);
  const med = await adminClient.from('medications').delete().eq('created_by', userId);
  throwOnError('medications global delete', med.error);
  const ch = await adminClient.from('checkins').delete().eq('submitted_by', userId);
  throwOnError('checkins global delete', ch.error);
  const fd = await adminClient.from('family_doctors').delete().eq('created_by', userId);
  throwOnError('family_doctors global delete', fd.error);
  const vp = await adminClient.from('visit_prep_summaries').delete().eq('created_by', userId);
  throwOnError('visit_prep_summaries global delete', vp.error);

  const ml = await adminClient.from('medication_logs').update({ logged_by: null }).eq('logged_by', userId);
  throwOnError('medication_logs global anonymize', ml.error);

  const { data: hRows, error: hErr } = await adminClient
    .from('health_logs')
    .select('id, photo_path')
    .eq('logged_by', userId);
  throwOnError('health_logs global select', hErr);
  const healthPhotoPaths = (hRows ?? []).map((r) => r.photo_path).filter((p): p is string => !!p);
  await removePathsLoose(adminClient, 'health-log-photos', healthPhotoPaths);
  const hDel = await adminClient.from('health_logs').delete().eq('logged_by', userId);
  throwOnError('health_logs global delete', hDel.error);

  const { data: docRows, error: dErr } = await adminClient
    .from('documents')
    .select('id, file_path')
    .eq('uploaded_by', userId);
  throwOnError('documents global select', dErr);
  const docPaths = (docRows ?? []).map((r) => r.file_path).filter((p): p is string => !!p);
  await removePathsLoose(adminClient, 'documents', docPaths);
  const docIds = (docRows ?? []).map((r) => r.id).filter((id): id is string => !!id);
  if (docIds.length > 0) {
    const dDel = await adminClient.from('documents').delete().in('id', docIds);
    throwOnError('documents global delete', dDel.error);
  }

  const fm = await adminClient.from('family_members').delete().eq('user_id', userId);
  throwOnError('family_members global delete', fm.error);

  // After membership rows are gone, any family still listing this user as creator must be reassigned
  // or deleted (covers storage failures earlier and UUID comparison edge cases).
  await finalizeFamiliesCreatedByUser({ adminClient, userId });
}

async function finalizeFamiliesCreatedByUser(params: { adminClient: SupabaseClient; userId: string }) {
  const { adminClient, userId } = params;
  const { data: stuck, error: selErr } = await adminClient.from('families').select('id').eq('created_by', userId);
  throwOnError('finalizeFamiliesCreatedBy select', selErr);

  for (const row of stuck ?? []) {
    const familyId = row.id as string;
    const { data: members, error: mErr } = await adminClient
      .from('family_members')
      .select('user_id, role')
      .eq('family_id', familyId);
    throwOnError('finalizeFamiliesCreatedBy members', mErr);
    const rest = members ?? [];
    if (rest.length > 0) {
      const rank = (r: string) => (r === 'admin' ? 0 : r === 'member' ? 1 : 2);
      const sorted = [...rest].sort((a, b) => rank(a.role) - rank(b.role));
      const succ = sorted[0]!.user_id;
      const up = await adminClient.from('families').update({ created_by: succ }).eq('id', familyId);
      throwOnError('finalizeFamiliesCreatedBy update', up.error);
    } else {
      await deleteEntireFamily({ adminClient, familyId });
    }
  }

  const { count, error: cErr } = await adminClient
    .from('families')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', userId);
  throwOnError('finalizeFamiliesCreatedBy verify count', cErr);
  if ((count ?? 0) > 0) {
    throw new Error(
      `delete-account invariant: ${count} families still reference created_by=${userId} after finalize`,
    );
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response('Server misconfiguration', { status: 500 });
  }

  const authorization = req.headers.get('Authorization');
  const bearer = parseBearerToken(authorization);
  if (!bearer) return jsonResponse({ error: 'Unauthorized' }, 401);

  const authedClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const {
    data: { user },
    error: userError,
  } = await authedClient.auth.getUser();
  if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

  const userId = user.id;

  try {
    const { data: memberships, error: memErr } = await adminClient
      .from('family_members')
      .select('family_id')
      .eq('user_id', userId);
    throwOnError('family_members list', memErr);

    const familyIds = [...new Set((memberships ?? []).map((m) => m.family_id).filter(Boolean))] as string[];

    for (const familyId of familyIds) {
      const { count, error: countErr } = await adminClient
        .from('family_members')
        .select('id', { count: 'exact', head: true })
        .eq('family_id', familyId);
      throwOnError('family_members count', countErr);

      if ((count ?? 0) <= 1) {
        await deleteEntireFamily({ adminClient, familyId });
      } else {
        await deleteUserContentInFamily({ adminClient, userId, familyId });
      }
    }

    const pt = await adminClient.from('push_tokens').delete().eq('user_id', userId);
    throwOnError('push_tokens delete', pt.error);

    // subscription_overrides.set_by → auth.users without ON DELETE until migration; clear so deleteUser succeeds.
    const so = await adminClient.from('subscription_overrides').update({ set_by: null }).eq('set_by', userId);
    throwOnError('subscription_overrides clear set_by', so.error);

    await purgeOrphanProfileReferences(adminClient, userId);

    const avatarPaths = await listAllObjectPathsLoose(adminClient, 'profile-avatars', userId);
    await removePathsLoose(adminClient, 'profile-avatars', avatarPaths);

    // DB-enforced last mile: clears families.created_by in SQL (PostgREST/storage quirks cannot skip this).
    const { error: detachRpcErr } = await adminClient.rpc('delete_account_detach_family_creator', {
      p_user_id: userId,
    });
    throwOnError('delete_account_detach_family_creator rpc', detachRpcErr);

    const { count: createdByLeft, error: cbErr } = await adminClient
      .from('families')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userId);
    throwOnError('families created_by post-rpc count', cbErr);
    if ((createdByLeft ?? 0) > 0) {
      throw new Error(
        `delete-account invariant: ${createdByLeft} families still have created_by after delete_account_detach_family_creator`,
      );
    }

    const { error: delUserErr } = await adminClient.auth.admin.deleteUser(userId);
    if (delUserErr) throw delUserErr;

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
