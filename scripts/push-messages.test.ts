import { describe, expect, it } from 'vitest';
import { buildMessages, invalidTokens } from '../supabase/functions/push/messages';

describe('buildMessages', () => {
  it('sends the web route and notification id the app reads on tap, one message per token', () => {
    const m = buildMessages({ id: 7, text: 'replied to “Hello”', route: '/t/12' }, ['ExponentPushToken[a]', 'ExponentPushToken[b]']);
    expect(m).toHaveLength(2);
    expect(m[1]).toEqual({
      to: 'ExponentPushToken[b]',
      title: 'DTour',
      body: 'replied to “Hello”',
      sound: 'default',
      data: { route: '/t/12', notificationId: 7 },
    });
  });
  it('shortens long text for the lock screen', () => {
    const [m] = buildMessages({ id: 1, text: 'word '.repeat(200), route: '/' }, ['t']);
    expect(m.body.length).toBeLessThanOrEqual(80);
  });
  it('sends nothing without tokens', () => {
    expect(buildMessages({ id: 1, text: 'a', route: '/' }, [])).toEqual([]);
  });
});

describe('invalidTokens', () => {
  const messages = buildMessages({ id: 1, text: 'a', route: '/' }, ['t0', 't1', 't2']);
  it('picks the tokens Expo reports as DeviceNotRegistered, matched by position', () => {
    const tickets = [
      { status: 'ok' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      { status: 'error', details: { error: 'MessageRateExceeded' } },
    ];
    expect(invalidTokens(messages, tickets)).toEqual(['t1']);
  });
  it('copes with a missing ticket list or extra tickets', () => {
    expect(invalidTokens(messages, undefined)).toEqual([]);
    expect(invalidTokens(messages.slice(0, 1), [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }])).toEqual(
      [],
    );
  });
});
