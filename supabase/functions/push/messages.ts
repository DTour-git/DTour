// The pure parts of the push function: what is sent to Expo, and which tokens
// Expo says are dead. No Deno-only imports, so the Vitest tests can import this file.
import { pushText } from './text.ts';

export type PushNotification = { id: number; text: string; route: string };
export type PushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  // The app reads `route` on tap and maps it with appRoute() (apps/mobile/src/lib/notifications.tsx).
  data: { route: string; notificationId: number };
};
export type PushTicket = { status: string; details?: { error?: string } };

export function buildMessages(n: PushNotification, tokens: string[]): PushMessage[] {
  return tokens.map((to) => ({
    to,
    title: 'DTour',
    // Shortened: phones show this on the lock screen (#46). The full text is in the app.
    body: pushText(n.text),
    sound: 'default',
    data: { route: n.route, notificationId: n.id },
  }));
}

/** Tokens whose ticket says the device is gone; Expo returns one ticket per message, in order. */
export function invalidTokens(messages: PushMessage[], tickets: PushTicket[] | undefined): string[] {
  return (tickets ?? []).flatMap((t, i) => (t.details?.error === 'DeviceNotRegistered' && messages[i] ? [messages[i].to] : []));
}
