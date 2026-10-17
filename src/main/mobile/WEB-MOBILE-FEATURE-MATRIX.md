# Web–Mobile–Desktop Feature Matrix

This matrix tracks functional parity between the web application, the React Native application
under `src/main/mobile`, and the Electron application under `src/main/desktop`. Web, mobile, and
desktop share contracts and design tokens, but each platform owns its screens and interaction
components. “Mobile status” and “Desktop status” must be updated whenever a feature is implemented,
blocked, or intentionally adapted for native interaction.

Status values:

- `Not started`: identified from the current web application, no target-platform implementation yet.
- `In progress`: target-platform work has started but the acceptance criteria are incomplete.
- `Complete`: behavior, localized states, security behavior, and target-platform tests are complete.
- `Blocked`: the current backend/web contract is missing or requires a decision first.
- `Platform-specific`: intentionally belongs to web or desktop and has no mobile equivalent.

## Platform boundaries

| Layer              | Web                                                                                              | Mobile                                                    | Desktop                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI components      | Next.js and React-Bootstrap components in `src/main/web`                                         | React Native components in `src/main/mobile`              | Electron native windows and platform controls in `src/main/desktop`; authenticated console screens are being migrated to native desktop components |
| Shared package     | Uses typed contracts, message keys, icon names, and semantic theme tokens from `src/main/shared` | Same contracts and tokens; no browser or Electron imports | Same contracts and tokens; no remote web URL or browser storage dependency                                                                         |
| Authentication     | Browser Authorization Code + PKCE                                                                | System-browser Authorization Code + PKCE with SecureStore | System-browser Authorization Code + PKCE with the Electron main-process secure vault and native login/console chooser                              |
| Session storage    | Namespaced browser storage                                                                       | SecureStore                                               | Electron `safeStorage` in the main process                                                                                                         |
| Updates            | Web release/download page                                                                        | Platform store or native release strategy                 | Electron updater and native update dialogs                                                                                                         |
| Theme and language | Browser preferences and web provider                                                             | Native provider and device-aware persistence              | Native preferences, Electron theme source, and native dialog localization                                                                          |

Mobile package boundary verified 2026-10-17: Expo targets only iOS and Android; the mobile
manifest has no `react-dom` or `react-native-web` dependency and no Web export script. Component
tests use React Native Testing Library through the mobile-local Jest setup. `mobile-quality` runs
the mobile unit and native-renderer component coverage once and uploads both coverage reports.
The iOS 26.5 Simulator run passed cold start, persisted locale/theme, verification/reset deep
links, fixture sign-in, CIBA approve/deny, MFA setup screen, and logout. Android device E2E is not
part of this verification scope. Current mobile verification also passes 79 contract/API tests and
90 native component tests. Auth controls and dismiss actions meet the 44-point touch target, busy
actions expose accessible progress and prevent duplicate submission, Account dynamic profile
attributes use the existing GET/PUT API with localized field validation, and Admin role membership
uses the existing authorized assignment/removal APIs with search, pagination, confirmation, and
inline progress. These new Account/Admin slices have API and React Native Testing Library coverage;
they have not yet been exercised by the iOS Maestro fixture flow.

## Desktop feature matrix

| Area                           | Desktop target                                                                                        | Desktop status | Acceptance and tests                                                                                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Native sign-in surface         | Separate Electron login and console chooser with Kitezh branding; must not render the web login route | Complete       | Native `app://renderer/desktop-login` window, Admin/Account choices, localized error/loading state, duplicate-click prevention                                                                                                 |
| Browser authentication handoff | System browser Authorization Code + PKCE; callback returns through `kitezh://`                        | Complete       | Main-process state validation, code exchange, callback error handling, and secure-vault storage                                                                                                                                |
| Admin and Account consoles     | Native desktop screen components with the same API contracts as web and mobile                        | In progress    | `src/main/desktop/src/native/renderer.mjs` owns the Account profile, password, sessions, offline sessions, applications, MFA, social-link read/unlink, deletion, and settings surfaces; adapter and native E2E evidence remain |
| Desktop API/session adapter    | Main-process typed Account API requests with one 401 refresh retry and separate vault namespaces      | In progress    | `src/main/desktop/src/api/desktop-api.ts`, `test/api-adapter.test.mjs`; packaged authenticated E2E, logout callback, and cross-platform evidence remain                                                                        |
| Desktop shell                  | Main window, menu bar, dock visibility, companion window, single-instance focus, and native menus     | In progress    | Native `app://renderer/native` chooser and shell replace the default Web route; existing menu/tray/companion and second-launch tests remain; authenticated native E2E remains                                                  |
| Settings                       | Native settings window with General, Notifications, Appearance, Updates, and Diagnostics sections     | Complete       | Separate window, theme/language persistence, reset defaults, keyboard shortcut, diagnostics, and no-login access                                                                                                               |
| Theme                          | System, light, and dark modes applied to Electron windows and dialogs                                 | In progress    | Native shell consumes shared semantic tokens and receives live `nativeTheme` updates; full open-surface and packaged coverage remains                                                                                          |
| Language                       | English and Turkish for menus, native windows, and desktop settings                                   | In progress    | Native shell consumes shared English/Turkish messages and live language updates; full open-surface and packaged coverage remains                                                                                               |
| Updates                        | Electron-native checking, available, up-to-date, error, download, install, and rollback dialogs       | In progress    | Manual check, notification click, theme/language variants, update recovery E2E, and signed-manifest verification are covered; cross-platform packaged update evidence remains                                                  |
| Linux update boundary          | AppImage updater and Linux package-manager delivery                                                   | In progress    | `supportsAutoUpdate` keeps `.deb`/`.rpm`/`.snap` outside the in-app updater while AppImage remains eligible; packaged AppImage rollback and package-manager smoke evidence remain                                              |
| Secure storage                 | Access, ID, and refresh tokens never exposed to web storage; main process is authoritative            | Complete       | `safeStorage` boundary, renderer bridge allow-list, logout cleanup, and token refresh tests                                                                                                                                    |
| Desktop diagnostics            | Redacted version, runtime, platform, storage, update capability, and event information                | Complete       | Diagnostics screen and redaction tests                                                                                                                                                                                         |
| Packaged release smoke         | CI desktop release workflow and electron-builder metadata                                             | In progress    | `src/main/desktop/test/package-metadata.test.mjs` verifies app identity, protocol, maintainer, desktop entry, and artifact targets; macOS/Windows/Linux packaged startup and signed artifact evidence remain                   |

