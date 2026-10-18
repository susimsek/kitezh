# Native mobile E2E

Mobile device E2E uses the Expo development build and Maestro. It tests the native iOS/Android
application and does not use the Web renderer. Keep fixture credentials and tokens runtime-only;
never print them or include them in the app bundle.

## Fixture

`fixture-server.mjs` provides deterministic OIDC discovery, browser authorization callback, token
refresh/logout, account and Admin APIs, and controlled error responses. Account and Admin fixtures
use separate clients and SecureStore namespaces. Fixture tokens are fixed test-only values so an
iOS Keychain entry surviving `clearState` remains valid across fixture restarts; these values are
not accepted by the real application server.

Run the fixture contract tests with `pnpm run test:fixture`.

## Maestro flows

- `cold-start.yaml`: native cold start, app branding, and the signed-out route.
- `settings-locale-theme.yaml`: English/Turkish and system/light/dark settings with persistence.
- `deep-links.yaml`: email verification and password-reset links on cold and warm launches.
- `authenticated-fixture.yaml`: system-browser PKCE sign-in, Account navigation, CIBA approve/deny,
  MFA setup, state- and PKCE-bound social-account linking through the system browser, and sign-out.
- `account-profile.yaml`: edit a dynamic profile attribute and verify persistence after process
  restart.
- `account-personal-access-tokens.yaml`: create a no-expiration MCP token, verify one-time reveal,
  clipboard confirmation, hide, and confirmed revocation on the native Account security screen.
- `account-notifications.yaml`: load notifications, mark one read, and verify the unread count.
- `admin-policy-save.yaml`: edit CIBA and offline-access policy values and verify API read-back.
- `admin-settings-groups.yaml`: verify native server information, add a group member, save/read back
  event retention, and verify the Admin login, CIBA, offline-access, SMTP, and localization settings
  surfaces load.

The shared Maestro flows passed locally on an iPhone 17 Pro Simulator running iOS 26.5. Historical
Android evidence includes an earlier pass on `Medium_Phone_API_37.0`, a 2026-10-10 rerun blocked when
ADB stopped responding, and an Android 16 Pixel 7 emulator pass of `oauth-lifecycle.yaml` on
2026-10-17. Android E2E was outside the most recent verification scope. The repository currently
has no `.github/workflows/mobile-native-e2e.yml`; device E2E is run manually, while the regular
mobile quality gate runs unit/API/component coverage, typecheck, lint, Expo config, native-boundary,
and security checks. The release workflow packages the validated tagged source without rerunning the
E2E suite. OAuth replay, device refresh races, offline/timeout recovery, VoiceOver and dynamic-type
acceptance, and real-provider social-link return remain open, so the broad device E2E gate is in
progress.

## Running on macOS

Use an installed development build with the `io.github.susimsek.kitezh.mobile` package ID. The
iOS background runner uses `simctl` and `xcodebuild` without opening or foregrounding Simulator.app.
It can run all flows or a focused selection:
The authenticated flow conditionally accepts iOS's first-run confirmation when the local fixture
domain opens for sign-in and logout; Android has no corresponding prompt. It taps the fixture account
link before waiting for the native callback. Run it on a clean simulator because `clearState` does
not erase iOS Keychain credentials; erase the simulator and reinstall the development build for a
local reset.

Additional shared flows cover:

- `discovery-unavailable.yaml` and `discovery-timeout.yaml`: injected one-request discovery failures,
  localized error display, and retry. The runner resets the fixture mode before each flow.
- `oauth-lifecycle.yaml`: browser cancellation feedback, a fresh sign-in attempt, and fixture callback.
- `session-lifecycle.yaml`: SecureStore hydration after restart and logout persistence after a second
  restart.
- `mfa-required-actions.yaml`: native-to-system-browser MFA and required-action continuation with
  callback into the native Account Console; fixture tests cover rejected/accepted values, single-use
  challenge consumption, and PKCE state preservation.
- `account-mfa.yaml`: authenticated TOTP setup, rejected and accepted enrollment codes,
  reauthentication after enabling MFA, and recovery-code generation.
- `passkey-login-attempt.yaml`: native authenticator cancellation/failure recovery. The fixture
  rejects synthetic assertions, so successful WebAuthn authentication still requires the real server
  verifier and an enrolled test credential.

Both background runners use the same flow files. The Android runner expects a booted emulator and
uses `10.0.2.2` for Metro and the fixture; the iOS runner uses `simctl` and `xcodebuild` without
foregrounding Simulator.app. The iOS runner supports `MAESTRO_FLOWS` for a focused selection.

```bash
bash e2e/run-ios-background.sh
MAESTRO_FLOWS=admin-settings-groups,admin-policy-save bash e2e/run-ios-background.sh
```

The Android runner expects a booted emulator and uses `10.0.2.2` for Metro and the local fixture:

```bash
bash e2e/run-android-background.sh
```

These flows deliberately avoid real credentials and token-bearing callbacks. The fixture uses
fixed test-only tokens and generated callback values, and it does not print them. The authenticated fixture flow passed on
the Android 16 Pixel 7 emulator against the current Metro bundle, including browser callback, profile
load, CIBA approve/deny, MFA setup screen, and logout; it has also passed on iPhone 17 Pro simulator
for browser callback, profile load, and logout. The Android run used an installed 2026-10-09
development build because a clean Windows Gradle/CMake rebuild failed in Ninja. The discovery
outage and timeout flows switch the fixture to a one-request failure before launching the app,
assert the localized error, retry discovery, then continue into the fixture authorization page. The
fixture resets to normal discovery after the injected response. On Windows, the Android 16 Pixel 7 emulator passed `oauth-lifecycle.yaml` against the local fixture issuer: browser handoff, Custom Tab close/cancel, retry, fixture callback, Account Console, and fixture-user assertions. The fixture issuer is exposed to the emulator at `10.0.2.2:8082`; Metro must bundle with `EXPO_PUBLIC_AUTHORIZATION_SERVER_ISSUER=http://10.0.2.2:8082`. OAuth callback
resume/replay, offline, refresh, and accessibility flows still require additional coverage before
the broad E2E gate is complete.

OAuth callbacks are validated by the shared native contract before code exchange: the callback must
contain the original state and use the registered `kitezh://` redirect host/path. A browser result
with a missing, stale, or mismatched state is rejected without exchanging the code.

Android intent filters cover the OAuth callback, logout callback, email verification, and password
reset routes. `parseNativeDeepLink` accepts only those registered `kitezh://` hosts and rejects
web URLs or missing action tokens before navigation.

The mobile CI also runs `pnpm run check:security`, which rejects diagnostic logging and token-bearing
URLs in native source. Runtime diagnostics must expose only a stable error category; credentials,
authorization codes, and personally identifying values stay out of logs.

The Android 16 Pixel 7 MFA flow also passed against a local Spring Boot development auth server:
the acceptance covered TOTP enrollment and verification, a server-assigned required action, PKCE
state/code exchange, and the Account API. This local dev-profile acceptance does not represent a
production deployment check.

`account-mfa.yaml` is checked into both background runners, but passkey physical-device acceptance
remains open. The mobile app currently implements passkey sign-in and passkey enrollment for native
login required actions; Account Security does not yet expose an authenticated passkey enrollment
flow, and the local fixture has no WebAuthn relying-party challenge/attestation verifier. Adapter
and API-contract unit tests do not substitute for authenticating a platform passkey on a device.

Validate the fixture contract locally with:

```bash
pnpm run test:fixture
```
