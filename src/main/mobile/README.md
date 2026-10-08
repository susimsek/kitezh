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
default is `https://kitezh.onrender.com`. The authorization server must contain the
`mobile-account-console` public client with the `kitezh://oauth/callback` redirect URI.

## Native release profiles

`eas.json` defines the supported build boundaries:

- `development` is a development client for local device and callback testing.
- `preview` is an internally distributed build for QA and acceptance evidence.
- `production` is the store build and increments the remote app version for each release.

The iOS bundle identifier and Android package are both
`io.github.susimsek.kitezh.mobile`. EAS owns platform signing credentials; credentials must stay
in the EAS project or CI secret store and must never be committed here. The runtime contract is
the app version, so a native store build cannot load an incompatible JavaScript bundle.

The current release path is store-first. No mobile update button or OTA channel is exposed until
an EAS project, update URL, privacy disclosure, staged rollout, and rollback owner are configured.
To roll back a store release, stop the rollout and promote the last compatible build; do not use an
OTA rollback to cross a native runtime boundary. Device builds must be validated on both Android
and iOS before a production submission.