Desktop components must not import React-Bootstrap, browser `localStorage`, or remote web pages.

Windows Google evidence (2026-10-09): `../desktop/e2e/google-authenticated.test.mjs`
passed using a real system-browser protocol callback, Google-linked Account API
responses, isolated Admin/Account vaults, and encrypted session restart persistence.
Google sign-in was completed interactively; repeat runs use the established browser
SSO session. `../desktop/e2e/README.md` documents opt-in execution and limitations.
This is source Electron evidence, not a signed-package or macOS/Linux acceptance claim.
The visible native chooser and authenticated Admin hydration are also covered by
`../desktop/e2e/electron.test.mjs`: a console transition must not quit the app,
and callback/reload must not automatically reopen authorization once authenticated.
Google logout now uses the standard local Kitezh OIDC handler instead of the
unsupported Google global `/Logout?continue=...` fallback. `SocialLoginLogoutIT`
passed 8/8 for Desktop Admin/Account in English/Turkish: registered callback delivery,
local session invalidation, reauthentication, and rejection of unregistered redirects.
The updated real Google source E2E passed 1/1 through actual Windows logout callback
delivery, encrypted vault clearing, and signed-out chooser rendering after reload.
Google browser SSO stays signed in intentionally. Other providers, real-provider
packaged logout, macOS/Linux, and mobile device logout are not covered by this evidence.

The renderer may reuse typed API/session contracts from `src/main/shared`; visual components and
platform behavior remain owned by Desktop. The web console remains available for browsers and is
not loaded as the desktop sign-in surface.

The Account social-link list and unlink operation are native and use the bearer API. Starting a
provider link now uses a short-lived server transaction and native PKCE handoff through the
validated `kitezh://social-link/callback` contract. Authenticated packaged native E2E coverage
remains open; the native client does not put an access token in a browser URL or silently reuse a
browser cookie.

## Native transformation rules

The web application is the behavior reference, not the component library for the other platforms.
When a web feature is implemented on Mobile or Desktop, copy its user-visible behavior, API
contract, validation, authorization rules, loading states, empty states, error states, and
accessibility requirements. Rebuild the screen with the platform's native controls and navigation.
Do not copy React-Bootstrap markup, Bootstrap classes, DOM event handlers, Next.js routing, or web
storage code into a native target.

### What belongs in `src/main/shared`

The shared package is deliberately framework-neutral. It may contain:

- API request/response types, enum values, endpoint names, pagination models, and Problem Detail
  field names.
- Authentication and authorization contracts, PKCE state models, token expiry calculations, and
  pure session/permission helpers.
- Localized message keys and platform-independent message values for English and Turkish.
- Semantic color, spacing, typography, and elevation tokens; icon names and icon metadata.
- Pure validation, formatting, sorting, filtering, and state-transition functions.
- Feature capability flags and platform-neutral feature metadata.

The shared package must not import React, React Native, Next.js, React-Bootstrap, Bootstrap CSS,
Electron, browser globals, `localStorage`, `SecureStore`, or filesystem APIs. It must not create
windows, navigate, display a dialog, perform platform I/O, or own a platform session.

### What belongs in each platform

| Platform | Owns                                                                                                                                                                                            | Must not import                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Web      | Next.js routes, React-Bootstrap layout, browser navigation, responsive DOM behavior, browser notifications, and namespaced browser session storage                                              | Electron APIs, React Native components, mobile secure-storage adapters                                     |
| Mobile   | React Native screens, native stack/tab navigation, touch and accessibility behavior, SecureStore, App Auth/system-browser handoff, push/local notifications, and mobile release/update behavior | DOM/Bootstrap components, Next.js routes, Electron preload or `desktopApi`                                 |
| Desktop  | Electron `BrowserWindow`/menu/tray lifecycle, native dialogs, system-browser PKCE handoff, `safeStorage`, update windows, global shortcuts, and desktop accessibility/keyboard behavior         | Remote web pages, web `localStorage`, React Native components, and direct imports of web screen components |

