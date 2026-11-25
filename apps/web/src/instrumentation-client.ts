import { sentryOptions } from '@/lib/monitoring';

// Browser error monitoring (#15). Does nothing unless NEXT_PUBLIC_SENTRY_DSN is set.
if (sentryOptions.dsn) import('@sentry/nextjs').then((Sentry) => Sentry.init(sentryOptions)).catch(() => {});
