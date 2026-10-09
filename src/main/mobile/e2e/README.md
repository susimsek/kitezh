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

The repository has the fixture contract test and Expo config. Device builds remain a manually
triggered CI concern; until an Android/iOS run completes, the native E2E item remains **In
progress** and must not be reported as a passing device test.

The first device flows are checked in under `e2e/maestro/`:

- `cold-start.yaml` verifies a clean native launch, the public shell, and the sign-in boundary.
- `settings-locale-theme.yaml` verifies native settings navigation and Turkish/light-dark controls.

The manually triggered `.github/workflows/mobile-native-e2e.yml` workflow provisions an Android
emulator and an iOS simulator, creates the Expo native projects, starts Metro, installs the
development build, and runs both flows. It is intentionally separate from push/PR CI because the
native runners are slower and the authenticated fixture is not part of the smoke slice yet.

Run them only against an Expo development build with the `io.github.susimsek.kitezh.mobile`
package ID:

```bash
pnpm exec expo prebuild --non-interactive
pnpm exec expo run:android
maestro test e2e/maestro
```

These flows deliberately avoid real credentials and token-bearing callbacks. The native workflow
starts the fixture server without exposing its runtime token values. Authenticated, offline,
timeout, refresh, and deep-link flows still require a completed Android/iOS device run before they
can be marked complete.

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
