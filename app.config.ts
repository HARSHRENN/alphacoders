import type { ExpoConfig, ConfigContext } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'alphacoders',
  slug: 'pulse-team',
  scheme: 'pulse-team',
  android: {
    ...config.android,
    package: 'com.pulseteam.app',
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
  plugins: ['expo-router', 'expo-notifications', 'expo-secure-store'],
  extra: { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined } },
});