### Target directory ownership

Keep the ownership visible in the source tree:

```text
src/main/shared/
  src/contracts/      # DTOs, endpoint and protocol contracts
  src/domain/         # pure models, validation, permission and state helpers
  src/i18n/           # message keys and shared translations
  src/theme/          # semantic design tokens
  src/icons/          # icon names and metadata

src/main/web/
  components/         # web-only screens and DOM components
  routing/            # Next/React web routes
  lib/                # browser API and storage adapters

src/main/mobile/
  src/screens/        # native Mobile screens
  src/components/     # native Mobile components
  src/navigation/     # native navigation
  src/platform/       # SecureStore, App Auth, device and notification adapters

src/main/desktop/
  src/native/         # native HTML/dialog templates and desktop-only UI helpers
  src/windows/        # BrowserWindow lifecycle and window-specific controllers
  src/platform/       # safeStorage, updater, tray, menu and OS adapters
  src/security/       # main-process PKCE and callback validation
```

Existing folders can be migrated incrementally; the ownership rule applies even before every
screen has moved into the target directory. A native feature may consume `src/main/shared`, but it
must own its visual tree and platform adapter.

### Web-to-native conversion workflow

Every row copied from the Web feature tables follows the same sequence:

1. **Inventory the web behavior.** Record routes, API calls, DTOs, validation, permissions,
   loading/empty/error states, destructive confirmations, localization keys, and analytics/audit
   effects. The web screen is not copied; its behavior is documented.
2. **Extract framework-neutral pieces.** Move only reusable contracts, pure rules, message keys,
   semantic tokens, and icon metadata into `src/main/shared`. Keep adapters and side effects out.
3. **Build the native screen shell.** Add a Mobile screen and/or Desktop window using native
   controls, native navigation, platform typography, and the shared tokens.
4. **Add the platform adapter.** Use the typed API contract with a Mobile SecureStore/session
   adapter or Desktop main-process `safeStorage`/IPC adapter. Do not call the web storage adapter
   from either target.
5. **Implement every state.** Include initial loading, inline progress for async actions,
   disabled duplicate submission, validation, empty data, 401/403, offline/network error,
   success feedback, retry where appropriate, and localized text.
6. **Verify security and lifecycle.** Test PKCE state, token refresh and cleanup, logout, session
   invalidation, deep links, permission checks, and app restart behavior on the target platform.
7. **Retire platform leakage.** Remove direct imports from the Web component tree and add a
   dependency check so native code cannot import Bootstrap, DOM-only helpers, or remote page URLs.
8. **Update this matrix.** Mark Mobile/Desktop status only after the acceptance tests pass for that
   platform; a shared contract change does not make either native screen complete by itself.

### Web feature to native implementation map

| Web reference                            | Mobile implementation                                                                        | Desktop implementation                                                                  | Shared extraction                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `LoginForm` and account actions          | Native sign-in, registration, MFA, reset, and required-action screens with App Auth          | Native login/console chooser, system-browser handoff, and native callback/error windows | PKCE models, provider metadata, validation rules, message keys           |
| `AccountShell` and account forms         | Native stack/tabs, profile, password, sessions, applications, security, and deletion screens | Native account window and keyboard-accessible navigation                                | Account DTOs, permission checks, session state, field rules              |
| `AdminShell` and resource pages          | Native admin navigation and resource screens when mobile administration is enabled           | Native desktop admin navigation and resource windows                                    | Resource DTOs, pagination/filter models, authority rules, mutation state |
| `ThemeManager` and `LanguageSwitcher`    | Native theme provider, device locale detection, and persisted preferences                    | Electron `nativeTheme`, native preference storage, and localized menus/dialogs          | Semantic tokens, locale enum, message keys, pure resolvers               |
| `DesktopUpdateBanner` and update dialogs | Mobile store/release update surface                                                          | Electron updater, native progress/result/confirmation dialogs, rollback handling        | Update status model and localized status keys                            |

### Definition of native completion

A Web feature is complete on Mobile or Desktop only when the target has an independently owned
native screen, no direct Web component import, no remote Web URL dependency, a typed shared
contract, platform storage/auth adapters, all required localized states, accessibility behavior,
and focused unit plus native E2E coverage. Until then, keep the row `In progress` and document the
remaining migration work instead of marking it complete because the Web screen already works.

## Public and authentication flows

