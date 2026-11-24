import { scrubEvent } from '@dtour/shared';

// Error monitoring (#15). Inert unless NEXT_PUBLIC_SENTRY_DSN is set: it's
// inlined at build time, so without it the Sentry code is never loaded.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryOptions = {
  dsn,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
  sendDefaultPii: false,
  tracesSampleRate: 0, // errors only; performance tracing is out of scope
  beforeSend: scrubEvent,
};

/** Reports an error caught by an error boundary. */
export function reportError(error: unknown) {
  if (dsn) import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error)).catch(() => {});
}

/** Tags later events with the signed-in student's id (id only, never email or name). */
export function setMonitoringUser(id: string | null) {
  if (dsn) import('@sentry/nextjs').then((Sentry) => Sentry.setUser(id ? { id } : null)).catch(() => {});
}
