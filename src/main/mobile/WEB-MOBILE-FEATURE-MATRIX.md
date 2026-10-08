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

## Desktop feature matrix

| Area                           | Desktop target                                                                                        | Desktop status | Acceptance and tests                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Native sign-in surface         | Separate Electron login and console chooser with Kitezh branding; must not render the web login route | Complete       | Native `app://renderer/desktop-login` window, Admin/Account choices, localized error/loading state, duplicate-click prevention |
| Browser authentication handoff | System browser Authorization Code + PKCE; callback returns through `kitezh://`                        | Complete       | Main-process state validation, code exchange, callback error handling, and secure-vault storage                                |
| Admin and Account consoles     | Native desktop screen components with the same API contracts as web and mobile                        | In progress    | Replace web-only layout/components incrementally; preserve authorization, refresh, logout, and deep-link behavior              |
| Desktop shell                  | Main window, menu bar, dock visibility, companion window, single-instance focus, and native menus     | In progress    | Native menu/tray/companion tests, second-launch focus, logout, and visibility preferences                                      |
| Settings                       | Native settings window with General, Notifications, Appearance, Updates, and Diagnostics sections     | Complete       | Separate window, theme/language persistence, reset defaults, keyboard shortcut, diagnostics, and no-login access               |
| Theme                          | System, light, and dark modes applied to Electron windows and dialogs                                 | In progress    | Native dialogs follow `nativeTheme`; renderer controls and restart persistence remain                                          |
| Language                       | English and Turkish for menus, native windows, and desktop settings                                   | In progress    | Language change updates open windows and menu/tray labels; full console coverage remains                                       |
| Updates                        | Electron-native checking, available, up-to-date, error, download, install, and rollback dialogs       | In progress    | Manual check, notification click, theme/language variants, and update recovery E2E scenarios                                   |
| Secure storage                 | Access, ID, and refresh tokens never exposed to web storage; main process is authoritative            | Complete       | `safeStorage` boundary, renderer bridge allow-list, logout cleanup, and token refresh tests                                    |
| Desktop diagnostics            | Redacted version, runtime, platform, storage, update capability, and event information                | Complete       | Diagnostics screen and redaction tests                                                                                         |

Desktop components must not import React-Bootstrap, browser `localStorage`, or remote web pages.
The renderer may reuse typed API/session contracts from `src/main/shared`; visual components and
platform behavior remain owned by Desktop. The web console remains available for browsers and is
not loaded as the desktop sign-in surface.

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

| Area                      | Current web source                                                                                        | Mobile target                                                                        | Mobile status | Acceptance and tests                                                                                                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public landing page       | `src/main/web/components/home/HomePage.tsx`                                                               | Native landing screen with sign-in/download or app-update entry points as applicable | In progress   | Foundation screen, shared tokens, localized content, navigation shell; auth and release entry points remain                                                                                                                           |
| Login                     | `src/main/web/components/auth/LoginForm.tsx`                                                              | Native login screen                                                                  | In progress   | Expo AuthSession Authorization Code + PKCE, secure callback exchange, localized loading/error states, and duplicate-click prevention are implemented; form parity and native E2E remain                                               |
| Registration              | `src/main/web/components/auth/RegistrationForm.tsx`                                                       | Native registration screen                                                           | In progress   | Native fields, validation, localized errors, CAPTCHA capability lookup, and disabled duplicate actions are implemented; CAPTCHA-enabled deployments hand off to the authorization server in the system browser and native E2E remains |
| Forgot/reset/verify email | `src/main/web/components/auth/AccountActionForms.tsx`                                                     | Native account action screens                                                        | In progress   | Native forgot-password and reset-password forms use typed public API adapters with localized success/error states and inline progress; email verification deep links and native E2E remain                                            |
| Social login              | `src/main/web/components/auth/LoginForm.tsx`                                                              | Native provider list using server-provided provider aliases                          | Not started   | PKCE/browser handoff, disabled unconfigured providers, spinner, callback tests                                                                                                                                                        |
| Passkey login             | `src/main/web/components/auth/LoginForm.tsx`                                                              | Native passkey flow                                                                  | Not started   | Platform capability detection, fallback, failure state, security tests                                                                                                                                                                |
| MFA and required actions  | `src/main/web/components/auth/MfaChallengePage.tsx`, `RequiredActionsPage.tsx`                            | Native MFA/required-action screens                                                   | Not started   | TOTP, recovery codes, passkey, first-invalid focus, completion/error tests                                                                                                                                                            |
| Consent                   | `src/main/web/components/auth/ConsentForm.tsx`                                                            | Native consent screen                                                                | Not started   | Scope selection, deny/approve, loading, localized errors                                                                                                                                                                              |
| Logout                    | `src/main/web/components/account/AccountSessions.tsx`, `src/main/web/components/auth/ConsoleUserMenu.tsx` | Native logout and OIDC post-logout flow                                              | In progress   | Mobile account session is cleared from SecureStore and OIDC logout uses the ID-token hint; callback and restart tests remain                                                                                                          |

