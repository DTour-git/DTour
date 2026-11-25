const { getDefaultConfig } = require('expo/metro-config');

// With SENTRY_AUTH_TOKEN set (EAS builds, #15), bundles get debug ids so the
// uploaded source maps match crashes. Otherwise this is Expo's default config.
module.exports = process.env.SENTRY_AUTH_TOKEN
  ? require('@sentry/react-native/metro').getSentryExpoConfig(__dirname)
  : getDefaultConfig(__dirname);
