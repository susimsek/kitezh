# Kitezh Mobile

This is the React Native mobile client for Kitezh. It currently provides the native public shell,
native username/password sign-in using a server-issued Authorization Code + PKCE transaction,
SecureStore-backed session persistence, refresh,
OIDC logout, typed account profile read/update, password changes, active-session management, and
authorized application/offline-session management, shared Turkish/English theme and locale
controls. Settings can reset both preferences to the device defaults without changing web
preferences. It also includes TOTP MFA setup/verification, recovery-code generation, and account
deletion with password confirmation. Account adapters retry one unauthorized request after a secure
token refresh and expose localized loading/error states.

The Account Console keeps profile, security, applications, and settings in a native bottom tab
bar. The Admin Console keeps Dashboard, Users, and Clients on its compact bottom tab bar; the
localized “More” sheet opens the remaining administration sections without a horizontally clipped
navigation strip. Account data routes require an Account session, while Settings stays available
before sign-in for device preferences. Admin routes use their isolated Admin session.

Social account status and unlinking are available natively; provider linking hands off to the
authorization server in the system browser.

Login MFA and supported required actions use native challenge screens. This includes TOTP setup
with its server-generated QR/secret, recovery-code display, profile/password updates, terms
acceptance, explicit confirmations, and passkey enrollment. Native passkey sign-in and enrollment
use the iOS/Android system credential manager and the server's transaction-bound WebAuthn API.
Configured social providers and social-account linking
use the native provider SDK or an external provider flow. Login and registration generate
platform-bound action tokens with Google's native reCAPTCHA Enterprise SDK when server CAPTCHA is
enabled. Registration, forgot-password, reset-password, email verification, and email-change
confirmation are native screens with typed API adapters, localized validation, and inline progress
states. Email links for `kitezh.onrender.com/verify-email`, `/confirm-email`, and `/reset-password` are
configured as verified Android App Links and iOS Universal Links. The server publishes the checked-in
Android release fingerprint by default; override `APP_ANDROID_SHA256_CERT_FINGERPRINT` to match the
certificate used to sign the deployed app. Configure `APP_IOS_TEAM_ID` on the server to publish the
iOS association file.
Set `WEBAUTHN_ALLOWED_ORIGINS` to include the issuer origin and each Android
`android:apk-key-hash:<base64url SHA-256 signing certificate>` origin used by the app; debug and
release builds can have different signing origins. The `kitezh://` scheme remains available for
OAuth browser callbacks. Social-provider linking still
uses the system browser until its native deep-link completion screen is added.

### Native CAPTCHA configuration

Create separate score-based reCAPTCHA Enterprise mobile keys for Android and iOS; use separate keys
for staging and production. Configure the authorization server with
`APP_MOBILE_CAPTCHA_ANDROID_SITE_KEY` and `APP_MOBILE_CAPTCHA_IOS_SITE_KEY`; the app receives these
public identifiers from its CAPTCHA settings endpoint. Set
`APP_MOBILE_CAPTCHA_ANDROID_PACKAGE_NAME` and `APP_MOBILE_CAPTCHA_IOS_BUNDLE_ID` to the exact native
application identities registered on those keys. In Administration > Settings > Login, select
reCAPTCHA Enterprise and configure its project ID, API key, score threshold, and login/registration
actions. The backend verifies token validity, action, score, and platform application identity.

The app uses `@google-cloud/recaptcha-enterprise-react-native`; Expo config enables static iOS
framework linkage for CocoaPods. Native development or release builds are required; Expo Go does
not include this module.

### Native social sign-in

Google sign-in uses the native Google Sign-In SDK and sends its signed ID token to Kitezh for
server-side signature and claim verification. Configure
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in the mobile build and use that same web client ID in the
authorization server's Google social-provider settings. iOS builds also require
`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; the Expo config derives the Google callback URL scheme from it.
These values are public OAuth client IDs, not client secrets. Keep the Google client secret in the
server's encrypted social-provider settings. Build a native development/release app after changing
these values; Expo Go does not include Google Sign-In.

GitHub, LinkedIn, and Microsoft sign-in continue through the system browser and the server's OAuth
provider flow. If Google returns an identity whose email already belongs to an unlinked local
account, the app stops sign-in and asks the user to authenticate to that local account and link
Google from Account Security. It does not link by email automatically. Social account linking itself
still completes through the existing browser flow.

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

Set `EXPO_PUBLIC_AUTHORIZATION_SERVER_ISSUER=http://localhost:9090` to use the local issuer in a
development build. Other issuer overrides are rejected, and release builds use the fixed
`https://kitezh.onrender.com` issuer. The authorization server must contain the public
`mobile-account-console` client with the `kitezh://oauth/callback` and `kitezh://logout/callback`
redirect URIs for Account. The native Admin client is deliberately separate:
`mobile-admin-console` uses the `admin-api` scope, the `kitezh://admin/oauth/callback` and
`kitezh://admin/logout/callback` redirects, and the `kitezh.mobile.admin.session` SecureStore
namespace. Set `EXPO_PUBLIC_MOBILE_ADMIN_CLIENT_ID` only when a deployment uses a different
registered client ID; never reuse the browser or Account client for Admin.

