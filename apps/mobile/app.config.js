// app.json's config, plus Sentry's build plugin only when SENTRY_AUTH_TOKEN is
// set (an EAS env var, #15). The plugin uploads source maps and native symbols
// at build time. Without the token the config is exactly app.json.
module.exports = ({ config }) => ({
  ...config,
  plugins: process.env.SENTRY_AUTH_TOKEN
    ? [...config.plugins, ['@sentry/react-native/expo', { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT }]]
    : config.plugins,
});