| Area                      | Current web source                                                                                        | Mobile target                                                                        | Mobile status | Acceptance and tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public landing page       | `src/main/web/components/home/HomePage.tsx`                                                               | Native landing screen with sign-in/download or app-update entry points as applicable | In progress   | Foundation screen, shared tokens, localized content, navigation shell; auth and release entry points remain                                                                                                                                                                                                                                                                                                                                                                                                        |
| Product branding          | Web `BrandLogo`, favicon, and desktop application icon                                                    | Bundled native wordmark/icon, launcher/adaptive icons, and themed splash screen      | Complete      | `BrandMark` uses the same local Kitezh icon asset as desktop across landing, sign-in, account, Admin, callback, and account-action screens; Expo config validates app/adaptive/splash assets and the iOS cold-start flow asserts the native mark                                                                                                                                                                                                                                                                   |
| Login                     | `src/main/web/components/auth/LoginForm.tsx`                                                              | Native login screen                                                                  | In progress   | Every sign-in creates a fresh Expo AuthRequest state/verifier; the five-minute PKCE transaction is namespaced in SecureStore and consumed before exchange. Cold-start callback parsing, trusted-discovery validation, timeout, missing-state transaction cleanup, and duplicate-submit prevention are covered; focused `MobileAuthProvider.coverage.test.tsx` passed 11/11; Android 16 Pixel 7 Maestro callback/profile/logout flow passed against current Metro bundle; replay and device refresh evidence remain |
| Registration              | `src/main/web/components/auth/RegistrationForm.tsx`                                                       | Native registration screen                                                           | In progress   | Native fields, keyboard avoidance, localized field validation, focus on the first invalid field, inline server violations, CAPTCHA capability lookup, disabled duplicate actions, and cancellable/timeout-aware public requests are implemented; CAPTCHA HTTP status and malformed responses stay distinct; native component/device E2E remains                                                                                                                                 |
| Forgot/reset/verify email | `src/main/web/components/auth/AccountActionForms.tsx`                                                     | Native account action screens                                                        | In progress   | Native screens use typed public API adapters, localized field-level errors, first-invalid-field focus, inline progress, and recoverable server violations; native intent routing preserves only valid 43-character Base64URL action tokens and strips OAuth callback parameters (`src/shared.contract.test.ts`); iOS verification/reset deep links pass Maestro; full server acceptance remains                                                                                                                                 |
| Social login              | `src/main/web/components/auth/LoginForm.tsx`                                                              | Native provider list using server-provided provider aliases                          | Blocked       | `/api/auth/social-providers` and dedicated mobile OAuth clients exist, but the backend has no contract to bind a chosen provider alias to the pending mobile PKCE transaction; keep browser login available and do not add a weaker direct-provider flow                                                                                                                                                                                                                                                           |
| Passkey login             | `src/main/web/components/auth/LoginForm.tsx`                                                              | Native passkey flow                                                                  | Blocked       | Server WebAuthn/browser routes exist, but the mobile package has no iOS AuthenticationServices/Android Credential Manager adapter; do not route native credentials through Web components or claim device support without a focused native implementation and tests                                                                                                                                                                                                                                                |
| MFA and required actions  | `src/main/web/components/auth/MfaChallengePage.tsx`, `RequiredActionsPage.tsx`                            | Native MFA/required-action screens                                                   | In progress   | Account TOTP setup, verify/enable/disable and recovery-code flows are native; server-owned login challenges continue in the system browser and return through validated PKCE state; passkey-required native handling and device acceptance remain                                                                                                                                                                                                                                                                  |
| Consent                   | `src/main/web/components/auth/ConsentForm.tsx`                                                            | Native consent screen                                                                | Blocked       | Mobile clients do not require consent and the consent API is tied to the authenticated browser request; no native request-context handoff exists, so approval is not auto-granted or emulated                                                                                                                                                                                                                                                                                                                      |
| Logout                    | `src/main/web/components/account/AccountSessions.tsx`, `src/main/web/components/auth/ConsoleUserMenu.tsx` | Native logout and OIDC post-logout flow                                              | In progress   | Mobile account/admin sessions use isolated versioned SecureStore envelopes; legacy records migrate on read, invalid or unsupported records are cleared, and OIDC logout uses the ID-token hint. `MobileAuthProvider.coverage.test.tsx` verifies logout/refresh/re-auth races and that two concurrent forced refreshes produce one token request (11/11 focused Jest tests passed on 2026-10-16); keychain restore/lock and device lifecycle evidence remain                                                        |

## Shared behavior

