# alphacoders — your team, in sync

An Android-first React Native + Expo app for recurring work check-ins, multiple projects, and founder visibility. Includes a responsive web preview of the same React Native components.

**Status:** Firebase email/password signup and the Supabase Firebase integration are enabled. All five database migrations, the account-access function, notification worker, and minute-by-minute cron schedule are deployed. The signed APK includes public Firebase/Supabase configuration and native Android FCM resources, with no demo data. The replacement server-only Firebase credential is saved, and the scheduled worker returns HTTP 200 with an empty queue. Real signup, email verification, founder workspace creation, and cloud reload have passed. The replacement Firebase service account has the approved three-permission backend role. Project/update form validation and empty screens are verified with no sample records created. Cross-phone updates and Android notification delivery still need device testing.

## Use the hosted app

Web app: https://alphacoders-six.vercel.app. Android download: https://alphacoders-six.vercel.app/downloads/alphacoders.apk. Sign in with your verified account; teammates sign up and join using the workspace invite code. The hosted app and standalone APK use Firebase/Supabase directly and do not require Metro or the development computer. The downloadable APK is the earlier release; build a new APK through EAS to include the latest UI and work-time tracking. Android notification delivery still needs a physical-device check.

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
- Founder visibility into team projects, work updates, help requests, and logged work time.
- Start work / Stop work controls with a running session timer, daily totals, and server-timestamped session history. Clocking out is separate from account sign-in; signing out stops any running session first.
- Members can read their own time records; founders can review workspace members’ work and time for today, the last 7 days, or the last 30 days. Repeated starts/stops are safe across devices. App clients cannot forge, overwrite, or delete time records.
- Shareable daily text report including work updates, time totals, and start/stop records through the system share sheet.
- Configurable one-/two-hour reminder cadence, check-in notifications, five-minute check-in warnings, and five-minute project deadline warnings for opted-in workspace members.
- Server push jobs for founders when another teammate publishes or revises an update.
- Realtime cloud refresh with a 30-second polling fallback and pull-to-refresh.
- Firebase native sessions persist using AsyncStorage. Browser preview sessions use session storage. Passwords are handled by Firebase Authentication.

Project progress is the average of each contributor’s **latest reported percentage**, not a task-weighted measure. All workspace members can see all workspace projects and updates. Each account belongs to one workspace. The main feed currently loads the latest 1,000 updates; reporting and metrics use that loaded history. Project-specific assignments, attachments, chat, and offline cloud submission queues are not implemented.

## Internet-connected APK and hosting

See [cloud deployment status and instructions](docs/CLOUD-DEPLOYMENT.md). The Android app connects directly to Supabase, with Firebase-backed Android notifications. The web dashboard is hosted on the owner’s Vercel project at https://alphacoders-six.vercel.app. Backend connection details are configured at build time; team members never enter a hosting URL. It does not need the same Wi-Fi as the development computer. Native Android push uses Firebase resources in the APK and a server-only FCM credential in Supabase.

## Connect live accounts and team data

1. Enable Firebase Authentication's Email/Password provider. Register a Firebase web SDK client (the same JS SDK supports Android) and configure the four `EXPO_PUBLIC_FIREBASE_*` values from `.env.example`. This project uses `alphacoders-593b1`.
2. Apply all five migrations in order from `supabase/migrations/`. The second preserves application UUIDs and maps Firebase string UIDs through a private identity table. It requires a verified email and pins the Firebase issuer/audience to this project's ID. For another Firebase project, update that ID in the second migration and the `firebase-access` server function before deploying.
3. Add Firebase as a Third-Party Auth provider in Supabase using your Firebase project ID. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the public URL and **publishable/anon** key. Never put service-role or Firebase private keys in app configuration.
4. Deploy `supabase/functions/firebase-access/index.ts` with `verify_jwt=false`. It independently verifies Google's Firebase JWT signature, issuer, audience, expiry and email status, checks the account is enabled, and assigns only the database `authenticated` claim. Store the Firebase service-account JSON in Supabase Edge Function Secrets as `FIREBASE_SERVICE_ACCOUNT`. For both backend functions, grant only `firebaseauth.users.get`, `firebaseauth.users.update`, and `cloudmessaging.messages.create` to the current service-account identity. A recreated account with the same email does not inherit grants bound to a deleted account. The token requests the Authentication and service-account email scopes used by the Firebase Admin SDK. Its credential stays server-only. Firebase's default verification and reset emails require no separate SMTP provider.
5. Restart Expo. Create a real account, confirm your email, and tap **I verified my email**. Create a workspace; its creator becomes a founder.
6. In Team, share the workspace invite code. Teammates create their own accounts, verify their email, sign in, and choose Join team. To add another founder, choose **Make co-founder** and confirm access. They keep their own credentials.

