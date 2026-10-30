// Minimal Markdown → block tree, rendered natively by each app.
// Supports: ### / #### headings, paragraphs, - lists, > quotes,
// `> [!senior] "quote" — attribution` pull quotes, ``` code fences,
// and inline **bold**, *italic*, `code`, [links](url), and $LaTeX$.

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'b'; v: string }
  | { t: 'i'; v: string }
  | { t: 'code'; v: string }
  | { t: 'math'; v: string }
  | { t: 'link'; v: string; href: string };

export type Block =
  | { t: 'h'; level: 3 | 4; text: string; id: string }
  | { t: 'p'; inl: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'quote'; inl: Inline[] }
  | { t: 'senior'; quote: string; by: string | null }
  | { t: 'code'; v: string }
  | { t: 'math'; v: string }
  | { t: 'img'; src: string; alt: string };

const INLINE = /(\\\$|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\$(?!\$|\s)(?:\\.|[^$\\\n])+?\$|\[[^\]]+\]\([^)\s]+\))/g;

export function inline(src: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  INLINE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE.exec(src))) {
    const s = m[0], i = m.index ?? 0;
    if (s.startsWith('$') && (src[i - 1] === '$' || /\s/.test(s[s.length - 2]) || /[\d$]/.test(src[i + s.length] ?? '') || /^\$\d/.test(s) && /\b(?:and|or|for|to)\b/i.test(s))) { INLINE.lastIndex = i + 1; continue; }
    if (i > last) out.push(...splitMentions(src.slice(last, i)));
    if (s.startsWith('**')) out.push({ t: 'b', v: s.slice(2, -2) });
    else if (s.startsWith('`')) out.push({ t: 'code', v: s.slice(1, -1) });
    else if (s.startsWith('$')) out.push({ t: 'math', v: s.slice(1, -1) });
    else if (s === '\\$') out.push({ t: 'text', v: '$' });
    else if (s.startsWith('[')) {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(s);
      if (mm) out.push({ t: 'link', v: mm[1], href: mm[2] });
    } else out.push({ t: 'i', v: s.slice(1, -1) });
    last = i + s.length;
  }
  if (last < src.length) out.push(...splitMentions(src.slice(last)));
  return out;
}

/** Splits plain text into text and @mention pieces (for replies and chat). */
export function splitMentions(src: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  // No lookbehind (older JS engines): check the character before the @ by hand.
  for (const m of src.matchAll(/@[a-zA-Z0-9][a-zA-Z0-9._]{2,23}/g)) {
    const i = m.index ?? 0;
    if (i > 0 && /[\w.@]/.test(src[i - 1])) continue;
    const h = m[0].replace(/\.+$/, '');
    if (i > last) out.push({ t: 'text', v: src.slice(last, i) });
    out.push({ t: 'link', v: h, href: `/u/${h.slice(1).toLowerCase()}` });
    last = i + h.length;
  }
  if (last < src.length) out.push({ t: 'text', v: src.slice(last) });
  return out;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function parse(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (para.length) { blocks.push({ t: 'p', inl: inline(para.join(' ')) }); para = []; }
    if (list.length) { blocks.push({ t: 'ul', items: list.map(inline) }); list = []; }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith('```'); i++) code.push(lines[i]);
      blocks.push({ t: 'code', v: code.join('\n') });
      continue;
    }
    const display = /^\$\$(.+)\$\$$/.exec(trimmed);
    if (display && display[1].trim()) {
      flush(); blocks.push({ t: 'math', v: display[1].trim() }); continue;
    }
    if (trimmed === '$$') {
      const end = lines.findIndex((l, j) => j > i && l.trim() === '$$');
      if (end > i + 1) {
        flush(); blocks.push({ t: 'math', v: lines.slice(i + 1, end).join('\n') }); i = end; continue;
      }
    }
    if (!trimmed) { flush(); continue; }
    const img = /^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/.exec(trimmed);
    if (img) { flush(); blocks.push({ t: 'img', alt: img[1], src: img[2] }); continue; }
    const h = /^(#{2,4})\s+(.*)$/.exec(trimmed);
    if (h) {
      flush();
      blocks.push({ t: 'h', level: h[1].length >= 4 ? 4 : 3, text: h[2], id: slugify(h[2]) });
      continue;
    }
    const senior = /^>\s*\[!senior\]\s*(.*)$/.exec(trimmed);
    if (senior) {
      flush();
      const [q, by] = senior[1].split(/\s+—\s+/);
      blocks.push({ t: 'senior', quote: q.trim(), by: by ? by.trim() : null });
      continue;
    }
    if (trimmed.startsWith('>')) { flush(); blocks.push({ t: 'quote', inl: inline(trimmed.replace(/^>\s?/, '')) }); continue; }
    const li = /^[-*]\s+(.*)$/.exec(trimmed);
    if (li) { if (para.length) flush(); list.push(li[1]); continue; }
    if (list.length) flush();
    para.push(trimmed);
  }
  flush();
  return blocks;
}

export function headings(blocks: Block[]): { text: string; id: string }[] {
  return blocks.filter((b): b is Extract<Block, { t: 'h' }> => b.t === 'h').map((b) => ({ text: b.text, id: b.id }));
}

export function wordCount(md: string): number {
  return md.split(/\s+/).filter(Boolean).length;
}

/** Plain-text excerpt for previews. */
export function plain(md: string, max = 200): string {
  const s = md.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/[#>*`$\[\]]/g, '').replace(/\(([^)]+)\)/g, '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