| Area                          | Current web source                                                            | Mobile target                                                  | Mobile status | Acceptance and tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme                         | `src/main/web/components/auth/ThemeManager.tsx`, `ThemeSwitcher.tsx`          | Native theme provider and semantic tokens                      | In progress   | Shared system/light/dark tokens, persistence, reset-to-system control, native controls, and Android/iOS Maestro light-dark flows are implemented; iPhone 17 Pro confirmed dark mode across restart and Android 16 Pixel 7 settings flow passed; large-text, system-theme, and full-route device tests remain                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Language                      | `src/main/web/components/auth/LanguageSwitcher.tsx`, `src/main/web/locales`   | Native i18n provider                                           | In progress   | Turkish/English message catalogs are parity-tested; device-language detection, persistence, reset-to-system, native API `Accept-Language`, and Android 16 Pixel 7 Maestro Turkish/English flow passed; full-route browser-return and long-message device checks remain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Mobile settings               | Desktop preferences and web language/theme controls                           | Native language and appearance settings                        | Complete      | Polished native settings screen uses semantic theme tokens, section icons, outlined preference cards, accessible radio controls, and duplicate-action-safe reset; iPhone 17 Pro Maestro flow passes Turkish/English and light/dark switching (`src/main/mobile/src/app/settings.tsx`, `e2e/maestro/settings-locale-theme.yaml`)                                                                                                                                                                                                                                                                                                                                                                                                                         |
| API/error contract            | `src/main/web/lib/admin-api.ts`, `account-api.ts`, `problem-detail.ts`        | Typed mobile API adapters                                      | In progress   | Shared Problem Detail parsing maps registration, profile, dynamic-attribute, and password violations inline; taxonomy distinguishes 401/403/validation/conflict/rate-limit/unavailable/offline/cancelled/timeout/server/update; API errors expose `Retry-After`, and requests follow the active English/Turkish locale. Latest local run passes 79/79 mobile API/contract tests and 90/90 component tests; target-device error-state acceptance remains                                                                                                                                                                                                                                                                                         |
| Loading and mutation feedback | Shared web components and form screens                                        | Native loading/spinner/disabled patterns                       | In progress   | Sign-in/out, profile load/save, MFA setup/enable/recovery, CIBA decisions, password, sessions, and retry prevent repeated operations; async buttons retain their labels with inline progress. Broader admin/action coverage and native-device acceptance remain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Notifications/alerts          | `src/main/web/components/auth/ConsoleAlerts.tsx`                              | Native alert/toast/banner layer                                | Blocked       | `MobileNoticeProvider` provides localized, theme-aware success/error banners with accessible announcement, dismiss action, bounded auto-dismiss, and coverage for application/session/social-link mutations; OS notifications and authenticated action routing require a backend event/action contract that does not exist yet (`src/main/mobile/src/components/MobileNoticeProvider.tsx`, `src/main/mobile/src/shared.contract.test.ts`)                                                                                                                                                                                                                                                                                                               |
| Mobile release/update         | Shared cached `/api/public/app-release` metadata and native installer handoff | GitHub Release APK/IPA plus EAS store profiles                 | In progress   | Shared release DTO/cache supplies versioned desktop and mobile assets; mobile checks on launch/resume, localizes available-update prompts, downloads Android APKs for user-confirmed system installation, and routes iOS users to the release page for AltStore/Sideloadly; device installation evidence and EAS store/OTA setup remain                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Native E2E harness            | Web Playwright and shared API contracts                                       | Expo development build with Maestro                            | In progress   | iPhone 17 Pro / iOS 26.5 Simulator passed all four `cold-start.yaml`, `settings-locale-theme.yaml`, `deep-links.yaml`, and `authenticated-fixture.yaml` flows on 2026-10-17, including persistence across restart, fixture callback, CIBA approve/deny, MFA setup, and logout; Simulator.app stayed in the background. Android device E2E is outside the requested verification scope. Latest local coverage passes 79/79 mobile API/contract tests, 90/90 native component tests, and fixture tests 2/2. OAuth replay, offline/timeout/refresh, and native Account/Admin device flows remain |
| Responsive/accessibility      | `src/main/web/app/styles.css`, shared components                              | Native touch, screen reader, orientation, small-screen layouts | In progress   | Native touch targets and labels are scaffolded; orientation and device E2E checks remain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Session refresh               | `src/main/web/lib/console-auth.ts`                                            | Secure native session adapter                                  | In progress   | Shared 60-second refresh skew, single-flight coordinator, permanent failure cleanup, one-retry API adapters, and revision guards prevent stale refresh results after logout or re-auth (`src/main/mobile/src/auth/MobileAuthProvider.tsx`, `src/main/mobile/src/tests/MobileAuthProvider.coverage.test.tsx`); authenticated API-wide 401 device evidence remains                                                                                                                                                                                                                                                                                                                                                                                        |

## Account Console

