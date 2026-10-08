# Kitezh Native Platform PRD

## Purpose and decision

This document defines the remaining work required to make the Kitezh Mobile and Desktop clients
native applications. The Web client under `src/main/web` is the behavior reference: it defines the
routes, API contracts, permissions, validation rules, localized states, and observable outcomes.
It is not a component library for native clients.

Mobile and Desktop must own their screens, navigation, input controls, loading states, dialogs,
accessibility behavior, and platform adapters. The shared package may contain only framework-neutral
contracts, pure rules, icon metadata, semantic design tokens, and localized message keys. Web DOM,
React-Bootstrap, browser storage, Electron APIs, and remote Web pages must not cross into the other
native clients.

This PRD supplements `src/main/mobile/WEB-MOBILE-FEATURE-MATRIX.md` and supersedes the old
shared-renderer assumption in planning work. `docs/KEYCLOAK-prd.md` remains the Web/Admin product
behavior reference, while `docs/KEYCLOAK-desktop-prd.md` remains the Electron packaging and
security reference.

## Current audit snapshot

The audit compares the Web routes and components with the current native source on 2026-10-08.

| Client | Already native | Main remaining boundary |
| --- | --- | --- |
| Web | Complete browser Admin and Account consoles, public authentication, landing/download, localized theme and alert behavior | Remains the reference product and must keep its own browser storage and responsive DOM behavior |
| Mobile | Native public shell, PKCE sign-in handoff, registration, password recovery/reset, email verification, SecureStore session, profile, password, sessions, offline sessions, applications, MFA/TOTP, social-link status, deletion, settings, theme/language, and account tab navigation | Native provider login/link completion, passkeys, consent, notifications, full account parity, Admin Console, app-link registration, and native E2E |
| Desktop | Native sign-in/console chooser, PKCE callback and secure vault, settings, diagnostics, companion, menus/tray/dock, update dialogs/watchdog, and theme/language adapters | Native authenticated Admin and Account screens, native API/session screen adapters, full platform E2E, packaged update/signing verification, and complete live theme/language coverage |

The current native clients must remain usable while this migration proceeds. A feature may be
marked Complete only when the target has an independently owned native screen, a typed shared
contract, platform storage/auth adapters, all required localized states, and focused native tests.
The Web implementation alone never changes a native status to Complete.

## Web behavior inventory

The following table is the contract to reproduce with native controls. The Web component is named
so a native implementation can be audited against behavior without copying its markup.

| Web capability | Web source and contract | Mobile native requirement | Desktop native requirement |
| --- | --- | --- | --- |
| Landing and public shell | `components/home/HomePage.tsx`; branding, theme, locale, sign-in and download entry points | Native landing screen with device-aware theme/locale, sign-in entry, release/update entry where supported, and offline/error states | Native first-launch/chooser surface with product branding, theme/locale, single-instance focus, and no Web login dependency |
| Username/password login | `components/auth/LoginForm.tsx`; server form login, CAPTCHA capability, loading, validation, social discovery, passkey entry | Native screen owns presentation; Authorization Code + PKCE continues in the system browser; preserve duplicate-click prevention, cancellation, unavailable-service, and callback states | Native login screen owns presentation; main process validates PKCE state and performs the code exchange; no credentials or code in renderer storage |
| Registration | `components/auth/RegistrationForm.tsx`; field validation, CAPTCHA handoff, success/error | Native fields and validation; browser handoff only when CAPTCHA requires it; return through a registered app link | Native form or browser handoff with the same validation and callback contract; no remote page loaded inside Electron |
| Password recovery/reset | `components/auth/AccountActionForms.tsx`; identifier request, token reset, OTP policy, success/error | Native forgot/reset screens with secure token handling, field errors, loading, retry, and deep-link token intake | Native dialog/window or local screen with the same states; token must never be logged or placed in a general URL history |
| Email verification | `components/auth/AccountActionForms.tsx`; one-time token and localized result | Native `/verify-email` screen, app/universal-link registration, expired/invalid state, and return to sign-in | Native verification destination or safe browser handoff; protocol route must be validated and token redacted from diagnostics |
| Social login | `components/auth/LoginForm.tsx`; `/api/auth/social-providers`, allowlisted aliases, full-page provider redirect | Discover configured providers, disable unavailable providers, open the system browser, validate callback state, and finish the mobile session without exposing provider tokens | Use the system browser and main-process callback exchange; provider aliases and callback routes are allowlisted |
| Passkey login | `components/auth/LoginForm.tsx`, `lib/webauthn.ts`; capability detection and fallback | Native platform credential API, fallback to browser/password, cancellation and unsupported-device states | Native WebAuthn-capable path or system-browser fallback; never invent a renderer-only credential store |
| MFA/required actions | `MfaChallengePage.tsx`, `RequiredActionsPage.tsx`; OTP, recovery code, passkey and first-error behavior | Native challenge screens for flows the mobile client owns; otherwise a validated browser continuation with a clear return state | Native challenge windows for desktop-owned flows; otherwise system-browser continuation with callback correlation |
| OAuth consent | `components/auth/ConsentForm.tsx`; scope list, approve/deny, loading and failure | Native consent screen for mobile authorization requests; preserve scope text, deny behavior, and localized errors | Native consent window/dialog for desktop authorization requests; never auto-approve because the request came from the app |
| Logout | `console-auth.ts`, account user menu; refresh-token cleanup and OIDC end-session | SecureStore cleanup, ID-token hint, registered mobile redirect, restart-safe signed-out state | Vault cleanup, ID-token hint, registered desktop redirect, renderer reset, and menu/tray state update |
| Theme/language | `ThemeManager`, `LanguageSwitcher`, shared dictionaries and semantic CSS tokens | System/light/dark and system/en/tr persisted in native storage; update the current screen immediately | System/light/dark and system/en/tr persisted in native preferences; update every open native window, menu, tray, and dialog |
| Loading and alerts | `AsyncButton`, `ConsoleAlerts`, `AsyncState`; inline spinner and auto-dismiss feedback | Page-level loading, inline mutation progress, disabled duplicate actions, native alert/banner/toast policy | Native progress/dialog policy, disabled duplicate actions, visible offline/API/storage errors, and update progress |

