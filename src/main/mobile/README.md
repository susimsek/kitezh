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

Registration, forgot-password, and reset-password are native screens with typed API adapters,
localized validation, and inline progress states. Registration uses the system browser only when
CAPTCHA is enabled, because the CAPTCHA challenge is owned by the authorization server. Email
verification callbacks and social-provider linking still use the system browser until their
native deep-link screens are added.

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
