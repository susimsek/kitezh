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
- `account-notifications.yaml`: load notifications, mark one read, and verify the unread count.
- `admin-policy-save.yaml`: edit CIBA and offline-access policy values and verify API read-back.
- `admin-settings-groups.yaml`: verify native server information, add a group member, save/read back
  event retention, and verify the Admin login, CIBA, offline-access, SMTP, and localization settings
  surfaces load.

The iOS flows above passed locally on an iPhone 17 Pro Simulator running iOS 26.5. Android device
E2E is outside the requested verification scope; Android build/config and fixture tests remain
available. OAuth replay, device refresh races, offline/timeout recovery, full accessibility and
VoiceOver acceptance and real-provider social-link return remain open. These gaps keep the broad
device E2E gate in progress.

## Running on macOS

Use an installed development build with the `io.github.susimsek.kitezh.mobile` package ID. The
iOS background runner uses `simctl` and `xcodebuild` without opening or foregrounding Simulator.app.
It can run all flows or a focused selection:

```bash
bash e2e/run-ios-background.sh
MAESTRO_FLOWS=admin-settings-groups,admin-policy-save bash e2e/run-ios-background.sh
```

The Android runner expects a booted emulator and uses `10.0.2.2` for Metro and the local fixture:

```bash
bash e2e/run-android-background.sh
```

Device E2E is run manually and is not part of the regular CI quality gate or release workflow.
The regular mobile quality gate runs unit/API/component coverage, typecheck, lint, Expo config,
native-boundary, and security checks.
