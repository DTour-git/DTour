import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { scrubEvent } from '@dtour/shared';

type SentryModule = typeof import('@sentry/react-native');

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

// Error monitoring (#15). Inert unless EXPO_PUBLIC_SENTRY_DSN is set. Like push.ts,
// Sentry is loaded lazily and never on web, and any failure to load it is swallowed
// so monitoring can't crash the app.
let Sentry: SentryModule | null = null;
if (dsn && Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Sentry = require('@sentry/react-native') as SentryModule;
  } catch {
    Sentry = null;
  }
}

/** Starts reporting JS errors, and native crashes in development and store builds. Call once at startup. */
export function initMonitoring() {
  if (!Sentry) return;
  try {
    Sentry.init({
      dsn,
      environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || (__DEV__ ? 'development' : 'production'),
      sendDefaultPii: false,
      tracesSampleRate: 0, // errors only; performance tracing is out of scope
      // Expo Go has no Sentry native module, so it gets JS errors only.
      enableNative: Constants.executionEnvironment !== ExecutionEnvironment.StoreClient,
      beforeSend: scrubEvent,
    });
  } catch {
    Sentry = null;
  }
}

/** Reports an error caught by an error boundary. */
export function reportError(error: unknown) {
  Sentry?.captureException(error);
}

/** Tags later events with the signed-in student's id (id only, never email or name). */
export function setMonitoringUser(id: string | null) {
  Sentry?.setUser(id ? { id } : null);
}