## Shared behavior

| Area                          | Current web source                                                          | Mobile target                                                  | Mobile status | Acceptance and tests                                                                                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme                         | `src/main/web/components/auth/ThemeManager.tsx`, `ThemeSwitcher.tsx`        | Native theme provider and semantic tokens                      | In progress   | Shared system/light/dark tokens, persistence, reset-to-system control, and native controls are implemented; restart tests remain                                                                    |
| Language                      | `src/main/web/components/auth/LanguageSwitcher.tsx`, `src/main/web/locales` | Native i18n provider                                           | In progress   | Shared Turkish/English messages, device-language detection, persistence, reset-to-system control, and native controls are implemented; full dictionaries and restart tests remain                   |
| API/error contract            | `src/main/web/lib/admin-api.ts`, `account-api.ts`, `problem-detail.ts`      | Typed mobile API adapters                                      | In progress   | Account profile, password, and session adapters, bearer handling, one 401 refresh retry, HTTP/offline error state, and retry are implemented; full Problem Detail mapping and admin adapters remain |
| Loading and mutation feedback | Shared web components and form screens                                      | Native loading/spinner/disabled patterns                       | In progress   | Sign-in, profile, password, sessions, retry, and logout prevent duplicate actions with inline progress; broader mutation coverage remains                                                           |
| Notifications/alerts          | `src/main/web/components/auth/ConsoleAlerts.tsx`                            | Native alert/toast/banner layer                                | Not started   | Localized success/error feedback and auto-dismiss behavior                                                                                                                                          |
| Responsive/accessibility      | `src/main/web/app/styles.css`, shared components                            | Native touch, screen reader, orientation, small-screen layouts | In progress   | Native touch targets and labels are scaffolded; orientation and device E2E checks remain                                                                                                            |
| Session refresh               | `src/main/web/lib/console-auth.ts`                                          | Secure native session adapter                                  | In progress   | Near-expiry refresh, single-flight refresh, and permanent failure cleanup are implemented; authenticated API-wide 401 retry remains                                                                 |

## Account Console

| Area                     | Current web source                                                       | Mobile target                       | Mobile status | Acceptance and tests                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------ | ----------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account shell/navigation | `src/main/web/components/account/AccountShell.tsx`                       | Native authenticated navigation     | In progress   | Protected account route, SecureStore session hydration, security/settings links, and sign-out state are implemented; broader navigation remains                                                      |
| Personal information     | `src/main/web/components/account/AccountProfileForm.tsx`                 | Native profile screen               | In progress   | Profile read/update form, email format and re-authentication validation, loading/error/retry states, and localized account summary are implemented; dynamic profile attributes and native E2E remain |
| Password                 | `src/main/web/components/account/AccountPasswordForm.tsx`                | Native password screen              | In progress   | Local policy and confirmation validation, localized field errors, password save, and inline progress are implemented; native E2E remains                                                             |
| Sessions                 | `src/main/web/components/account/AccountSessions.tsx`                    | Native sessions screen              | In progress   | Active sessions list, current-session marker, per-session revoke with confirmation, sign-out-other-sessions action, retry, and inline progress are implemented; native E2E remains                   |
| Offline sessions         | `src/main/web/components/account/AccountOfflineSessions.tsx`             | Native offline sessions screen      | In progress   | Offline-session list and revoke flow are available with localized loading, empty, error, confirmation, and inline progress states; pagination and native E2E remain                                  |
| Applications/consents    | `src/main/web/components/account/AccountApplications.tsx`                | Native applications/consents screen | In progress   | Authorized application list, revoke confirmation, offline-session list/revoke, loading/empty/error states, and inline progress are implemented; native E2E and full pagination remain                |
| MFA/passkeys             | `src/main/web/components/account/MfaSettings.tsx`, `PasskeySettings.tsx` | Native security settings            | In progress   | TOTP status/setup QR, verification, enable/disable, recovery-code generation, loading/error states are implemented; passkeys and native E2E remain                                                   |
| Social account links     | `src/main/web/components/account/SocialAccountLinks.tsx`                 | Native provider-link screen         | In progress   | Typed provider status, configured-provider gating, unlink confirmation, and browser-based link handoff are implemented; native callback completion and E2E remain                                    |
| Account deletion         | `src/main/web/components/account/AccountDeleteForm.tsx`                  | Native account deletion screen      | In progress   | Password re-authentication, destructive confirmation, localized warning/error state, logout, and inline progress are implemented; native E2E remains                                                 |
| CIBA approvals           | `src/main/web/components/account/CibaApprovalPanel.tsx`                  | Native approval screen              | Not started   | Approve/deny, MFA/step-up states, loading and errors                                                                                                                                                 |