## Native release profiles and direct downloads

`eas.json` records optional EAS build profiles, but the current release workflow uses GitHub
Actions, Gradle, and Xcode directly; it does not invoke EAS or Expo Updates:

- `development` is a development client for local device and callback testing.
- `preview` is an internally distributed build for QA and acceptance evidence.
- `production` describes a potential store build profile; remote versioning and store submission are
  not active in the GitHub release workflow.

The iOS bundle identifier and Android package are both
`io.github.susimsek.kitezh.mobile`. The current GitHub Actions workflow owns direct-release signing
through its protected `mobile-release` environment; credentials must never be committed here. EAS
signing is not configured or used by this workflow. `runtimeVersion` is set to `appVersion` for a
future EAS build, but Expo Updates is not installed or enabled, so no OTA JavaScript bundle is
currently served to native builds.

`mobile-release.yml` builds and adds direct-download test builds to the same GitHub Release as the
desktop packages. Android and iOS signing are enabled automatically when all platform signing
secrets are configured; if any are missing, that platform's build continues unsigned. Android
signing uses `ANDROID_RELEASE_KEYSTORE_BASE64`, `ANDROID_RELEASE_KEYSTORE_PASSWORD`,
`ANDROID_RELEASE_KEY_ALIAS`, and `ANDROID_RELEASE_KEY_PASSWORD`. Keep a secure backup of that
keystore; replacing it prevents existing Android installs from accepting an in-place update. The
release workflow does not run Maestro; the mobile quality job runs API/component tests, and native
device E2E is a separate verification step.

Optional iOS distribution signing uses the same environment with
`IOS_DISTRIBUTION_CERTIFICATE_BASE64` (Apple Distribution `.p12`),
`IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`, `IOS_PROVISIONING_PROFILE_BASE64` (ad hoc profile), and
`IOS_TEAM_ID`. Configure all four secrets to produce a signed ad hoc IPA. Otherwise the workflow
produces an unsigned IPA.

The iOS IPA is for testing, not App Store or TestFlight submission. The user signs it with a personal
Apple Account through AltStore or Sideloadly; free provisioning expires after seven days and needs
to be refreshed. Initial sideload setup requires a Mac or PC. The mobile app checks the shared,
backend-cached `/api/public/app-release` metadata at launch and when it returns to the foreground
after six hours. The metadata is shared with the web download page and contains allowlisted assets
for desktop, Android, and iOS. The client validates that each mobile asset URL matches the returned
release tag and exact versioned filename. Android downloads the versioned APK and hands it to
Android's package installer; the user must allow installs from Kitezh and confirm the installation.
iOS opens the release page so the user can install the IPA with AltStore or Sideloadly; iOS does not
permit this app to install an unsigned IPA itself. This release check is separate from EAS OTA
updates, which remain disabled until an EAS project, update URL, privacy disclosure, staged rollout,
and rollback owner are set up.

To roll back a store release, stop the rollout and promote the last compatible build; do not use an
OTA rollback to cross a native runtime boundary. Device builds must be validated on both Android
and iOS before a production submission.

GitHub Actions runs the mobile quality gate on every push and pull request through the
`mobile-quality` job in `.github/workflows/ci.yml`. It installs the locked dependencies and runs
type checking, linting, unit/contract tests, native React Native component tests, and the fixture
contract. The mobile app is configured for iOS and Android only. Native Maestro device flows are
run separately from release packaging; `mobile-release.yml` does not launch a simulator. The
top-level GitHub Release workflow waits for successful main CI, then packages Desktop and Mobile
in parallel and publishes the shared release only after both succeed. The Mobile Release workflow
can also be dispatched for an existing release tag. EAS store submissions and OTA updates are not
triggered by CI; they require a configured EAS project, credentials, rollout metadata, privacy
disclosure, and an `EXPO_TOKEN`. No token or signing material belongs in this repository.
