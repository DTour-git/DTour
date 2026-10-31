import { describe, expect, it } from 'vitest';
import { headings, inline, inlineLines, parse, plain, slugify, splitMentions, wordCount } from './markdown';

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

  it('parses standalone display maths and leaves code fences alone', () => {
    expect(parse('Before\n\n$$\na^2 + b^2\n= c^2\n$$\n\n$$x=1$$\n\n```\n$$x$$\n```')).toEqual([
      { t: 'p', inl: [{ t: 'text', v: 'Before' }] },
      { t: 'math', v: 'a^2 + b^2\n= c^2' },
      { t: 'math', v: 'x=1' },
      { t: 'code', v: '$$x$$' },
    ]);
    expect(parse('$$\nunclosed')).toEqual([{ t: 'p', inl: [{ t: 'text', v: '$$ unclosed' }] }]);
  });

  it('does not pair a stray $$ across a blank line or code fence', () => {
    expect(parse('$$\nx\n\ntext\n\n```\n$$\n```')).toEqual([
      { t: 'p', inl: [{ t: 'text', v: '$$ x' }] },
      { t: 'p', inl: [{ t: 'text', v: 'text' }] },
      { t: 'code', v: '$$' },
    ]);
  });

  it('does not join two display formulas on one line', () => {
    expect(parse('$$a^2$$ and $$b^2$$')).toEqual([{ t: 'p', inl: [{ t: 'text', v: '$$a^2$$ and $$b^2$$' }] }]);
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

  it('recognizes inline maths and preserves escaped dollars, currency and code', () => {
    expect(inline('Let $x^2$ be ` $y$ ` and \\$5.')).toEqual([
      { t: 'text', v: 'Let ' }, { t: 'math', v: 'x^2' }, { t: 'text', v: ' be ' },
      { t: 'code', v: ' $y$ ' }, { t: 'text', v: ' and ' }, { t: 'text', v: '$' }, { t: 'text', v: '5.' },
    ]);
    expect(inline('₹100 and $5 or ₹/$ 100')).toEqual([{ t: 'text', v: '₹100 and $5 or ₹/$ 100' }]);
    expect(inline('$5 and $10')).toEqual([{ t: 'text', v: '$5 and $10' }]);
    expect(inline('$unclosed')).toEqual([{ t: 'text', v: '$unclosed' }]);
    expect(inline('$\\frac{1}{2}$')).toEqual([{ t: 'math', v: '\\frac{1}{2}' }]);
  });

  it('keeps maths that uses \\to after a number', () => {
    expect(inline('$1 \\to 2$')).toEqual([{ t: 'math', v: '1 \\to 2' }]);
    expect(inline('$0 \\to \\infty$')).toEqual([{ t: 'math', v: '0 \\to \\infty' }]);
  });
});

describe('inlineLines', () => {
  it('keeps line breaks and ignores block syntax', () => {
    expect(inlineLines('Unit 1: trees\n## Unit 2: $x$\n- ![x](https://e.x/p.gif)')).toEqual([
      [{ t: 'text', v: 'Unit 1: trees' }],
      [{ t: 'text', v: '## Unit 2: ' }, { t: 'math', v: 'x' }],
      [{ t: 'text', v: '- !' }, { t: 'link', v: 'x', href: 'https://e.x/p.gif' }],
    ]);
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
