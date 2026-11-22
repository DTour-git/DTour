import { describe, expect, it } from 'vitest';
import { PUSH_TEXT_MAX, pushText } from '../supabase/functions/push/text';

// #46: the push headline is shortened for the lock screen.
const longTitle = 'Anyone else think the new canteen timings make absolutely no sense for second years who have labs until five';

describe('pushText', () => {
  it('leaves a short headline as it is', () => {
    expect(pushText('replied to your thread “Mess timings”')).toBe('replied to your thread “Mess timings”');
  });

  it(`cuts a long headline to at most ${PUSH_TEXT_MAX} characters`, () => {
    const out = pushText(`replied to your thread “${longTitle}”`);
    expect([...new Intl.Segmenter().segment(out)].length).toBeLessThanOrEqual(PUSH_TEXT_MAX);
    expect(out.startsWith('replied to your thread “Anyone else think')).toBe(true);
  });

  it('ends on a whole word, with an ellipsis and the closing quote', () => {
    const out = pushText(`mentioned you in “${longTitle}”`);
    expect(out).toMatch(/[a-z]…”$/);
    expect(longTitle).toContain(out.slice('mentioned you in “'.length, -2));
  });

  it('never splits an emoji or an accented letter', () => {
    const out = pushText('🎉'.repeat(120), 10);
    expect(out).toBe('🎉'.repeat(8) + '…');
    expect(pushText('é'.repeat(100), 10)).toBe('é'.repeat(8) + '…');
  });

  it('collapses whitespace and newlines from user text', () => {
    expect(pushText('asked to join\n\n  “Team   Rocket”')).toBe('asked to join “Team Rocket”');
  });

  it('respects a custom limit', () => {
    expect([...pushText(longTitle, 30)].length).toBeLessThanOrEqual(30);
  });
});
