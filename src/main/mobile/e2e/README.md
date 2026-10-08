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
