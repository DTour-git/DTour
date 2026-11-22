// What a phone push shows (#46). The headline is the notification's text, which
// can quote other students' words (a thread title, a guide's name), and phones
// show it on the lock screen unless the owner hides previews. It stays as it is
// in the app, but the push carries at most PUSH_TEXT_MAX characters of it.
// No Deno-only imports, so the Vitest tests can import this file too.

export const PUSH_TEXT_MAX = 80;

/** Splits into user-perceived characters, so an emoji or accented letter is never cut in half. */
function graphemes(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  return Seg ? [...new Seg(undefined, { granularity: 'grapheme' }).segment(s)].map((x) => x.segment) : Array.from(s);
}

/**
 * The notification text, shortened for the lock screen: whitespace collapsed,
 * cut at a word boundary to at most `max` characters with "…", and a quote it
 * opened is closed again, so 'replied to your thread “A very long title…”'.
 */
export function pushText(text: string, max = PUSH_TEXT_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const chars = graphemes(clean);
  if (chars.length <= max) return clean;

  // Room for "…" and, if needed, a closing quote.
  let cut = chars.slice(0, max - 1 - 1).join('');
  const space = cut.lastIndexOf(' ');
  if (space > cut.length * 0.6) cut = cut.slice(0, space);
  cut = cut.replace(/[\s,.;:–—-]+$/, '');
  const needsClose = cut.includes('“') && cut.lastIndexOf('“') > cut.lastIndexOf('”');
  return `${cut}…${needsClose ? '”' : ''}`;
}
