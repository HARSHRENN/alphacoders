# alphacoders cloud deployment

Current backend: Firebase Authentication + Supabase data, with Firebase Cloud Messaging for Android push. Vercel is optional for a web frontend and is not required for Android.

The native APK contains its JavaScript bundle. It does not require Metro, a computer, or the same Wi-Fi after installation. Shared data still requires internet access and a deployed Supabase project.

## Deployment status

- Production web app: https://alphacoders-six.vercel.app, deployed to `alphacoders` in the owner’s `harshren-bachhavs-projects` Vercel team. Public root, deep routes, and `/app-config.json` return HTTP 200 without Vercel authentication. The connected MCP account is a different account and was not used to deploy.
- `vercel.json` prepares the dashboard export and `app-config.json` public connection metadata.
- Firebase project `alphacoders-593b1` is on Spark. Email/Password signup is enabled, and its public JS SDK client is registered.
- Supabase project `jrvqllgpuhzwyswwmpka` has all three migrations applied (2026-11-04), including the private Firebase identity mapping. All eight application tables have RLS enabled; anonymous workspace access remains blocked.
- Supabase's Firebase Third-Party Auth integration is enabled for `alphacoders-593b1` with the owner's explicit approval.
- The local app and APK are configured with this project's public connection values through ignored `.env.local`. These values are not included in Git; other build environments must configure them separately.
- The `firebase-access` Edge Function is deployed. It validates Google's Firebase ID tokens itself (`verify_jwt=false` for Supabase's legacy-secret gate). Missing/forged tokens return 401 and unsupported methods return 405. The owner saved the replacement server-only `FIREBASE_SERVICE_ACCOUNT` secret, confirmed in the project secret list on 2026-11-04. Its contents were not retrieved. Real signup, email verification, founder workspace creation, and a fresh cloud reload passed. The old IAM grants referred to a deleted identity; with explicit owner approval, the replacement service account now has the custom `alphacoders Backend` role containing only `firebaseauth.users.get`, `firebaseauth.users.update`, and `cloudmessaging.messages.create`. The server also requests the Firebase Authentication and service-account email OAuth scopes.
- Firebase's built-in verification and password-reset emails replace the previous SMTP plan; Brevo and Gmail SMTP are not required.
- The `notify` worker and minute-by-minute cron schedule are deployed. The worker authenticates private, expiring, one-use database invocation tickets. Missing/invalid tickets return 401 and unsupported methods return 405. Android FCM resources are included. The saved-secret configuration is present, and the scheduled worker returned HTTP 200 with accepted=0 and failed=0 at 2026-11-04 13:58 UTC. This checks the empty-queue path, not Google account-management or FCM delivery permissions. Real signup, verification, workspace creation, and reload passed; phone delivery tests remain outstanding.
- A standalone release APK has been built at `artifacts/alphacoders.apk` and signed with a unique local key. APK Signature Scheme v2 and v3 verification passed. The APK has not been tested on a physical phone. The latest build includes the registered Firebase Android app configuration for direct FCM tokens.

## Supabase

1. Create or connect a Supabase project and Firebase Authentication project with email/password auth.
2. Apply all three SQL migration files in `supabase/migrations/` in order. Configure Firebase Third-Party Auth and the `firebase-access` function and secret as described in README.
3. Deploy the `notify` Edge Function with its own invocation-ticket verification (`verify_jwt=false`), save the server-only Firebase service-account credential, and run `supabase/schedule.sql`. The scheduler runs in Supabase, independently of the website host.
4. Set only the public project URL and publishable/anon key as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in Vercel.
5. Configure the public Firebase SDK values in the frontend build environment as well. Verify the real Firebase email-confirmation and reset flow.

## Vercel

Build command: `npm run build:hosted`; output: `dist/web`. The build fails if cloud configuration is missing or uses a secret/service-role key. Frontend configuration is public by design; authorization remains enforced by Supabase row-level security.

After deployment, verify that `/app-config.json` returns JSON without requiring Vercel authentication. The public production website must expose only its login/UI/configuration; private workspace records remain behind Supabase authentication. Test login, join, two-account updates, and founder authorization before distributing to the team.

## APK

The signed Android build is distributed at https://alphacoders-six.vercel.app/downloads/alphacoders.apk. Its SHA-256 and version/size metadata are published alongside it as `/downloads/alphacoders.apk.sha256` and `/downloads/build.json`. The checked-in `releases/` build is copied into the hosted output only after its checksum passes; private signing material stays ignored.

`npm run apk:local` generates native directories through Expo, builds a release APK with its embedded JS bundle, signs it with a unique local key, verifies the signature, and writes `artifacts/alphacoders.apk` plus a SHA-256 file.

It requires JDK 21 and an Android SDK. Set `JAVA_HOME` and `ANDROID_HOME` if they are not in the standard macOS Android Studio locations. Use `npm run apk:local -- --prebuild` after changing native dependencies or app configuration. JavaScript-only changes reuse the generated native project.

The build supports ARM64 and ARMv7 phones; it is not an x86 emulator build.

Signing material is saved under ignored `.credentials/` with restricted permissions. Preserve it privately for future updates. Do not distribute signing keys or passwords with the APK.

Set the public Supabase URL and publishable/anon key in the build environment before compiling the APK. It then opens account sign-in automatically. Without configuration it shows a clear setup-pending screen; there is no user-entered hosting URL. There is no demo entry point or sample data in the application. New workspaces start empty.

## Android push

Firebase's Android registration must match `com.pulseteam.app`. Set `GOOGLE_SERVICES_JSON` before generating native directories/building. The Firebase configuration file is required in the native build; Firebase resources must be present before compiling the APK.

New Android installs register native FCM tokens directly. The Supabase worker sends through FCM v1 using `FIREBASE_SERVICE_ACCOUNT`; EAS and Expo Push Service are not required for this path. Legacy Expo tokens remain supported. Server credentials stay in Supabase, never in the APK or Vercel frontend.

Install on a physical Android phone, enable notifications in Settings, and verify: check-in warning, due reminder, project deadline warning, and a founder notification from another account. Delivery is best-effort and depends on permissions, network, and Android background behavior.
