import { describe, expect, it } from 'vitest';
import { compact, dateline, daysBetween, deadlineText, fileSize, flair, initials, n, ordinalSem, weekOfSem, yearLabel } from './format';

describe('numbers', () => {
  it('n adds thousands separators', () => {
    expect(n(1420)).toBe('1,420');
    expect(n(null)).toBe('0');
  });
  it('compact matches the design ("31.2k", "1.8k", "196k", "940")', () => {
    expect(compact(940)).toBe('940');
    expect(compact(1800)).toBe('1.8k');
    expect(compact(31200)).toBe('31.2k');
    expect(compact(196000)).toBe('196k');
    expect(compact(2000)).toBe('2k');
  });
  it('fileSize uses KB below 1 MB and one decimal for MB', () => {
    expect(fileSize(122880)).toBe('120 KB');
    expect(fileSize(2516582)).toBe('2.4 MB');
    expect(fileSize(0)).toBe('');
  });
});

describe('people', () => {
  it("flair is BRANCH 'YY", () => {
    expect(flair('COE', 2028)).toBe("COE '28");
    expect(flair(null, 2028)).toBeNull();
  });
  it('yearLabel derives the year from the semester', () => {
    expect(yearLabel(3)).toBe('2nd year');
    expect(yearLabel(1)).toBe('1st year');
    expect(yearLabel(null)).toBeNull();
  });
  it('ordinalSem', () => {
    expect(ordinalSem(3)).toBe('3rd');
    expect(ordinalSem(5)).toBe('5th');
  });
  it('initials from handles', () => {
    expect(initials('aarav.k')).toBe('AK');
    expect(initials('segfault_sneha')).toBe('SS');
    expect(initials('@riya')).toBe('RI');
  });
});

describe('dates', () => {
  const now = new Date('2026-10-17T09:00:00+05:30');
  it('daysBetween counts calendar days', () => {
    expect(daysBetween('2026-10-17', '2026-11-05')).toBe(19);
  });
  it('dateline: Vol. 1 · No. 214 for launch 213 days earlier', () => {
    expect(dateline('2026-03-18', now)).toEqual({ vol: 1, no: 214 });
  });
  it('weekOfSem', () => {
    expect(weekOfSem('2026-08-03', now)).toBe(11);
  });
  it('deadlineText', () => {
    expect(deadlineText('2026-10-20', null, now)).toBe('3 days left');
    expect(deadlineText('2026-10-24', null, now)).toBe('1 week left');
    expect(deadlineText('2026-10-18', null, now)).toBe('1 day left');
    expect(deadlineText('2026-10-10', null, now)).toBe('Closed');
    expect(deadlineText(null, 'Trials Nov 2', now)).toBe('Trials Nov 2');
    expect(deadlineText(null, null, now)).toBe('Rolling');
  });
});
