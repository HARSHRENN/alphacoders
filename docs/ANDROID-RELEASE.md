# Android release 1.2.1

This release adds invite-first team signup, a separate founder login entry, and separate Date and Time inputs to the simplified three-tab app. It uses the live Firebase/Supabase backend. Android version code 4 upgrades the version-code-3 APK using the existing signing identity.

The APK was built locally using the owner’s approved local-build method. Expo regenerated the native project from app configuration and the original key signed the release. Binary verification, installation over the previous release, and a cold launch passed on the API 36.1 emulator with no app-scoped fatal or React Native errors. Version, signing certificate, SHA-256, size, and source commit are recorded in `releases/android-release.json`.

For future cloud builds, use the following process.

## Build and verify

1. Authenticate the workspace with `npx eas-cli@latest login --device`.
2. Create/link the Expo project with `npx eas-cli@latest init` and retain its project ID in the app configuration.
3. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npx expo-doctor`.
4. Inspect the upload with `npx eas-cli@latest build:inspect --platform android --profile release --stage archive --output /private/tmp/alphacoders-release-archive`. It must omit generated native directories, distribution APKs, local environment files, and server/signing secrets. EAS separately uses the ignored local Android signing credentials; `google-services.json` contains the required public Android Firebase resources.
5. Run `npx eas-cli@latest build --platform android --profile release --freeze-credentials --non-interactive --wait`.
6. Download the resulting APK and run `node scripts/publish-android-release.mjs /absolute/path/to/download.apk --build-id=BUILD_ID`. This checks signature continuity, release version, forbidden permissions, embedded current app code, backend URL, and native Firebase resources before replacing the hosted release. It writes the APK checksum and matching metadata.
7. Publish the verified `releases/` files through the existing GitHub/Vercel deployment. Verify the public APK checksum and `/downloads/build.json` after deployment.

The build uses Expo Continuous Native Generation from app configuration. Never hand-edit the generated Android directory or distribute private signing credentials. Do not enable automatic Play Store submission for this direct-install APK.

## Phone acceptance before broad rollout

These checks require actual phones and have not been signed off merely because an APK compiles:

- Upgrade an existing installation, launch without a development computer, sign in, and reload the same workspace.
- Use a founder phone and a member phone on different networks. The founder has no personal timer; the member can start/stop work. Confirm the founder sees the member’s saved hours and updates with completed work, remaining work, and finish time.
- Close/reopen the member app with a running timer. Confirm it continues; stopping and signing out save time once, including after a temporary connection failure.
- Grant Android notification permission and test background/locked-screen check-in warnings, due reminders, deadline warnings, and founder update alerts. Founders receive team/deadline alerts rather than personal check-in reminders.
- Confirm another workspace cannot read the team’s projects, work updates, or logged hours.

Use a small internal rollout after these tests pass. A signed binary and automated tests alone are not a production-readiness certification.
