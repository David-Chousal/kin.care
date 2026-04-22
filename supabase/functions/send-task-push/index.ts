/**
 * send-task-push — Supabase Edge Function
 *
 * Called by the client after a task's assigned_to field changes.
 * Uses the service-role key to read push tokens and calls Expo Push API.
 *
 * Invariants enforced here (defence-in-depth, even though client also checks):
 *   - new_assignee must be a member of the task's family
 *   - new_assignee !== assigner (no self-push)
 *   - new_assignee !== old_assignee (no duplicate push on no-change)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface RequestBody {
  task_id: string;
  task_title: string;
  assigner_id: string;
  new_assignee_id: string | null;
  old_assignee_id: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  if (!serviceRoleKey || !supabaseUrl) {
    return new Response('Server misconfiguration', { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { task_id, task_title, assigner_id, new_assignee_id, old_assignee_id } = body;

  // Guard: no push if unassigning, self-assigning, or no change
  if (!new_assignee_id) return new Response('No assignee', { status: 200 });
  if (new_assignee_id === assigner_id) return new Response('Self-assign', { status: 200 });
  if (new_assignee_id === old_assignee_id) return new Response('No change', { status: 200 });

  // Verify task exists and new_assignee is a family member (trusted server-side check)
  const { data: task, error: taskError } = await adminClient
    .from('tasks')
    .select('id, family_id')
    .eq('id', task_id)
    .single();

  if (taskError || !task) {
    console.error('Task not found:', taskError?.message);
    return new Response('Task not found', { status: 404 });
  }

  const { count: memberCount, error: memberError } = await adminClient
    .from('family_members')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', task.family_id)
    .eq('user_id', new_assignee_id);

  if (memberError || !memberCount) {
    console.error('Assignee not a family member:', memberError?.message);
    return new Response('Not a member', { status: 403 });
  }

  // Get assigner display name
  const { data: assignerProfile } = await adminClient
    .from('profiles')
    .select('full_name, email')
    .eq('id', assigner_id)
    .single();

  const assignerName = assignerProfile?.full_name ?? assignerProfile?.email ?? 'A team member';

  // Read push tokens for new_assignee (service role — never exposed to client)
  const { data: tokenRows, error: tokenError } = await adminClient
    .from('push_tokens')
    .select('token')
    .eq('user_id', new_assignee_id);

  if (tokenError) {
    console.error('Failed to read push tokens:', tokenError.message);
    return new Response('Token read error', { status: 500 });
  }

  if (!tokenRows || tokenRows.length === 0) {
    // No token registered — silent, save already succeeded
    return new Response('No token', { status: 200 });
  }

  const messages = tokenRows.map((row) => ({
    to: row.token,
    title: 'New task assigned',
    body: `${assignerName} assigned you: ${task_title}`,
    data: { task_id, family_id: task.family_id },
    sound: 'default',
  }));

  // Send via Expo Push API
  let expoPushError: string | null = null;
  try {
    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!expoRes.ok) {
      const text = await expoRes.text();
      expoPushError = `Expo push HTTP ${expoRes.status}: ${text}`;
    }
  } catch (err) {
    expoPushError = String(err);
  }

  if (expoPushError) {
    // Log failure but treat as non-fatal (save already succeeded)
    console.error('Expo push failed:', expoPushError);
    return new Response(JSON.stringify({ ok: false, error: expoPushError }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, sent: messages.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
