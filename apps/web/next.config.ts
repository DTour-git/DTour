import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

// Sent with every page and API response (#42).
// - HSTS: browsers that have seen DTour over https never fall back to http, so
//   the session cookie can't be stripped onto a plain connection. No
//   includeSubDomains: other subdomains of the site's domain aren't ours to
//   commit to https. Browsers ignore this header on plain http responses.
// - The rest stop other sites framing DTour (clickjacking), MIME sniffing, and
//   full URLs leaking in the Referer header to other sites.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  transpilePackages: ['@dtour/shared'],
  images: { remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }] },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

// Source maps are uploaded to Sentry only when the host sets SENTRY_AUTH_TOKEN
// (with SENTRY_ORG and SENTRY_PROJECT) for the build (#15). Without it the
// config is unchanged and the build never contacts Sentry.
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, { silent: !process.env.CI, telemetry: false })
  : nextConfig;