Database policies enforce workspace boundaries, founder-only project creation/archival/promotion, self-only preference changes, and self-authored updates. Original updates cannot be overwritten or deleted by the app. A revision must reference the same author's update in the same project, and each update can be revised once; further edits revise the newest revision.

## Enable real Android push notifications

Remote push requires an installed Android build, a physical phone, and Firebase FCM v1 credentials on the backend. This app registers native FCM tokens directly; an EAS project and Expo Push Service are not required for new installs. Expo Go does not support this flow.

1. Register the Firebase Android app with package `com.pulseteam.app` (or change the package in `app.config.ts` before registering). Download `google-services.json`; point `GOOGLE_SERVICES_JSON` to its local path or use a file environment variable for cloud builds. The file is ignored by Git.
2. Save the Firebase service-account JSON as the server-only Supabase Edge Function secret `FIREBASE_SERVICE_ACCOUNT`. It needs Firebase Authentication user read/update access for account claims and Firebase Messaging send access for push. Never put it in Git, app environment variables, or the APK. Revoke any exposed key before saving a replacement.
3. Apply the migrations, deploy the functions, and install the schedule below.
4. Build and install the app. In Settings, enable work update notifications, select the cadence, and grant Android notification permission. Each Android device registers its own FCM token. Founders should enable notifications too.

```sh
# Sign in, then build a signed installable APK in the cloud
npx eas-cli@latest login --device
npx eas-cli@latest build --platform android --profile release
```

Set the public Firebase/Supabase values and `GOOGLE_SERVICES_JSON` in the build environment. A build missing backend configuration opens the server-setup-pending screen. `npm run build:android` exports the JS/Hermes bundle; **it does not create an APK**. The locally signed APK at `artifacts/alphacoders.apk` includes the live public authentication settings and Android FCM resources. No Play Store release has been generated.

## Deploy the reminder worker

The server owns recurring reminders so they continue while the app is closed. The worker accepts only POST requests carrying a private, one-use invocation ticket. The database creates a random ticket each minute; only the service-role worker can consume it, and unused tickets expire after five minutes. No extra shared cron secret is required. Both functions enforce their own authentication with Supabase's legacy JWT gate disabled.

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
# Save FIREBASE_SERVICE_ACCOUNT privately in the Supabase dashboard.
npx supabase functions deploy firebase-access --no-verify-jwt
npx supabase functions deploy notify --no-verify-jwt
```

Run `supabase/schedule.sql` in the Supabase SQL editor after applying all migrations. For another project, update the function URL in the schedule. The schedule invokes the worker every minute with pg_cron + pg_net. See [Supabase scheduling docs](https://supabase.com/docs/guides/functions/schedule-functions).

- Check-ins stay anchored to the member's join time, rounded to a minute, at their selected interval; submitting an update does not move the next deadline.
- A warning is queued five minutes before each check-in; a due reminder is queued at the boundary. All opted-in workspace members receive project deadline warnings, including founders.
- Event keys prevent duplicate jobs across cron ticks. Workers lease jobs for two minutes, retry transient failures up to five attempts, and remove unregistered device tokens.
- The scheduler catches events up to four minutes late; outages longer than this can miss a scheduled warning. Push delivery is best-effort and can be delayed by Android, network conditions, or FCM. It is not an exact-alarm service.
- `notification_jobs.status = 'sent'` means accepted by FCM (or the legacy Expo gateway), or skipped for a disabled user/no token. It does **not** confirm handset delivery. Legacy Expo tokens remain supported; Expo receipts are not polled.
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
# Isolated server test: ephemeral keys and mocked Google APIs, no cloud records
npx --yes deno test --no-config --no-lock --node-modules-dir=none --allow-env=FIREBASE_SERVICE_ACCOUNT supabase/functions/firebase-access/index.test.ts
```

