// Error-monitoring helper both apps use (#15). Runs in Sentry's beforeSend so
// events carry a user id and nothing else personal.

interface Scrubbable {
  user?: { id?: string | number };
  request?: { url?: string; headers?: Record<string, string> };
  breadcrumbs?: { data?: unknown }[];
}

/**
 * Strips an error event down to what's needed to debug it: the user id (no
 * email, name or IP), the request's path (no query string, body or cookies) and
 * only the user-agent header. Breadcrumb data (URLs, request details) is dropped.
 */
export function scrubEvent<T extends Scrubbable>(event: T): T {
  const e: Scrubbable = event;
  if (e.user) e.user = e.user.id == null ? undefined : { id: e.user.id };
  if (e.request) {
    const url = e.request.url?.split(/[?#]/)[0];
    const userAgent = e.request.headers?.['user-agent'] ?? e.request.headers?.['User-Agent'];
    e.request = { url, headers: userAgent ? { 'user-agent': userAgent } : undefined };
  }
  e.breadcrumbs?.forEach((b) => {
    delete b.data;
  });
  return event;
}
