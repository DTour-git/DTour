import { describe, expect, it } from 'vitest';
import { scrubEvent } from './monitoring';

describe('scrubEvent', () => {
  it('keeps only the user id', () => {
    const e = scrubEvent({ user: { id: 'u1', email: 'a@dtu.ac.in', username: 'a', ip_address: '1.2.3.4' } });
    expect(e.user).toEqual({ id: 'u1' });
  });

  it('drops a user with no id', () => {
    expect(scrubEvent({ user: { email: 'a@dtu.ac.in' } as { id?: string } }).user).toBeUndefined();
  });

  it('keeps the request path and user-agent, and nothing else', () => {
    const e = scrubEvent({
      request: {
        url: 'https://dtour.in/u/someone?token=abc#x',
        headers: { cookie: 'sb=secret', authorization: 'Bearer x', 'user-agent': 'UA' },
        data: { body: 'secret' },
        cookies: { sb: 'secret' },
        query_string: 'token=abc',
      },
    });
    expect(e.request).toEqual({ url: 'https://dtour.in/u/someone', headers: { 'user-agent': 'UA' } });
  });

  it('drops breadcrumb data but keeps the breadcrumb', () => {
    const e = scrubEvent({ breadcrumbs: [{ data: { url: '/rest/v1/profiles?email=eq.a' }, message: 'fetch' } as { data?: unknown }] });
    expect(e.breadcrumbs).toEqual([{ message: 'fetch' }]);
  });
});
