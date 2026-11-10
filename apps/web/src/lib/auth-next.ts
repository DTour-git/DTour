const LOCAL_ORIGIN = 'https://dtour.invalid';

export function safeNext(next: string | null): string {
  if (!next?.startsWith('/') || next.startsWith('//')) return '/';

  try {
    const url = new URL(next, LOCAL_ORIGIN);
    // A normalized path beginning with // would become a host when reused as a URL.
    if (url.origin !== LOCAL_ORIGIN || url.pathname.startsWith('//')) return '/';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}