| Area                     | Current web source                                                       | Mobile target                       | Mobile status | Acceptance and tests                                                                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------ | ----------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Account shell/navigation | `src/main/web/components/account/AccountShell.tsx`                       | Native authenticated navigation     | In progress   | Protected account route, SecureStore session hydration, native account/security/applications/settings tab navigation, and sign-out state are implemented; broader navigation remains                                                                                                                               |
| Personal information     | `src/main/web/components/account/AccountProfileForm.tsx`                 | Native profile screen               | In progress   | Profile read/update form, email format and re-authentication validation, loading/error/retry states, localized account summary, and dynamic profile attributes via the existing GET/PUT contract are implemented; API/component coverage passes, while native E2E remains                                                                                         |
| Password                 | `src/main/web/components/account/AccountPasswordForm.tsx`                | Native password screen              | In progress   | Local policy and confirmation validation, localized field errors, password save, and inline progress are implemented; native E2E remains                                                                                                                                                                           |
| Sessions                 | `src/main/web/components/account/AccountSessions.tsx`                    | Native sessions screen              | In progress   | Active sessions list, current-session marker, per-session revoke with confirmation, sign-out-other-sessions action, retry, and inline progress are implemented; native E2E remains                                                                                                                                 |
| Offline sessions         | `src/main/web/components/account/AccountOfflineSessions.tsx`             | Native offline sessions screen      | In progress   | Offline-session list and revoke flow are available with localized loading, empty, error, confirmation, and inline progress states; pagination and native E2E remain                                                                                                                                                |
| Applications/consents    | `src/main/web/components/account/AccountApplications.tsx`                | Native applications/consents screen | In progress   | Authorized application list, revoke confirmation, offline-session list/revoke, loading/empty/error states, and inline progress are implemented; Android Pixel 7 E2E verified fixture CIBA approve/deny; production API acceptance and full pagination remain                                                       |
| MFA/passkeys             | `src/main/web/components/account/MfaSettings.tsx`, `PasskeySettings.tsx` | Native security settings            | In progress   | TOTP status/setup QR, verification, enable/disable, recovery-code generation, loading/error states are implemented; Android Pixel 7 E2E reached setup and authenticator-code screens; passkeys and verification/enable/recovery acceptance remain                                                                  |
| Social account links     | `src/main/web/components/account/SocialAccountLinks.tsx`                 | Native provider-link screen         | In progress   | Typed provider status, configured-provider gating, unlink confirmation, and native PKCE start/complete are implemented. Authenticated `/api/account/social-links/{provider}/mobile/start` and `/api/account/social-links/mobile/complete` transactions are covered by service and HTTP integration tests; the deterministic iOS browser callback/read-back is now covered, while a real-provider run remains |
| Account deletion         | `src/main/web/components/account/AccountDeleteForm.tsx`                  | Native account deletion screen      | In progress   | Password re-authentication, destructive confirmation, localized warning/error state, logout, and inline progress are implemented; native E2E remains                                                                                                                                                               |
| CIBA approvals           | `src/main/web/components/account/CibaApprovalPanel.tsx`                  | Native approval screen              | In progress   | Account API adapter and native pending-request list with localized approve/deny feedback are implemented; approval is withheld when the server marks MFA/step-up required, until a native step-up flow is available; API/component coverage and device E2E remain                                                  |

## Administration Console

| Area                           | Current web source                                                        | Mobile target                          | Mobile status | Acceptance and tests                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------- | -------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin shell/navigation         | `src/main/web/components/admin/AdminShell.tsx`                            | Native admin navigation                | In progress   | Dedicated `mobile-admin-console` registration, isolated SecureStore namespace, exact Admin callback/logout deep-link filters, and native sign-in boundary are implemented. `/api/admin/whoami` loads before the dashboard; navigation and mutations fail closed unless the backend access flag is explicitly `true`. Component tests cover auth/loading/403/retry and resource flows; iOS Maestro verifies authenticated Admin entry and policy settings, while full Admin resource parity/device coverage remains |
| Dashboard                      | `src/main/web/components/admin/AdminDashboard.tsx`                        | Native dashboard                       | In progress   | Native dashboard calls `/api/admin/dashboard` with typed auth adapter, refresh retry, loading, 403, and retry states; component tests cover navigation and requests; dedicated dashboard device acceptance remains                                                                                                                                                                                                                                                              |
| Users                          | `src/main/web/components/admin/UserEntityRoute.tsx`, `UserForm.tsx`       | Native user list/detail/create/edit    | In progress   | Native paged/searchable list, create/edit, enable/disable, unlock, and confirmed delete use server-authorized APIs with field validation and localized loading/error states; component/API tests cover CRUD and failures, but user CRUD device E2E remains                                                                                                                                                                                                                          |
| Roles                          | `src/main/web/components/admin/RoleEntityRoute.tsx`, `RolesTable.tsx`     | Native roles list/detail/create/edit   | In progress   | Paged/searchable role CRUD and user membership assignment/removal use existing authorized APIs; membership search/pagination, confirmation, 401/403/retry, inline progress, and component/API coverage are present; dedicated role CRUD device acceptance remains                                                                                                                                                                                                               |
| Groups                         | `src/main/web/components/admin/GroupEntityRoute.tsx`, `GroupsTable.tsx`   | Native groups list/detail/create/edit  | In progress   | Paged/searchable group CRUD and membership management use authorized APIs with confirmation/progress handling; component tests cover create/update/remove. iOS Maestro passes adding a fixture member; broader group CRUD device acceptance remains                                                                                                                                                                                                                                  |
| Clients                        | `src/main/web/components/admin/ClientEntityRoute.tsx`, `ClientsTable.tsx` | Native clients list/detail/create/edit | In progress   | Paged/searchable create/edit/delete is implemented with typed API, secret-safe inputs, validation, and localized error states; component tests cover create/update/delete, but device CRUD acceptance remains                                                                                                                                                                                                                                                                   |
| Client scopes                  | `ClientScopeEntityRoute` components                                       | Native client-scope screens            | In progress   | Paged/searchable create/edit/delete is implemented with consent/token flags, validation, and protected APIs; component tests cover create/update, while scope assignments, mapper/role management, and device acceptance remain                                                                                                                                                                                                                                                 |
| Identity providers             | `IdentityProvider*` components                                            | Native provider list/detail/form       | In progress   | Paged/searchable OIDC/SAML provider create/edit/delete is implemented; partial edits preserve omitted protocol-specific settings and validation is localized. Component tests cover create/update and server failures; mapper administration and device CRUD acceptance remain                                                                                                                                                                                                    |
| Sessions/offline sessions      | `Admin*Sessions` components                                               | Native session administration          | In progress   | Active/expired and offline session lists use status/search filters and bounded pagination; server-authorized revoke actions require confirmation and show inline progress. Component/API tests cover filters and failures; detailed session view and device acceptance remain                                                                                                                                                                                                        |
| Consents                       | `Admin` consent components                                                | Native consent administration          | In progress   | Paged/searchable consent list, authority display, localized loading/empty/403/retry states, and server-authorized revoke confirmation are implemented; detail filters and device acceptance remain                                                                                                                                                                                                                                                                             |
| Keys                           | Admin key resources                                                       | Native signing-key administration      | In progress   | Native signing-key list and server-authorized rotation action are present with pagination, error/retry states, and confirmation; key rotation and broader device acceptance remain to be verified |
| Events                         | `AdminEvents.tsx`, `AdminEventSettings.tsx`                               | Native event list/settings             | In progress   | Native event list and settings read/update are available with access-flag gating, validation, retry, and inline save state; the iOS Admin Maestro flow checks event-setting save |
| Authentication settings        | `AdminAuthentication.tsx`                                                 | Native authentication settings         | In progress   | Native login policy covers bounded values, validation, authorized save, and busy/error states; component and iOS device acceptance remain in progress |
| Login/email/LDAP settings      | `LoginSettings.tsx`, `EmailSettings.tsx`, `LdapFederationSettings.tsx`    | Native settings screens                | In progress   | Native login policy and SMTP settings include validation, secret-preserving update behavior, access checks, and save progress; LDAP federation management is not available in the mobile implementation |
| Localization/branding settings | `AdminLocalizationSettings.tsx`, `AdminBrandingSettings.tsx`              | Native localization/branding screens   | In progress   | Native supported-locale configuration and localization management include loading, validation, and save feedback; branding preview and broader device acceptance remain |
| CIBA/offline access settings   | `AdminCibaPolicySettings.tsx`, `AdminOfflineAccessSettings.tsx`           | Native policy settings                 | In progress   | CIBA and offline-access policies use authenticated GET/PUT APIs, bounded validation, inline progress, and fail-closed Admin capability gating; iOS Maestro verifies save and API read-back for both policies |
| Server info                    | `ServerInfo.tsx`                                                          | Native server info screen              | In progress   | Native screen reads the authenticated `/api/admin/server-info` contract and displays issuer, OIDC endpoints, session timeout, and active signing-key summary with localized loading/error/retry states. API and fixture tests pass; iOS Maestro confirms the protected tab loads session timeout and signing-key data.                                                                                                                                                                                                 |

