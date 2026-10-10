# Kitezh Mobile

This is the React Native mobile client for Kitezh. It currently provides the native public shell,
account sign-in with Authorization Code + PKCE, SecureStore-backed session persistence, refresh,
OIDC logout, typed account profile read/update, password changes, active-session management, and
authorized application/offline-session management, shared Turkish/English theme and locale
controls. Settings can reset both preferences to the device defaults without changing web
preferences. It also includes TOTP MFA setup/verification, recovery-code generation, and account
deletion with password confirmation. Account adapters retry one unauthorized request after a secure
token refresh and expose localized loading/error states.

Social account status and unlinking are available natively; provider linking hands off to the
authorization server in the system browser.

Registration, forgot-password, reset-password, and email verification are native screens with
typed API adapters, localized validation, and inline progress states. Registration uses the
system browser only when CAPTCHA is enabled, because the CAPTCHA challenge is owned by the
authorization server. Email links can open the native `/verify-email?token=...` screen after the
app link or custom `kitezh://verify-email` redirect is registered. Social-provider linking still
uses the system browser until its native deep-link completion screen is added.

## Local development

```bash
pnpm install
pnpm start
```

Use an Expo development build for native OAuth, secure storage, passkeys, and custom deep links.
Expo Go is useful only for the initial visual shell. The mobile OAuth client and redirect URI must
be registered on the authorization server before the sign-in flow is enabled.

The native app consumes platform-neutral theme, locale, and icon contracts from
`src/main/shared`. React Native components remain native and do not import Bootstrap, Electron,
or browser storage code.

Set `EXPO_PUBLIC_AUTHORIZATION_SERVER_ISSUER` to use another issuer during development. The
default is `https://kitezh.onrender.com`. The authorization server must contain the public
`mobile-account-console` client with the `kitezh://oauth/callback` and `kitezh://logout/callback`
redirect URIs for Account. The native Admin client is deliberately separate:
`mobile-admin-console` uses the `admin-api` scope, the `kitezh://admin/oauth/callback` and
`kitezh://admin/logout/callback` redirects, and the `kitezh.mobile.admin.session` SecureStore
namespace. Set `EXPO_PUBLIC_MOBILE_ADMIN_CLIENT_ID` only when a deployment uses a different
registered client ID; never reuse the browser or Account client for Admin.

## Native release profiles and direct downloads

`eas.json` defines the supported build boundaries:

- `development` is a development client for local device and callback testing.
- `preview` is an internally distributed build for QA and acceptance evidence.
- `production` is the store build and increments the remote app version for each release.

The iOS bundle identifier and Android package are both
`io.github.susimsek.kitezh.mobile`. EAS owns platform signing credentials; credentials must stay
in the EAS project or CI secret store and must never be committed here. The runtime contract is
the app version, so a native store build cannot load an incompatible JavaScript bundle.

`mobile-release.yml` runs the iOS Maestro Simulator flows before packaging and adds direct-download
test builds to the same GitHub Release as the desktop packages. It builds an Android APK signed
with a stable release keystore and, by default, an unsigned iOS IPA for personal-device sideloading.
Android signing is configured in the GitHub Actions `mobile-release` environment
with `ANDROID_RELEASE_KEYSTORE_BASE64`, `ANDROID_RELEASE_KEYSTORE_PASSWORD`,
`ANDROID_RELEASE_KEY_ALIAS`, and `ANDROID_RELEASE_KEY_PASSWORD`. Keep a secure backup of that
keystore; replacing it prevents existing Android installs from accepting an in-place update.

Optional iOS distribution signing uses the same environment with
`IOS_DISTRIBUTION_CERTIFICATE_BASE64` (Apple Distribution `.p12`),
`IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`, `IOS_PROVISIONING_PROFILE_BASE64` (ad hoc profile), and
`IOS_TEAM_ID`. Set the environment variable `IOS_SIGNING_MODE` to `signed` and configure all four
secrets to produce a signed ad hoc IPA. It is currently `unsigned`, so the workflow produces an
unsigned IPA. Partial signing configuration fails before the Xcode build.

The iOS IPA is for testing, not App Store or TestFlight submission. The user signs it with a personal
Apple Account through AltStore or Sideloadly; free provisioning expires after seven days and needs
to be refreshed. Initial sideload setup requires a Mac or PC. These GitHub download builds do not
provide automatic mobile updates. The separate EAS production profile remains available for store
builds. Do not expose an OTA update channel until an EAS project, update URL, privacy disclosure,
staged rollout, and rollback owner are configured.

To roll back a store release, stop the rollout and promote the last compatible build; do not use an
OTA rollback to cross a native runtime boundary. Device builds must be validated on both Android
and iOS before a production submission.

GitHub Actions runs the mobile quality gate on every push and pull request through the
`mobile-quality` job in `.github/workflows/ci.yml`. It installs the locked dependencies and runs
type checking, linting, unit/contract tests, and the Expo web export. The iOS Maestro Simulator
flows run as a required job in `mobile-release.yml` before either package is built and published.
That workflow builds and attaches the APK and IPA after the desktop release completes, or can be
dispatched for an existing release tag. EAS store submissions and OTA updates are not triggered by
CI; they still require an EAS project,
signing credentials, rollout metadata, and an `EXPO_TOKEN`. No token or signing material belongs in
this repository.
