# Native mobile E2E contract

Mobile native E2E uses a local Expo development build and Maestro. Expo web export and browser
Playwright runs are not native E2E evidence. The development build must use the package IDs from
`app.json` (`io.github.susimsek.kitezh.mobile`) and the `kitezh://` scheme.

## Required fixture boundary

The fixture server must provide deterministic responses for the public API, mobile account client,
PKCE callback, refresh, logout, 401, 403, timeout, and offline cases. The checked-in
`e2e/fixture-server.mjs` supplies discovery, browser callback, refresh-compatible token, logout,
profile, and failure endpoints. Test credentials and tokens are generated at fixture startup; they
are never committed, logged, or stored in the app bundle. A fixture must use a dedicated mobile
client and SecureStore namespace so an E2E run cannot reuse a desktop or browser session.

## Required flow matrix

The first CI slice must cover:

1. cold start to the native sign-in screen and duplicate-action prevention;
2. system-browser callback, refresh, logout, and restart-safe signed-out state;
3. protected account navigation with 401 refresh, 403 forbidden, offline, timeout, empty, and
   validation states;
4. `kitezh://verify-email` and OAuth callback deep links on a cold and already-open app;
5. Turkish/English and system/light/dark persistence, including a large-text accessibility pass;
6. native notice announcement, dismiss, and auto-dismiss behavior.

The shared Maestro flows have passed on iPhone 17 Pro / iOS 26.5. An earlier local run passed all
four on Android `Medium_Phone_API_37.0`; the 2026-10-10 rerun could not complete after the emulator
stopped responding to ADB. The reusable `.github/workflows/mobile-native-e2e.yml` workflow runs the
same four flows on a headless iOS Simulator and Android Emulator for pull requests and main-branch
CI. Android device-level CI evidence remains pending until that workflow completes successfully.
The release workflow packages the tagged source after its PR/main CI validation and does not rerun
the full E2E suite. The flows cover cold start/branding, Turkish/light-dark settings, cold/warm
email-verification and password-reset deep links, and the fixture-backed system-browser callback,
profile, and logout. OAuth transaction resume/replay, offline, timeout, refresh, and accessibility
cases remain outstanding, so the broad native E2E gate remains **In progress**.

The API unit suite separately verifies transport-offline classification, request-timeout
classification, and one refresh retry after a 401. These tests do not count as device-level E2E
coverage for those states.

The first device flows are checked in under `e2e/maestro/`:

- `cold-start.yaml` verifies a clean native launch, the public shell, and the sign-in boundary.
- `settings-locale-theme.yaml` verifies native settings navigation and Turkish/light-dark controls.
- `deep-links.yaml` opens email-verification on cold start and password-reset while the app is open.
- `authenticated-fixture.yaml` drives the system-browser fixture callback, protected profile load,
  and sign-out return. It requires the fixture-backed native workflow.

The authenticated flow conditionally accepts iOS's first-run confirmation when the local fixture
domain is opened for sign-in and logout; Android has no corresponding prompt. It explicitly taps the
fixture account link in the system browser before waiting for the native callback. Run it on a clean
simulator because `clearState` does not erase iOS Keychain credentials. For a local reset, erase the
simulator and reinstall the development build before running the authenticated flow.

The reusable `.github/workflows/mobile-native-e2e.yml` provisions a headless iOS Simulator and a
headless Android Emulator, creates each Expo native project, starts Metro and the fixture, installs
the development build, and runs the same four flows. CI invokes it for pull requests and main; the
release workflow packages the already-validated tagged source without repeating the suite.

Run them only against an Expo development build with the `io.github.susimsek.kitezh.mobile`
package ID. On macOS, the iOS background driver uses `simctl` and `xcodebuild` without opening
Simulator.app. The Android background driver expects a booted emulator and uses the host's
`10.0.2.2` address for Metro and the local fixture. Both run the same flow files.

```bash
bash e2e/run-ios-background.sh
```

```bash
bash e2e/run-android-background.sh
```

These flows deliberately avoid real credentials and token-bearing callbacks. The fixture server
creates runtime-only credentials and does not print them. The authenticated fixture flow has passed
on the Android emulator and iPhone 17 Pro simulator, including browser callback, profile load, and
logout. CI now reruns the same flow set on both platforms. OAuth callback resume/replay, offline,
timeout, refresh, and accessibility flows still require additional coverage before the broad E2E
gate is complete.

OAuth callbacks are validated by the shared native contract before code exchange: the callback must
contain the original state and use the registered `kitezh://` redirect host/path. A browser result
with a missing, stale, or mismatched state is rejected without exchanging the code.

Android intent filters cover the OAuth callback, logout callback, email verification, and password
reset routes. `parseNativeDeepLink` accepts only those registered `kitezh://` hosts and rejects
web URLs or missing action tokens before navigation.

The mobile CI also runs `pnpm run check:security`, which rejects diagnostic logging and token-bearing
URLs in native source. Runtime diagnostics must expose only a stable error category; credentials,
authorization codes, and personally identifying values stay out of logs.

Validate the fixture contract locally with:

```bash
pnpm run test:fixture
```