## Explicitly not shared as-is

| Web/desktop concern                                                   | Mobile decision                                                                  | Status            |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------- |
| React-Bootstrap components and Bootstrap CSS classes                  | Rebuild with React Native components mapped to shared semantic tokens            | Platform-specific |
| Electron `window.desktopApi`, desktop settings, native update windows | Use mobile platform APIs and mobile update strategy; do not import Electron code | Platform-specific |
| Browser `localStorage` token records                                  | Use platform secure storage and separate mobile session records                  | Platform-specific |
| Desktop menu bar, dock, global shortcut, packaged update dialogs      | No direct mobile equivalent; document native alternative if required             | Platform-specific |
| Organizations                                                         | Current `main` branch has no confirmed web/backend Organizations feature         | Blocked           |

## Mobile test plan

- Unit/component tests for every screen and shared component with success, loading, validation,
  empty, error, 401, and 403 states.
- Authentication tests for PKCE state, callback validation, refresh, logout, secure-storage
  boundaries, and Admin/Account session separation.
- Native E2E tests for login, locale/theme persistence, deep links, account flows, admin flows,
  logout, offline/error behavior, and duplicate submission prevention.
- Build checks for Android and iOS in their supported environments.
- Update this matrix when a test is added, skipped, blocked, or completed.

### Native acceptance evidence (revalidated 2026-10-17)

