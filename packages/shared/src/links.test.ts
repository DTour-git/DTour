import { describe, expect, it } from 'vitest';
import { inline } from './markdown';
import { linkTarget, safeHref } from './links';

describe('linkTarget', () => {
  it.each([
    ['https://example.com', 'https://example.com'],
    ['http://example.com/a?b=c#d', 'http://example.com/a?b=c#d'],
    ['HTTPS://Example.COM/Path', 'HTTPS://Example.COM/Path'],
    ['https://example.com:8443/x', 'https://example.com:8443/x'],
    ['  https://example.com  ', 'https://example.com'],
    ['//example.com/x', 'https://example.com/x'],
  ])('opens %j in the browser', (href, url) => {
    expect(linkTarget(href)).toEqual({ kind: 'external', url });
  });

  it.each([
    ['/b/academics/12', '/b/academics/12'],
    ['/wiki/hostel-guide#mess', '/wiki/hostel-guide#mess'],
    ['/u/aarav.k', '/u/aarav.k'],
    [' /lounge?room=global', '/lounge?room=global'],
  ])('keeps the DTour route %j inside DTour', (href, path) => {
    expect(linkTarget(href)).toEqual({ kind: 'internal', path });
  });

  it('treats links to the DTour site itself as internal routes', () => {
    const hosts = ['dtour.example'];
    expect(linkTarget('https://dtour.example/b/academics/12', hosts)).toEqual({ kind: 'internal', path: '/b/academics/12' });
    expect(linkTarget('HTTPS://DTour.Example', hosts)).toEqual({ kind: 'internal', path: '/' });
    expect(linkTarget('https://dtour.example?x=1', hosts)).toEqual({ kind: 'internal', path: '/?x=1' });
    expect(linkTarget('https://dtour.example//evil.example', hosts)).toEqual({ kind: 'blocked' });
    expect(linkTarget('https://dtour.example.evil.example/x', hosts)).toEqual({ kind: 'external', url: 'https://dtour.example.evil.example/x' });
  });

  it.each([
    'javascript:alert(1)',
    ' JaVaScRiPt:alert(1)',
    '\tjavascript:alert(1)',
    'java\nscript:alert(1)',
    'java\tscript:alert(1)',
    '\u0000javascript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<script>alert(1)</script>',
    'intent://scan/#Intent;scheme=zxing;end',
    'upi://pay?pa=attacker@bank&am=5000',
    'tel:+911234567890',
    'sms:+911234567890',
    'mailto:someone@example.com',
    'file:///etc/passwd',
    'dtour://thread/1',
    'whatsapp://send?text=hi',
    'market://details?id=x',
    'https:example.com',
    'https:/example.com',
    'https://',
    'https://dtu.ac.in@evil.example/',
    'https://exa mple.com',
    'https://ex\u007fample.com',
    '/\\evil.example',
    'https://evil.example\\@dtu.ac.in',
    'example.com',
    '#section',
    '',
    '   ',
  ])('blocks %j', (href) => {
    expect(linkTarget(href)).toEqual({ kind: 'blocked' });
  });

  it('blocks missing values', () => {
    expect(linkTarget(null)).toEqual({ kind: 'blocked' });
    expect(linkTarget(undefined)).toEqual({ kind: 'blocked' });
  });

  it('judges links exactly as the markdown parser hands them over', () => {
    const [link] = inline('[Pay here](upi://pay?pa=attacker)');
    expect(link).toMatchObject({ t: 'link', href: 'upi://pay?pa=attacker' });
    expect(linkTarget(link.t === 'link' ? link.href : '')).toEqual({ kind: 'blocked' });
  });
});

describe('safeHref', () => {
  it('returns a usable href or null', () => {
    expect(safeHref('https://forms.example/apply')).toBe('https://forms.example/apply');
    expect(safeHref('/societies')).toBe('/societies');
    expect(safeHref(' JaVaScRiPt:alert(1)')).toBeNull();
    expect(safeHref(null)).toBeNull();
  });
});