Automated tests execute the actual migration in embedded Postgres (PGlite): workspace isolation, role restrictions, authorship, revision integrity, founder notifications, check-in/deadline scheduling, deduplication, job leases, archival, and co-founder promotion. Domain tests cover date boundaries, progress aggregation, validation, daily reports, overnight time windows, breaks, and running-session totals. Work-session tests check idempotent start/stop, immutable timestamps, sign-out stopping semantics, and member/founder isolation.

Firebase migration tests additionally reject anonymous, unverified and wrong-project claims, enforce private UID mapping, prevent impersonation and cross-workspace reads, and preserve revision notifications and founder promotion. The server test executes the deployed handler with signed test identities and mocked Google APIs, checking admin scopes, self-only claim assignment, disabled accounts, auth-time revocation, and redacted provider failures. Browser verification covers Firebase-backed sign-in, signup and reset screens. The deployed access function rejects missing/forged tokens and wrong HTTP methods. The notification worker also rejects missing or invalid invocation tickets. Real signup and email verification have passed. Founder workspace creation and cloud reload have also passed. Two-phone shared updates and native Android push delivery still need device testing.

Source: `src/app/` (Expo Router routes and root providers), `App.tsx` (shell), `src/Screens.tsx` (screens), `src/components/` (shared UI/forms), `src/store.tsx` (state and cloud operations), `src/lib/notifications.ts` (device notification setup), `supabase/` (backend and scheduler).

## Work-time tracking

Team members use **Start work** on Home to begin a timed session. Use **Stop work** for a break or when finished. Each restart creates another saved session; the daily total excludes gaps between sessions. Closing the app keeps the session running. Signing out stops it on the server first; if that cannot be confirmed, sign-out stays blocked so the clock cannot silently continue.

In **Team → View work & time**, founders can see each person’s start/stop times, total hours, current working status, and work updates. Members can use **My history** for their own records. The UI supports today, 7-day, and 30-day windows; records are retained in the database. Times and day boundaries use the viewer’s local timezone, and overnight sessions are clipped to the selected dates. Work-update history in this view is subject to the feed’s existing 1,000-update load limit.

Apply `supabase/migrations/202611050001_work_sessions.sql` to existing projects before deploying this client. It is transactional and safe to retry. The server sets timestamps, permits only one open session per person, and never takes a user identity or clock value from the client. Start/stop requires an internet connection; failed requests must be retried.

### Founder and member roles

Founders supervise work: Home shows member check-ins, working members, team hours today, completed projects, and overdue projects. Team gives access to each member’s work and time. Founders have no personal work clock or posting prompt, and use ordinary **Sign out**. Only members use Start/Stop work and receive personal check-in reminders. Founder notifications still include team updates and project deadlines.

Apply `supabase/migrations/202611050002_member_work_clocks.sql` after the work-session migration. It enforces member-only starts on the server, ends legacy founder clocks without removing history, and stops a member’s active clock when promoted to founder. Team time totals and the time section of daily reports count current members only.

## Android 1.1.0 release preparation

The signed cloud release uses `eas.json` profile `release`, app version 1.1.0, and Android version code 2. It keeps the original package/signing identity for upgrades and excludes unused overlay/storage permissions. See [the Android release steps and phone acceptance checks](docs/ANDROID-RELEASE.md). The current download is not replaced until the new binary passes `scripts/publish-android-release.mjs`; source version changes alone never relabel the earlier APK as a new release.