| Platform               | Local build                                                                                                                       | Maestro device flows                                                                                             | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Remaining acceptance gaps                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Android                | Expo development APK built; release APK built with standard OpenJDK 17 and installed on `Medium_Phone_API_37.0` (`emulator-5554`) | Maestro flow definitions are shared in `e2e/maestro/`                                                                 | Previous Android build/install and device-flow results remain historical evidence. Android device E2E was not run in this revalidation, per user scope; there is no `mobile-native-e2e.yml` workflow or Android E2E claim in the current CI/release path.                                                                                                                                                                                                                                                                            | Authenticated Android device E2E was intentionally not required for this verification; Android build/install evidence is recorded above.           |
| iOS                    | Expo development build installed on iPhone 17 Pro / iOS 26.5 Simulator (Xcode 26.6)                                               | All eight checked-in flows under `e2e/maestro/`                                                                     | On 2026-10-17, iOS Maestro passed cold start, settings locale/theme persistence, verification/reset deep links, fixture authentication, CIBA approve/deny, MFA setup/logout, state- and PKCE-bound fixture social-link browser return, Account profile edit after process restart, notification mark-read/count, Admin server-info, CIBA/offline policy save/read-back, group-member assignment, event-retention save/read-back, and loading of email/localization settings. The runner used `simctl` and did not foreground Simulator.app.                                                                                                                                                  | OAuth replay and device refresh races, offline/timeout recovery, VoiceOver/dynamic type, and real-provider social-link callback remain.               |
| Desktop                | Local Electron renderer and main-process build                                                                                    | `src/main/desktop/e2e/electron.test.mjs`; `.github/workflows/ci.yml` runs the suite on Linux/macOS/Windows       | On 2026-10-10, typecheck passed, unit tests passed (19/19), and background Electron E2E passed (11/11). Settings E2E verifies the polished searchable Settings layout, five category icons, themed search control, forced-colors and reduced-motion styles, keyboard focus, a 680px viewport and 200% zoom without horizontal overflow, and captures normal/accessibility screenshots; diagnostics tests verify credential/PII redaction; rollback tests cover AppImage-file restoration, recovery-marker handoff, and recovered-status reporting; CI uploads screenshots for each OS                           | Authenticated native Admin/Account screens, screen-reader coverage, packaged protocol/update smoke tests, and signed cross-platform artifacts |
| Desktop packaged smoke | Local macOS ARM64 `0.1.3` package in `src/main/desktop/release`                                                                   | `pnpm run smoke:package`; CI and release workflows run it after packaging on Linux/macOS/Windows                 | Rebuilt locally on 2026-10-10: DMG verification and ZIP integrity passed; packaged app opened the native console chooser and verified `app://renderer/`, production API origin, `kitezh` protocol, package version, explicit secure-storage status, bundled brand images, and Diagnostics safe-field privacy allowlist                                                                                                                                                                                                                                                                                          | Linux/Windows runs, signed package/update behavior, and release workflow evidence remain unverified                                           |

The deterministic fixture contract tests pass (`pnpm run test:fixture`, 3/3). Mobile API tests
cover offline transport classification, request timeout classification, and a single 401 refresh
retry; those are unit tests, not device-level substitutes. Device E2E is run manually and is not a
regular CI or release prerequisite. The iOS runner uses a local fixture issuer; Android runner
networking uses `10.0.2.2` for the host machine. Fixture tokens are test-only and are not logged.

### Explicit native blockers

- **Mobile notifications:** authenticated notification actions and OS permission routing are
  **Blocked** until the backend provides a notification event/action contract.
- **Mobile release delivery:** store signing, staged rollout, runtime-version and OTA policy still
  need the project’s EAS account/configuration and release ownership.
- **Desktop native parity:** Admin and Account authenticated routes still use the bundled Web
  renderer. Native screen migration and the authenticated desktop fixture are not implemented.
- **Desktop platform evidence:** Windows/Linux packaged smoke, Linux package rollback/install, and
  cross-platform signed updater verification require their OS runners and signing credentials.
- **Accessibility and lifecycle:** device screen-reader/dynamic-type runs plus mobile refresh,
  offline/timeout, callback replay, desktop screen-reader/zoom checks, and OS-level high-contrast
  runs remain open; source/unit checks do not substitute for those device/packaged acceptance tests.

## Desktop test plan

- Unit-test main-process security, callback parsing, origin checks, secure-vault boundaries,
  updater state transitions, preference persistence, and diagnostic redaction.
- Add native window tests for first launch without a session, existing-session startup, logout,
  second-instance focus, settings without login, companion window behavior, and native menu/tray
  actions.
- Companion E2E must verify an accessible main landmark, named console actions, keyboard focus,
  duplicate-action prevention, and minimum action target size. It must also verify that the
  companion displays only the console chooser until the main process completes a valid session.
- Cover Admin and Account native screens with success, loading, validation, empty, offline,
  401/403, refresh, logout, and permission-denied scenarios.
- Verify system, light, and dark themes and English/Turkish labels in every native window and
  update dialog.
- Run packaged desktop checks on macOS, Windows, and Linux for callback registration, secure
  storage availability, installer startup, update download/install/recovery, and asset loading.
- Keep the Electron E2E suite isolated with a fresh user-data directory so stored sessions and
  preferences cannot make a native flow pass or fail accidentally.

## Migration order

Move features in vertical slices so Web, Mobile, and Desktop remain usable throughout the
transition:

1. Shared authentication/session contracts and error model.
2. Native login, registration, MFA, logout, and callback lifecycle.
3. Shared theme, language, icons, loading, and error primitives.
4. Account profile, password, sessions, applications, and security screens.
5. Admin shell, dashboard, users, clients, roles, groups, and identity providers.
6. Settings, notifications, update controls, diagnostics, and platform integrations.
7. Remove remaining native imports from Web components and enforce dependency boundaries in CI.
