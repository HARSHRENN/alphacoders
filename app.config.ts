import type { ExpoConfig, ConfigContext } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'alphacoders',
  slug: 'alphacoders',
  scheme: 'pulse-team',
  android: {
    ...config.android,
    package: 'com.pulseteam.app',
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
  plugins: ['expo-font', 'expo-router', 'expo-notifications', 'expo-secure-store'],
  extra: {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || config.extra?.eas?.projectId,
    },
  },
});
