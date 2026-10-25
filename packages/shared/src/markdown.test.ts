import { describe, expect, it } from 'vitest';
import { headings, inline, parse, plain, slugify, splitMentions, wordCount } from './markdown';

describe('parse', () => {
  it('reads headings, paragraphs and lists', () => {
    const blocks = parse('### 1. How grading works\n\nFirst line\nsame paragraph\n\n- one\n- two');
    expect(blocks[0]).toEqual({ t: 'h', level: 3, text: '1. How grading works', id: '1-how-grading-works' });
    expect(blocks[1]).toMatchObject({ t: 'p' });
    expect(blocks[2]).toMatchObject({ t: 'ul' });
    expect((blocks[2] as { items: unknown[] }).items).toHaveLength(2);
  });

  it('turns > [!senior] into a pull quote with attribution', () => {
    const [b] = parse('> [!senior] "Ask for old papers." — @offer_letter_pls, IT \'25');
    expect(b).toEqual({ t: 'senior', quote: '"Ask for old papers."', by: "@offer_letter_pls, IT '25" });
  });

  it('reads a standalone image line', () => {
    expect(parse('![photo](https://x.supabase.co/a.jpg)')).toEqual([{ t: 'img', alt: 'photo', src: 'https://x.supabase.co/a.jpg' }]);
  });

  it('keeps code fences verbatim', () => {
    expect(parse('```\nconst a = 1;\n```')).toEqual([{ t: 'code', v: 'const a = 1;' }]);
  });

  it('headings() lists the table of contents', () => {
    expect(headings(parse('### A\n\ntext\n\n### B'))).toEqual([
      { text: 'A', id: 'a' },
      { text: 'B', id: 'b' },
    ]);
  });
});

describe('inline', () => {
  it('parses bold, italic, code and links', () => {
    const kinds = inline('**b** *i* `c` [l](/wiki/x)').map((p) => p.t);
    expect(kinds).toEqual(['b', 'text', 'i', 'text', 'code', 'text', 'link']);
  });
});

describe('splitMentions', () => {
  it('links @handles to profiles, ignoring emails', () => {
    const parts = splitMentions('hi @Riya_codes and mail a@b.com');
    expect(parts).toContainEqual({ t: 'link', v: '@Riya_codes', href: '/u/riya_codes' });
    expect(parts.filter((p) => p.t === 'link')).toHaveLength(1);
  });
  it('drops a trailing full stop from the handle', () => {
    expect(splitMentions('thanks @aarav.k.')).toContainEqual({ t: 'link', v: '@aarav.k', href: '/u/aarav.k' });
  });
});

describe('helpers', () => {
  it('slugify, wordCount, plain', () => {
    expect(slugify('How to get a 9+ CGPA!')).toBe('how-to-get-a-9-cgpa');
    expect(wordCount('one two  three')).toBe(3);
    expect(plain('### Title\n\n**bold** text ![x](https://a/b.png)')).toBe('Title bold text');
  });
});