## Remaining mobile scope

### P0 — authentication and session safety

1. **Social provider login completion**
   - Add a typed provider-discovery adapter for `/api/auth/social-providers`.
   - Show only configured, login-visible aliases and use the server-provided `iconKey` through the
     shared allowlist.
   - Start a system-browser authorization transaction with mobile PKCE state; consume the callback
     exactly once and reject a stale, mismatched, or missing state.
   - Exchange the resulting code through the mobile public client and replace the SecureStore
     record atomically. Provider access tokens and subjects must remain server-side.
   - Cover configured, unconfigured, cancelled, callback-error, and duplicate-click states.

2. **Native session lifecycle hardening**
   - Centralize authenticated requests behind the mobile adapter and map Problem Detail field
     violations, 401, 403, offline, timeout, and 5xx responses to localized native states.
   - Keep one single-flight refresh operation, retry a request once after a 401, and clear only the
     affected console session after permanent refresh failure.
   - Add restart tests proving that SecureStore hydration, logout, and refresh failure do not leak
     tokens between Account and any future Admin session.

3. **App and universal links**
   - Register `kitezh://oauth/callback`, `kitezh://logout/callback`, password-reset, and
     email-verification routes in Expo configuration and the server client registration.
   - Add iOS associated domains and Android intent filters when HTTPS app links are enabled.
   - Validate route and token shape before navigation; redact tokens from diagnostics and analytics.

### P1 — account parity

1. **Passkeys**: implement native enrollment, rename, deletion, and login capability detection;
   retain browser/password fallback and test unsupported hardware.
2. **MFA and required actions**: add the native challenge/complete screens for TOTP, recovery
   codes, passkey-required, and first-invalid focus behavior.
3. **Consent**: implement scope review, deny/approve, pending spinner, callback, and 401/403/error
   states for mobile authorization requests.
4. **Social account linking**: finish the browser callback into the native session/navigation state;
   preserve confirmed unlink and server-authoritative provider visibility.
5. **CIBA approvals**: add approve/deny and step-up states only after the corresponding API contract
   is confirmed.
6. **Notifications**: provide a native alert/banner/toast adapter with localized messages,
   auto-dismiss rules, accessibility announcements, and no fake unread count.

### P2 — administration and release

1. Add a separate public `mobile-admin-console` client and a separate SecureStore namespace.
2. Build native Admin shell/navigation and then vertical slices for dashboard, users, roles, groups,
   clients, client scopes, identity providers, sessions, consents, keys, events, and settings.
3. Add pagination, server-side filters, authority-aware actions, destructive confirmations, audit
   feedback, and session invalidation for every mutable Admin screen.
4. Add Android/iOS development-build and device E2E coverage; Expo web export is not native E2E.
5. Define the mobile release/update strategy (store updates or Expo Updates) before exposing an
   update action in the mobile UI.

## Remaining desktop scope

### P0 — replace the authenticated Web renderer

1. **Native console shell**
   - Create desktop-owned navigation, title bar/content landmark, Admin and Account route models,
     responsive side navigation, breadcrumbs, tabs, page headers, filters, tables, and dialogs.
   - Keep the current native login/chooser, PKCE callback, vault, menu, tray, companion, settings,
     diagnostics, and updater behavior.
   - Do not load a remote Web URL or import Web screen components. Reuse only shared contracts,
     tokens, icons, and message keys.

