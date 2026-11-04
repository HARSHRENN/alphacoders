# alphacoders — your team, in sync

An Android-first React Native + Expo app for recurring work check-ins, multiple projects, and founder visibility. Includes a responsive web preview of the same React Native components.

**Status:** Firebase email/password signup is enabled, the Supabase Firebase integration is connected, and both database migrations are applied. The APK includes public Firebase and Supabase configuration, with no demo data. The deployed `firebase-access` function still needs its server-only Firebase credential before verified accounts can enter workspaces. First-account signup and physical-phone testing remain outstanding. Android push and the scheduled notification worker still need configuration.

## Try it locally

Use **Node 24 LTS** (`nvm use`, if you use nvm). Expo SDK 58 does not list Node 25 as supported.

```sh
npm ci
npm run dev
```

Open http://localhost:8081. With no configured server, the app shows the server-setup-pending screen. After a real server is connected, sign in or create an account. New workspaces contain no projects or work updates until real users create them. There is no demo mode or sample-data fallback.

For Android UI development, use `npm run android` with a compatible emulator or phone. For native notification testing use a development build, not Expo Go. SDK 58 development builds are recommended; see [Expo setup](https://docs.expo.dev/get-started/set-up-your-environment/).

## Included features

- Polished forest-green and sage interface, responsive cards, phone bottom navigation, desktop sidebar, accessible button labels, empty states, and validation.
- Firebase email/password signup and login, verification/resend controls, password reset, invite-code workspace joining, founder/member permissions, and co-founder promotion.
- Multiple simultaneous projects with descriptions, priorities, colors, deadlines, search, archive/restore, and progress.
- One- or two-hour reporting periods: completed work, remaining work, blockers, percentage complete, and expected completion date/time.
- Attributed update feed, filters by project/person/time/blocker, and append-only revision history.
- Founder overview of today’s updates, team check-ins, active projects, and current blockers.
- Shareable daily text report through the system share sheet.
- Configurable one-/two-hour reminder cadence, check-in notifications, five-minute check-in warnings, and five-minute project deadline warnings for opted-in workspace members.
- Server push jobs for founders when another teammate publishes or revises an update.
- Realtime cloud refresh with a 30-second polling fallback and pull-to-refresh.
- Firebase native sessions persist using AsyncStorage. Browser preview sessions use session storage. Passwords are handled by Firebase Authentication.

Project progress is the average of each contributor’s **latest reported percentage**, not a task-weighted measure. All workspace members can see all workspace projects and updates. Each account belongs to one workspace. The main feed currently loads the latest 1,000 updates; reporting and metrics use that loaded history. Project-specific assignments, attachments, chat, and offline cloud submission queues are not implemented.

## Internet-connected APK and hosting

See [cloud deployment status and instructions](docs/CLOUD-DEPLOYMENT.md). The Android app connects directly to Supabase, with Firebase-backed Android notifications. Vercel is optional for the web dashboard. Backend connection details are configured at build time; team members never enter a hosting URL. It does not need the same Wi-Fi as the development computer. Native Android push also requires Firebase resources in the APK and Expo/FCM project credentials.

## Connect live accounts and team data

1. Enable Firebase Authentication's Email/Password provider. Register a Firebase web SDK client (the same JS SDK supports Android) and configure the four `EXPO_PUBLIC_FIREBASE_*` values from `.env.example`. This project uses `alphacoders-593b1`.
2. Apply both migrations in order from `supabase/migrations/`. The second preserves application UUIDs and maps Firebase string UIDs through a private identity table. It requires a verified email and pins the Firebase issuer/audience to this project's ID. For another Firebase project, update that ID in the second migration and the `firebase-access` server function before deploying.
3. Add Firebase as a Third-Party Auth provider in Supabase using your Firebase project ID. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the public URL and **publishable/anon** key. Never put service-role or Firebase private keys in app configuration.
4. Deploy `supabase/functions/firebase-access/index.ts` with `verify_jwt=false`. It independently verifies Google's Firebase JWT signature, issuer, audience, expiry and email status, checks the account is enabled, and assigns only the database `authenticated` claim. Store the Firebase service-account JSON in Supabase Edge Function Secrets as `FIREBASE_SERVICE_ACCOUNT`. It needs `firebaseauth.users.get` and `firebaseauth.users.update`. Its credential stays server-only. Firebase's default verification and reset emails require no separate SMTP provider.
5. Restart Expo. Create a real account, confirm your email, and tap **I verified my email**. Create a workspace; its creator becomes a founder.
6. In Team, share the workspace invite code. Teammates create their own accounts, verify their email, sign in, and choose Join team. To add another founder, choose **Make co-founder** and confirm access. They keep their own credentials.

Database policies enforce workspace boundaries, founder-only project creation/archival/promotion, self-only preference changes, and self-authored updates. Original updates cannot be overwritten or deleted by the app. A revision must reference the same author's update in the same project, and each update can be revised once; further edits revise the newest revision.

## Enable real Android push notifications

Remote push requires an installed Android development or preview build, a physical phone, an Expo/EAS project, and Firebase FCM v1 credentials. Expo Go does not support remote Android notifications. Follow the official [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) and [FCM credentials guide](https://docs.expo.dev/push-notifications/fcm-credentials/).

1. Link an EAS project using `npx eas-cli@latest init`. Set `EXPO_PUBLIC_EAS_PROJECT_ID` in `.env.local` and in the EAS build environment to that project's ID. This app config reads that environment variable explicitly.
2. Create a Firebase Android app for `com.pulseteam.app` (or change the package in `app.config.ts` before registering). Download `google-services.json`; point `GOOGLE_SERVICES_JSON` to its local path, or use an EAS file environment variable for cloud builds. The file is ignored by Git.
3. Configure your FCM v1 service account in EAS credentials. Keep that private service-account key on the server/EAS, never in the app bundle.
4. Deploy the notification worker described below.
5. Build and install the app. In Settings, enable work update notifications and choose the cadence. Grant Android notification permission. Each device registers its Expo push token. Founders should enable notifications too.

```sh
# Development build, with native notification support
npx eas-cli@latest build --platform android --profile development
npx expo start --dev-client

# Installable preview APK
npx eas-cli@latest build --platform android --profile preview
```

Set the public Firebase/Supabase/EAS values and `GOOGLE_SERVICES_JSON` in the EAS environment for the build profile. A build missing backend configuration opens the server-setup-pending screen. `npm run build:android` exports the JS/Hermes bundle; **it does not create an APK**. The locally signed APK at `artifacts/alphacoders.apk` includes the live public authentication settings. Native Android FCM resources are not included yet. No Play Store release has been generated.

## Deploy the reminder worker

The server owns recurring reminders so they continue while the app is closed. The included Supabase Edge Function accepts only POST requests with the `x-cron-secret` header. Its platform JWT gate is disabled because cron uses a separate server-only shared secret; the function enforces that secret itself.

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set CRON_SECRET=YOUR_RANDOM_32_BYTE_SECRET
# Optional: if Expo push access-token security is enabled for your EAS project
npx supabase secrets set EXPO_ACCESS_TOKEN=YOUR_EXPO_SERVER_ACCESS_TOKEN
npx supabase functions deploy notify
```

Replace the placeholders in `supabase/schedule.sql` and run it in the Supabase SQL editor. Use the **same** random CRON_SECRET in Vault and function secrets. This invokes the worker every minute with pg_cron + pg_net. See [Supabase scheduling docs](https://supabase.com/docs/guides/functions/schedule-functions).

- Check-ins stay anchored to the member's join time, rounded to a minute, at their selected interval; submitting an update does not move the next deadline.
- A warning is queued five minutes before each check-in; a due reminder is queued at the boundary. All opted-in workspace members receive project deadline warnings, including founders.
- Event keys prevent duplicate jobs across cron ticks. Workers lease jobs for two minutes, retry transient failures up to five attempts, and remove tokens rejected as DeviceNotRegistered.
- The scheduler catches events up to four minutes late; outages longer than this can miss a scheduled warning. Push delivery is best-effort and can be delayed by Android, network conditions, or FCM. It is not an exact-alarm service.
- `notification_jobs.status = 'sent'` means accepted by the Expo gateway or skipped for a disabled user/no token; it does **not** confirm handset delivery. This initial worker does not poll Expo push receipts. Monitor job failures and add receipt tracking before a large rollout.
- Retries are at-least-once; a partial multi-device failure can repeat an already accepted push. There is no exactly-once handset delivery guarantee.
- Signing out removes registered tokens for that account and cancels legacy local preview schedules.

## Verify

```sh
npm run typecheck
npm run lint
npm test
npm run format:check
npm run build:web
npm run build:android
```

Automated tests execute the actual migration in embedded Postgres (PGlite): workspace isolation, role restrictions, authorship, revision integrity, founder notifications, check-in/deadline scheduling, deduplication, job leases, archival, and co-founder promotion. Domain tests cover date boundaries, progress aggregation, validation, and daily reports.

Firebase migration tests additionally reject anonymous, unverified and wrong-project claims, enforce private UID mapping, prevent impersonation and cross-workspace reads, and preserve revision notifications and founder promotion. Browser verification covers Firebase-backed sign-in, signup and reset screens. The deployed access function rejects missing/forged tokens and wrong HTTP methods. Real account signup, two-phone shared updates, and native Android push delivery have not been verified end-to-end.

Source: `src/app/` (Expo Router routes and root providers), `App.tsx` (shell), `src/Screens.tsx` (screens), `src/components/` (shared UI/forms), `src/store.tsx` (state and cloud operations), `src/lib/notifications.ts` (device notification setup), `supabase/` (backend and scheduler).
