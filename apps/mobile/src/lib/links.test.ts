import { describe, expect, it, vi } from 'vitest';
import { openUserLink, resolveLink } from './links';

// Links in other people's posts must not hand a tap to another app (issue #45).
describe('resolveLink', () => {
  it('opens web pages in the browser', () => {
    expect(resolveLink('https://example.com/x')).toEqual({ kind: 'browser', url: 'https://example.com/x' });
    expect(resolveLink('HTTP://example.com')).toEqual({ kind: 'browser', url: 'HTTP://example.com' });
  });

  it('maps DTour web routes to app screens', () => {
    expect(resolveLink('/b/academics/12')).toEqual({ kind: 'app', route: '/thread/12' });
    expect(resolveLink('/library/subject/CO201')).toEqual({ kind: 'app', route: '/library/CO201' });
    expect(resolveLink('/u/aarav.k')).toEqual({ kind: 'app', route: '/u/aarav.k' });
  });

  it.each([
    ' JaVaScRiPt:alert(1)',
    'intent://scan/#Intent;scheme=zxing;end',
    'upi://pay?pa=attacker@bank',
    'tel:+911234567890',
    'sms:+911234567890',
    'mailto:a@example.com',
    'file:///sdcard/x',
    'dtour://mod',
    'DTOUR:///new',
    'whatsapp://send?text=hi',
    '/\\evil.example',
    'not a url',
    '',
  ])('blocks %j', (href) => {
    expect(resolveLink(href)).toEqual({ kind: 'blocked' });
  });
});

describe('openUserLink', () => {
  const io = () => ({ push: vi.fn(), openURL: vi.fn(async () => {}) });

  it('pushes DTour routes and opens nothing else', () => {
    const d = io();
    expect(openUserLink('/t/7', d)).toBe(true);
    expect(d.push).toHaveBeenCalledWith('/thread/7');
    expect(d.openURL).not.toHaveBeenCalled();
  });

  it('opens http(s) links with openURL', () => {
    const d = io();
    expect(openUserLink('https://example.com', d)).toBe(true);
    expect(d.openURL).toHaveBeenCalledWith('https://example.com');
    expect(d.push).not.toHaveBeenCalled();
  });

  it('never calls openURL or push for a blocked scheme', () => {
    const d = io();
    for (const href of ['upi://pay?pa=x', 'intent://x', 'tel:1', ' javascript:alert(1)', 'dtour://thread/1']) {
      expect(openUserLink(href, d)).toBe(false);
    }
    expect(d.openURL).not.toHaveBeenCalled();
    expect(d.push).not.toHaveBeenCalled();
  });

  it('swallows a failed openURL instead of throwing', async () => {
    const d = { push: vi.fn(), openURL: vi.fn(async () => { throw new Error('No app'); }) };
    expect(openUserLink('https://example.com', d)).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
  });
});
