# alphacoders cloud deployment

Current backend: Firebase Authentication + Supabase data, with Firebase Cloud Messaging planned for Android push. Vercel is optional for a web frontend and is not required for Android.

The native APK contains its JavaScript bundle. It does not require Metro, a computer, or the same Wi-Fi after installation. Shared data still requires internet access and a deployed Supabase project.

## Deployment status

- Deployment target: create or connect `alphacoders` in the repository owner’s own Vercel account. No live deployment is configured in this repository.
- `vercel.json` prepares the dashboard export and `app-config.json` public connection metadata.
- Firebase project `alphacoders-593b1` is on Spark. Email/Password signup is enabled, and its public JS SDK client is registered.
- Supabase project `jrvqllgpuhzwyswwmpka` has both migrations applied (2026-11-04), including the private Firebase identity mapping. All seven application tables have RLS enabled; anonymous workspace access remains blocked.
- Supabase's Firebase Third-Party Auth integration is enabled for `alphacoders-593b1` with the owner's explicit approval.
- The local app and APK are configured with this project's public connection values through ignored `.env.local`. These values are not included in Git; other build environments must configure them separately.
- The `firebase-access` Edge Function is deployed. It validates Google's Firebase ID tokens itself (`verify_jwt=false` for Supabase's legacy-secret gate). Missing/forged tokens return 401 and unsupported methods return 405. It requires the server-only `FIREBASE_SERVICE_ACCOUNT` secret, whose creation/entry is handed to the owner. This step is still pending confirmation in the project secret list.
- Firebase's built-in verification and password-reset emails replace the previous SMTP plan; Brevo and Gmail SMTP are not required.
- First real signup/verification, Android FCM resources, Expo push credentials, the notification worker, and its cron schedule still need configuration or end-to-end verification.
- A standalone release APK has been built at `artifacts/alphacoders.apk` and signed with a unique local key. APK Signature Scheme v2 and v3 verification passed. The APK has not been tested on a physical phone. Firebase resources were not available at build time, so a later build with Firebase configuration is required for live push notifications.

## Supabase

1. Create or connect a Supabase project and Firebase Authentication project with email/password auth.
2. Apply both SQL files in `supabase/migrations/` in order. Configure Firebase Third-Party Auth and the `firebase-access` function and secret as described in README.
3. Configure the `notify` Edge Function and its `CRON_SECRET` in Supabase, deploy it, and schedule `supabase/schedule.sql`. The scheduler runs in Supabase, independently of the website host.
4. Set only the public project URL and publishable/anon key as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in Vercel.
5. Configure the public Firebase SDK values in the frontend build environment as well. Verify the real Firebase email-confirmation and reset flow.

## Vercel

Build command: `npm run build:hosted`; output: `dist/web`. The build fails if cloud configuration is missing or uses a secret/service-role key. Frontend configuration is public by design; authorization remains enforced by Supabase row-level security.

After deployment, verify that `/app-config.json` returns JSON without requiring Vercel authentication. The public production website must expose only its login/UI/configuration; private workspace records remain behind Supabase authentication. Test login, join, two-account updates, and founder authorization before distributing to the team.

## APK

`npm run apk:local` generates native directories through Expo, builds a release APK with its embedded JS bundle, signs it with a unique local key, verifies the signature, and writes `artifacts/alphacoders.apk` plus a SHA-256 file.

It requires JDK 21 and an Android SDK. Set `JAVA_HOME` and `ANDROID_HOME` if they are not in the standard macOS Android Studio locations. Use `npm run apk:local -- --prebuild` after changing native dependencies or app configuration. JavaScript-only changes reuse the generated native project.

The build supports ARM64 and ARMv7 phones; it is not an x86 emulator build.

Signing material is saved under ignored `.credentials/` with restricted permissions. Preserve it privately for future updates. Do not distribute signing keys or passwords with the APK.

Set the public Supabase URL and publishable/anon key in the build environment before compiling the APK. It then opens account sign-in automatically. Without configuration it shows a clear setup-pending screen; there is no user-entered hosting URL. There is no demo entry point or sample data in the application. New workspaces start empty.

## Android push

Firebase's Android registration must match `com.pulseteam.app`. Set `GOOGLE_SERVICES_JSON` before generating native directories/building. The Firebase configuration file is required in the native build; Firebase resources must be present before compiling the APK.

The current implementation uses Expo Push Service backed by FCM. It also needs an EAS project ID and FCM v1 credentials registered for that project. `EXPO_PUBLIC_EAS_PROJECT_ID` is a public ID, not a secret. Server credentials remain in Firebase/EAS, not in the APK or Vercel frontend.

Install on a physical Android phone, enable notifications in Settings, and verify: check-in warning, due reminder, project deadline warning, and a founder notification from another account. Delivery is best-effort and depends on permissions, network, and Android background behavior.
