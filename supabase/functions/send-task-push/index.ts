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

/** Expo push ticket errors that mean the Expo push token should not be used again. */
const STALE_TOKEN_TICKET_ERRORS = new Set(['DeviceNotRegistered']);

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoPushSendResponse {
  data?: ExpoPushTicket | ExpoPushTicket[];
  errors?: unknown;
}

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
  let expoJson: ExpoPushSendResponse | null = null;
  try {
    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    const text = await expoRes.text();
    if (!expoRes.ok) {
      expoPushError = `Expo push HTTP ${expoRes.status}: ${text}`;
    } else {
      try {
        expoJson = JSON.parse(text) as ExpoPushSendResponse;
      } catch {
        expoPushError = `Expo push invalid JSON body: ${text.slice(0, 500)}`;
      }
    }
  } catch (err) {
    expoPushError = String(err);
  }

  if (expoPushError) {
    console.error('Expo push failed:', expoPushError);
    return new Response(JSON.stringify({ ok: false, error: expoPushError }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawTickets = expoJson?.data;
  const tickets: ExpoPushTicket[] = Array.isArray(rawTickets)
    ? rawTickets
    : rawTickets
      ? [rawTickets]
      : [];

  if (tickets.length === 0) {
    const msg = 'Expo push returned no ticket data';
    console.error(msg, { top_level_errors: expoJson?.errors });
    return new Response(JSON.stringify({ ok: false, error: msg, expo_errors: expoJson?.errors }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (tickets.length !== messages.length) {
    console.error('Expo push ticket count mismatch', {
      tickets: tickets.length,
      messages: messages.length,
    });
  }

  const ticketErrors: { index: number; code?: string }[] = [];
  let prunedStaleTokens = 0;
  const n = Math.min(tickets.length, tokenRows.length);

  for (let i = 0; i < n; i++) {
    const ticket = tickets[i];
    const token = tokenRows[i].token;

    if (ticket.status === 'ok') continue;

    const code = ticket.details?.error;
    if (code && STALE_TOKEN_TICKET_ERRORS.has(code)) {
      const { error: delErr } = await adminClient
        .from('push_tokens')
        .delete()
        .eq('user_id', new_assignee_id)
        .eq('token', token);

      if (delErr) {
        console.error('Failed to prune stale push token:', delErr.message, { index: i, code });
        ticketErrors.push({ index: i, code: `${code}_prune_failed` });
      } else {
        prunedStaleTokens += 1;
        console.info('Pruned stale push token', { user_id: new_assignee_id, index: i, code });
      }
      continue;
    }

    ticketErrors.push({ index: i, code });
    console.error('Expo push ticket error', {
      index: i,
      code: code ?? 'unknown',
      message: ticket.message?.slice(0, 200),
    });
  }

  const accepted = tickets.filter((t) => t.status === 'ok').length;
  const failedTickets = tickets.filter((t) => t.status === 'error').length;

  return new Response(
    JSON.stringify({
      ok: true,
      sent: accepted,
      failed_tickets: failedTickets,
      pruned_stale_tokens: prunedStaleTokens,
      ...(ticketErrors.length > 0 ? { ticket_errors: ticketErrors } : {}),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
});
