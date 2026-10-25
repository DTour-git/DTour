import { withSupabase } from 'npm:@supabase/server@^1';

type Notification = { id: number; user_id: string; text: string; snippet: string | null; route: string };
type Webhook = { type: string; table: string; schema: string; record: Notification };

// Configure a Database Webhook for INSERT on public.notifications, with a
// secret API key in the apikey header. This function uses service-role access
// only after the gateway authenticates that key.
export default {
  fetch: withSupabase({ auth: 'secret' }, async (request, context) => {
    const event = await request.json() as Webhook;
    if (event.type !== 'INSERT' || event.table !== 'notifications' || event.schema !== 'public' || !event.record?.user_id) {
      return Response.json({ error: 'Unexpected webhook payload' }, { status: 400 });
    }

    const { data: tokens, error } = await context.supabaseAdmin
      .from('device_push_tokens').select('token').eq('user_id', event.record.user_id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!tokens?.length) return Response.json({ sent: 0 });

    const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    const messages = tokens.map(({ token }) => ({
      to: token,
      title: 'DTour',
      body: event.record.text,
      sound: 'default',
      data: { route: event.record.route, notificationId: event.record.id },
    }));
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(messages),
    });
    if (!response.ok) return Response.json({ error: await response.text() }, { status: 502 });
    const result = await response.json() as { data?: { status: string; details?: { error?: string } }[] };
    const invalid = result.data?.flatMap((ticket, index) => ticket.details?.error === 'DeviceNotRegistered' ? [messages[index].to] : []) ?? [];
    if (invalid.length) await context.supabaseAdmin.from('device_push_tokens').delete().in('token', invalid);
    return Response.json({ sent: messages.length - invalid.length });
  }),
};