2. **Desktop API/session adapter**
   - Move profile, list, mutation, and logout operations behind typed main/preload adapters or a
     tightly scoped native renderer client. The main process remains authoritative for vault access.
   - Preserve separate Admin and Account token records, one 401 refresh retry, atomic replacement,
     secure cleanup, and redacted diagnostics.
   - Add explicit 401, 403, offline, timeout, validation, empty, loading, and server-error states.

3. **Account vertical slice**
   - Implement native profile, password, sessions, offline sessions, applications/consents, MFA,
     social links, account deletion, settings, and logout before starting broad Admin CRUD.
   - Match Web API contracts and authorization decisions; do not copy Web forms or Bootstrap markup.

### P1 — Admin and native parity

1. Implement native dashboard, users, roles, groups, clients, client scopes, identity providers,
   sessions, consents, signing keys, events, authentication, login/email/LDAP, localization,
   branding, CIBA/offline access, and server-info screens.
2. Keep create actions in native page headers, collection actions with their section heading, and
   filters limited to search/sort/active filters/count.
3. Reproduce Web permission behavior: hide unavailable navigation for usability, but render a native
   forbidden state when a direct route or API call is denied.
4. Add native notifications for update availability and durable account/admin feedback only when a
   backend event/read state exists.
5. Make theme and language changes update all open native windows, menu/tray labels, and dialogs;
   add system-theme change coverage in light, dark, and system modes.

### P2 — packaging and operational confidence

1. Run packaged smoke tests on macOS, Windows, and Linux for protocol registration, secure storage,
   asset loading, API origin validation, update download/install/recovery, and logout.
2. Keep Linux system packages outside the rollback path; test AppImage rollback separately.
3. Verify code-signing/Sigstore/checksum metadata and reject unsigned update manifests when the
   release policy requires signatures.
4. Add screenshots/accessibility checks for narrow windows, keyboard traversal, screen readers,
   high-contrast mode, long Turkish strings, and offline storage/API failures.

## Shared/native architecture contract

### Allowed in `src/main/shared`

- DTO and endpoint contracts, pagination/filter models, enum values, permission names, and
  Problem Detail field names.
- PKCE state models, expiry calculations, pure validation, sorting/filtering, and state transitions.
- English/Turkish message keys and platform-neutral message values.
- Semantic colors, spacing, typography, elevation, icon names, and icon metadata.

### Kept platform-specific

| Web | Mobile | Desktop |
| --- | --- | --- |
| Next.js routes, DOM, React-Bootstrap, browser storage, browser notifications | React Native screens, Expo Router, SecureStore, system-browser auth, native alerts, device APIs | Electron windows, preload/IPC, safeStorage, menus/tray, updater, OS dialogs, global shortcuts |

No native screen is complete if it imports a Web component, React-Bootstrap, `localStorage`,
`window.desktopApi` on Mobile, or a remote Web route. Native screens may consume the shared package
and typed platform adapters only.

## Acceptance and test plan

Every native vertical slice must pass the following state matrix:

| State | Mobile | Desktop |
| --- | --- | --- |
| Initial load | Page spinner; controls are not shown until required data arrives | Native loading window/placeholder; no grey flash or interactive stale controls |
| Mutation pending | Inline spinner, original label retained, duplicate action disabled | Same behavior in native button/dialog; cancellation policy explicit |
| Empty | Localized empty state with next useful action | Localized empty state with navigation back to the relevant shell |
| Validation | Field-level localized message and first-invalid focus | Native field/dialog validation with keyboard focus |
| 401/403 | One refresh retry, then signed-out or forbidden state | Vault-aware retry, then signed-out or forbidden state without token leakage |
| Offline/5xx | Recoverable localized error and retry | Offline banner/native error with retry and safe mutation disablement |
| Theme/language | Current screen and persisted preference update immediately | All open windows, dialogs, menu/tray, and persisted preference update immediately |
| Accessibility | Labels, roles, touch target, screen reader announcement | Keyboard traversal, focus ring, screen reader labels, high contrast, reduced motion |

Required checks for each slice are mobile typecheck/lint/unit/build plus native E2E, desktop
typecheck/unit/E2E plus packaged smoke tests, and `git diff --check`. Update the feature matrix
only after the target-specific acceptance checks pass. Web tests remain necessary because Web is the
behavior reference, but a Web Playwright pass cannot substitute for native E2E.

## Delivery order

1. Complete Mobile authentication callbacks, session/error mapping, and app links.
2. Complete Mobile Account parity and native device E2E.
3. Build the Desktop native shell and Account vertical slice while keeping the current packaged
   renderer available behind an explicit migration fallback.
4. Migrate Desktop Admin resources in permission-scoped vertical slices.
5. Finish packaging, signing, updater, accessibility, and cross-platform smoke coverage.

The migration is complete when the Web, Mobile, and Desktop clients expose the same server-backed
capabilities and security outcomes while retaining independent native interaction models.
