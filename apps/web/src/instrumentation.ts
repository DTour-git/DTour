import type { Instrumentation } from 'next';
import { sentryOptions } from '@/lib/monitoring';

// Server-side error monitoring (#15): Server Components, route handlers and
// the proxy. Does nothing unless NEXT_PUBLIC_SENTRY_DSN is set.
export async function register() {
  if (!sentryOptions.dsn) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.init(sentryOptions);
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!sentryOptions.dsn) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...args);
};
