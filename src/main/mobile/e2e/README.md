# Native mobile E2E contract

Mobile native E2E uses a local Expo development build and Maestro. Expo web export and browser
Playwright runs are not native E2E evidence. The development build must use the package IDs from
`app.json` (`io.github.susimsek.kitezh.mobile`) and the `kitezh://` scheme.

## Required fixture boundary

The fixture server must provide deterministic responses for the public API, mobile account client,
PKCE callback, refresh, logout, 401, 403, timeout, and offline cases. Test credentials and tokens
are injected by the fixture runner only; they are never committed, logged, or stored in the app
bundle. A fixture must use a dedicated mobile client and SecureStore namespace so an E2E run cannot
reuse a desktop or browser session.

## Required flow matrix

The first CI slice must cover:

1. cold start to the native sign-in screen and duplicate-action prevention;
2. system-browser callback, refresh, logout, and restart-safe signed-out state;
3. protected account navigation with 401 refresh, 403 forbidden, offline, timeout, empty, and
   validation states;
4. `kitezh://verify-email` and OAuth callback deep links on a cold and already-open app;
5. Turkish/English and system/light/dark persistence, including a large-text accessibility pass;
6. native notice announcement, dismiss, and auto-dismiss behavior.

The repository currently has the contract/unit checks and Expo config, but no installed Maestro
runner, device build, or deterministic fixture server. Until those are supplied by CI, the native
E2E item remains **In progress** and must not be reported as a passing device test.

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

These flows deliberately avoid real credentials and token-bearing callbacks. Authenticated,
offline, timeout, refresh, and deep-link flows still require the deterministic fixture server and
an Android/iOS device runner before they can be marked complete.