## Administration Console

| Area                           | Current web source                                                        | Mobile target                          | Mobile status | Acceptance and tests                                                 |
| ------------------------------ | ------------------------------------------------------------------------- | -------------------------------------- | ------------- | -------------------------------------------------------------------- |
| Admin shell/navigation         | `src/main/web/components/admin/AdminShell.tsx`                            | Native admin navigation                | Not started   | Authority-aware navigation, protected deep links, responsive layout  |
| Dashboard                      | `src/main/web/components/admin/AdminDashboard.tsx`                        | Native dashboard                       | Not started   | Health/cards/links, loading/error states                             |
| Users                          | `src/main/web/components/admin/UserEntityRoute.tsx`, `UserForm.tsx`       | Native user list/detail/create/edit    | Not started   | Pagination, filters, validation, permissions, mutation/session tests |
| Roles                          | `src/main/web/components/admin/RoleEntityRoute.tsx`, `RolesTable.tsx`     | Native roles list/detail/create/edit   | Not started   | CRUD, assignment, authorization and confirmation states              |
| Groups                         | `src/main/web/components/admin/GroupEntityRoute.tsx`, `GroupsTable.tsx`   | Native groups list/detail/create/edit  | Not started   | Membership/role mappings, pagination, mutation tests                 |
| Clients                        | `src/main/web/components/admin/ClientEntityRoute.tsx`, `ClientsTable.tsx` | Native clients list/detail/create/edit | Not started   | OAuth settings, secret handling, validation and security tests       |
| Client scopes                  | `ClientScopeEntityRoute` components                                       | Native client-scope screens            | Not started   | Assignments, roles, mappers, evaluation and permissions              |
| Identity providers             | `IdentityProvider*` components                                            | Native provider list/detail/form       | Not started   | OIDC/SAML fields, secret rotation, redirect/security states          |
| Sessions/offline sessions      | `Admin*Sessions` components                                               | Native session administration          | Not started   | Filtering, revocation, authorization and invalidation                |
| Consents                       | `Admin` consent components                                                | Native consent administration          | Not started   | List/detail/revoke, empty/error states                               |
| Keys                           | Admin key resources                                                       | Native signing-key administration      | Not started   | Active/inactive status, safe actions, confirmation                   |
| Events                         | `AdminEvents.tsx`, `AdminEventSettings.tsx`                               | Native event list/settings             | Not started   | Filters, pagination, settings mutations                              |
| Authentication settings        | `AdminAuthentication.tsx`                                                 | Native authentication settings         | Not started   | Policy sections, validation, save/loading/error states               |
| Login/email/LDAP settings      | `LoginSettings.tsx`, `EmailSettings.tsx`, `LdapFederationSettings.tsx`    | Native settings screens                | Not started   | Sensitive fields, secret preservation, validation, authorization     |
| Localization/branding settings | `AdminLocalizationSettings.tsx`, `AdminBrandingSettings.tsx`              | Native localization/branding screens   | Not started   | Supported locales, overrides, previews, save/delete feedback         |
| CIBA/offline access settings   | `AdminCibaPolicySettings.tsx`, `AdminOfflineAccessSettings.tsx`           | Native policy settings                 | Not started   | Validation, save state, access checks                                |
| Server info                    | `ServerInfo.tsx`                                                          | Native server info screen              | Not started   | Health, URLs, key metadata, safe display                             |

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

## Desktop test plan

- Unit-test main-process security, callback parsing, origin checks, secure-vault boundaries,
  updater state transitions, preference persistence, and diagnostic redaction.
- Add native window tests for first launch without a session, existing-session startup, logout,
  second-instance focus, settings without login, companion window behavior, and native menu/tray
  actions.
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
