# alphacoders cloud deployment

Current implemented backend: Supabase + Firebase Cloud Messaging, with a Vercel-hosted web frontend for this personal/non-commercial project. A Neon-based backend has been discussed but is not implemented yet.

The native APK contains its JavaScript bundle. It does not require Metro, a computer, or the same Wi-Fi after installation. Shared data still requires internet access and a deployed Supabase project.

## Deployment status

- Deployment target: create or connect `alphacoders` in the repository owner’s own Vercel account. No live deployment is configured in this repository.
- `vercel.json` prepares the dashboard export and `app-config.json` public connection metadata.
- Supabase and Firebase account connections are still required before live provisioning and notification verification.
- A standalone release APK has been built at `artifacts/alphacoders.apk` and signed with a unique local key. APK Signature Scheme v2 and v3 verification passed. The APK has not been tested on a physical phone. Firebase resources were not available at build time, so a later build with Firebase configuration is required for live push notifications.

## Supabase

1. Connect the Supabase integration. Use a free project with email/password auth.
2. Apply `supabase/migrations/202611040001_pulse.sql`.
3. Configure the `notify` Edge Function and its `CRON_SECRET` in Supabase, deploy it, and schedule `supabase/schedule.sql`. The scheduler runs in Supabase, independently of the website host.
4. Set only the public project URL and publishable/anon key as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in Vercel.
5. Configure auth confirmation email delivery and allowed URLs for the deployed domain.

## Vercel

Build command: `npm run build:hosted`; output: `dist/web`. The build fails if cloud configuration is missing or uses a secret/service-role key. Frontend configuration is public by design; authorization remains enforced by Supabase row-level security.

After deployment, verify that `/app-config.json` returns JSON without requiring Vercel authentication. The public production website must expose only its login/UI/configuration; private workspace records remain behind Supabase authentication. Test login, join, two-account updates, and founder authorization before distributing to the team.

## APK

`npm run apk:local` generates native directories through Expo, builds a release APK with its embedded JS bundle, signs it with a unique local key, verifies the signature, and writes `artifacts/alphacoders.apk` plus a SHA-256 file.

It requires JDK 21 and an Android SDK. Set `JAVA_HOME` and `ANDROID_HOME` if they are not in the standard macOS Android Studio locations. Use `npm run apk:local -- --prebuild` after changing native dependencies or app configuration. JavaScript-only changes reuse the generated native project.

The build supports ARM64 and ARMv7 phones; it is not an x86 emulator build.

Signing material is saved under ignored `.credentials/` with restricted permissions. Preserve it privately for future updates. Do not distribute signing keys or passwords with the APK.

At first launch, enter the deployed Vercel HTTPS URL into **Company workspace URL**. The app downloads and stores public connection metadata, then opens individual account sign-in. Subsequent launches use the saved configuration. There is no demo entry point or sample data in the application. New workspaces start empty.

## Android push

Firebase's Android registration must match `com.pulseteam.app`. Set `GOOGLE_SERVICES_JSON` before generating native directories/building. The Firebase configuration file is required in the native build; entering a workspace URL later cannot add native Firebase resources.

The current implementation uses Expo Push Service backed by FCM. It also needs an EAS project ID and FCM v1 credentials registered for that project. `EXPO_PUBLIC_EAS_PROJECT_ID` is a public ID, not a secret. Server credentials remain in Firebase/EAS, not in the APK or Vercel frontend.

Install on a physical Android phone, enable notifications in Settings, and verify: check-in warning, due reminder, project deadline warning, and a founder notification from another account. Delivery is best-effort and depends on permissions, network, and Android background behavior.
