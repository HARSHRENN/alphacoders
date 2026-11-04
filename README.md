# alphacoders — your team, in sync

An Android-first React Native + Expo app for recurring work check-ins, multiple projects, and founder visibility. Includes a responsive web preview of the same React Native components.

**Status:** The APK and frontend are built, with no demo mode. Live account creation and shared data require a configured backend. The current code targets Supabase; the proposed Neon migration is not implemented yet. Importing this repository into Vercel alone does not enable live accounts.

## Try it locally

Use **Node 24 LTS** (`nvm use`, if you use nvm). Expo SDK 58 does not list Node 25 as supported.

```sh
npm ci
npm run dev
```

Open http://localhost:8081. With no configured server, the app shows the company-workspace connection screen. After a real server is connected, sign in or create an account. New workspaces contain no projects or work updates until real users create them. There is no demo mode or sample-data fallback.

For Android UI development, use `npm run android` with a compatible emulator or phone. For native notification testing use a development build, not Expo Go. SDK 58 development builds are recommended; see [Expo setup](https://docs.expo.dev/get-started/set-up-your-environment/).

## Included features

- Polished forest-green and sage interface, responsive cards, phone bottom navigation, desktop sidebar, accessible button labels, empty states, and validation.
- Individual email/password accounts, invite-code workspace joining, founder/member permissions, and co-founder promotion.
- Multiple simultaneous projects with descriptions, priorities, colors, deadlines, search, archive/restore, and progress.
- One- or two-hour reporting periods: completed work, remaining work, blockers, percentage complete, and expected completion date/time.
- Attributed update feed, filters by project/person/time/blocker, and append-only revision history.
- Founder overview of today’s updates, team check-ins, active projects, and current blockers.
- Shareable daily text report through the system share sheet.
- Configurable one-/two-hour reminder cadence, check-in notifications, five-minute check-in warnings, and five-minute project deadline warnings for opted-in workspace members.
- Server push jobs for founders when another teammate publishes or revises an update.
- Realtime cloud refresh with a 30-second polling fallback and pull-to-refresh.
- Native sessions use Expo SecureStore. Browser preview sessions use sessionStorage.

Project progress is the average of each contributor’s **latest reported percentage**, not a task-weighted measure. All workspace members can see all workspace projects and updates. Each account belongs to one workspace. The main feed currently loads the latest 1,000 updates; reporting and metrics use that loaded history. Project-specific assignments, attachments, chat, and offline cloud submission queues are not implemented.

## Internet-connected APK and hosting

See [cloud deployment status and instructions](docs/CLOUD-DEPLOYMENT.md). The selected hosting stack is Vercel + Supabase + Firebase for this personal, non-commercial project. The APK has a company-workspace URL setup screen and caches public cloud configuration. It does not need the same Wi-Fi as the development computer. Native Android push also requires Firebase resources in the APK and Expo/FCM project credentials.

## Connect live accounts and team data

1. Create a Supabase project and enable email/password authentication. Keep email confirmation enabled and configure your email sender for real team use.
2. Apply `supabase/migrations/202611040001_pulse.sql` to a fresh database through the Supabase SQL editor or Supabase CLI migrations. This creates tables, policies, RPCs, revision checks, realtime publication entries, and the push-job outbox.
3. Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to your project's URL and **publishable/anon** key. Never put a service-role credential in the app.
4. Restart Expo. Create an account, confirm your email, sign in, and create a workspace. Its creator becomes a founder.
5. In Team, share the workspace invite code. Teammates create their own accounts, sign in, and choose Join team. To add another founder, choose **Make co-founder** and confirm access. They keep their own credentials.

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

Set the public Supabase/EAS values and `GOOGLE_SERVICES_JSON` in the EAS environment for the build profile. A build configured with no backend values opens the workspace connection screen. `npm run build:android` exports the JS/Hermes bundle; **it does not create an APK**. A locally signed release APK is available at `artifacts/alphacoders.apk`. It has a workspace URL setup screen, but live cloud services are not deployed yet and Firebase configuration is not included in this build. No Play Store release has been generated.

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

Browser verification covers demo form validation, publishing updates, project creation/search, reminder preferences, member role controls, revision history, and persistence. Native Android push delivery and live Supabase authentication require your configured services and a physical device and have not been verified here.

Source: `src/app/` (Expo Router routes and root providers), `App.tsx` (shell), `src/Screens.tsx` (screens), `src/components/` (shared UI/forms), `src/store.tsx` (state and cloud operations), `src/lib/notifications.ts` (device notification setup), `supabase/` (backend and scheduler).
