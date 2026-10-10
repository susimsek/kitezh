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

| Client  | Already native                                                                                                                                                                                                                                                                       | Main remaining boundary                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web     | Complete browser Admin and Account consoles, public authentication, landing/download, localized theme and alert behavior                                                                                                                                                             | Remains the reference product and must keep its own browser storage and responsive DOM behavior                                                                                        |
| Mobile  | Native public shell, PKCE sign-in handoff, registration, password recovery/reset, email verification, SecureStore session, profile, password, sessions, offline sessions, applications, MFA/TOTP, social-link status, deletion, settings, theme/language, and account tab navigation | Native provider login/link completion, passkeys, consent, notifications, full account parity, Admin Console, app-link registration, and native E2E                                     |
| Desktop | Native sign-in/console chooser, PKCE callback and secure vault, settings, diagnostics, companion, menus/tray/dock, update dialogs/watchdog, and theme/language adapters                                                                                                              | Native authenticated Admin and Account screens, native API/session screen adapters, full platform E2E, packaged update/signing verification, and complete live theme/language coverage |

The current native clients must remain usable while this migration proceeds. A feature may be
marked Complete only when the target has an independently owned native screen, a typed shared
contract, platform storage/auth adapters, all required localized states, and focused native tests.
The Web implementation alone never changes a native status to Complete.

## Web behavior inventory

The following table is the contract to reproduce with native controls. The Web component is named
so a native implementation can be audited against behavior without copying its markup.

| Web capability           | Web source and contract                                                                                                      | Mobile native requirement                                                                                                                                                               | Desktop native requirement                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing and public shell | `components/home/HomePage.tsx`; branding, theme, locale, sign-in and download entry points                                   | Native landing screen with device-aware theme/locale, sign-in entry, release/update entry where supported, and offline/error states                                                     | Native first-launch/chooser surface with product branding, theme/locale, single-instance focus, and no Web login dependency                         |
| Username/password login  | `components/auth/LoginForm.tsx`; server form login, CAPTCHA capability, loading, validation, social discovery, passkey entry | Native screen owns presentation; Authorization Code + PKCE continues in the system browser; preserve duplicate-click prevention, cancellation, unavailable-service, and callback states | Native login screen owns presentation; main process validates PKCE state and performs the code exchange; no credentials or code in renderer storage |
| Registration             | `components/auth/RegistrationForm.tsx`; field validation, CAPTCHA handoff, success/error                                     | Native fields and validation; browser handoff only when CAPTCHA requires it; return through a registered app link                                                                       | Native form or browser handoff with the same validation and callback contract; no remote page loaded inside Electron                                |
| Password recovery/reset  | `components/auth/AccountActionForms.tsx`; identifier request, token reset, OTP policy, success/error                         | Native forgot/reset screens with secure token handling, field errors, loading, retry, and deep-link token intake                                                                        | Native dialog/window or local screen with the same states; token must never be logged or placed in a general URL history                            |
| Email verification       | `components/auth/AccountActionForms.tsx`; one-time token and localized result                                                | Native `/verify-email` screen, app/universal-link registration, expired/invalid state, and return to sign-in                                                                            | Native verification destination or safe browser handoff; protocol route must be validated and token redacted from diagnostics                       |
| Social login             | `components/auth/LoginForm.tsx`; `/api/auth/social-providers`, allowlisted aliases, full-page provider redirect              | Discover configured providers, disable unavailable providers, open the system browser, validate callback state, and finish the mobile session without exposing provider tokens          | Use the system browser and main-process callback exchange; provider aliases and callback routes are allowlisted                                     |
| Passkey login            | `components/auth/LoginForm.tsx`, `lib/webauthn.ts`; capability detection and fallback                                        | Native platform credential API, fallback to browser/password, cancellation and unsupported-device states                                                                                | Native WebAuthn-capable path or system-browser fallback; never invent a renderer-only credential store                                              |
| MFA/required actions     | `MfaChallengePage.tsx`, `RequiredActionsPage.tsx`; OTP, recovery code, passkey and first-error behavior                      | Native challenge screens for flows the mobile client owns; otherwise a validated browser continuation with a clear return state                                                         | Native challenge windows for desktop-owned flows; otherwise system-browser continuation with callback correlation                                   |
| OAuth consent            | `components/auth/ConsentForm.tsx`; scope list, approve/deny, loading and failure                                             | Native consent screen for mobile authorization requests; preserve scope text, deny behavior, and localized errors                                                                       | Native consent window/dialog for desktop authorization requests; never auto-approve because the request came from the app                           |
| Logout                   | `console-auth.ts`, account user menu; refresh-token cleanup and OIDC end-session                                             | SecureStore cleanup, ID-token hint, registered mobile redirect, restart-safe signed-out state                                                                                           | Vault cleanup, ID-token hint, registered desktop redirect, renderer reset, and menu/tray state update                                               |
| Theme/language           | `ThemeManager`, `LanguageSwitcher`, shared dictionaries and semantic CSS tokens                                              | System/light/dark and system/en/tr persisted in native storage; update the current screen immediately                                                                                   | System/light/dark and system/en/tr persisted in native preferences; update every open native window, menu, tray, and dialog                         |
| Loading and alerts       | `AsyncButton`, `ConsoleAlerts`, `AsyncState`; inline spinner and auto-dismiss feedback                                       | Page-level loading, inline mutation progress, disabled duplicate actions, native alert/banner/toast policy                                                                              | Native progress/dialog policy, disabled duplicate actions, visible offline/API/storage errors, and update progress                                  |

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
4. Add native development-build coverage for Android and iOS. Device-level acceptance is run on iOS and Desktop; Android emulator E2E is outside the user's requested verification scope. Expo web export is not native E2E.
5. Define the mobile release/update strategy (store updates or Expo Updates) before exposing an
   update action in the mobile UI.

### Additional mobile gaps found in the source audit

The following items are not optional polish. They are required to make the existing native
screens reliable on real devices and across app restarts.

| Area                    | Finding in the current source                                                                                                                         | Required native behavior and acceptance criterion                                                                                                                                                                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OAuth browser lifecycle | `MobileAuthProvider` starts AuthSession and refreshes tokens, but the PRD did not define background/resume, cancellation, timeout, or replay behavior | Persist only the transaction state needed to resume a browser handoff; reject a second callback, stale state, wrong redirect, and expired code verifier; return a localized cancelled/timeout state; never leave a spinner active after the app resumes                                                                                                    |
| Discovery/configuration | `useAutoDiscovery` may be unavailable and the current failure is a generic English message                                                            | Validate issuer, client ID, redirect URI, and required endpoints at startup; map discovery, TLS, timeout, and malformed metadata failures to localized states; include a diagnostics-safe error code rather than an endpoint or token                                                                                                                      |
| Refresh races           | Screens can call the API wrapper while the provider is hydrating or another request is refreshing                                                     | Use one process-wide single-flight refresh, cancel requests on logout, prevent an old refresh from overwriting a newer session, and make every authenticated adapter use the same retry policy                                                                                                                                                             |
| Error contract          | Native screens currently reduce several failures to booleans or generic alerts; field violations are not uniformly mapped                             | Add one Problem Detail parser for `type`, `title`, `detail`, field violations, 401/403, 429, timeout, and 5xx; localize the fallback; honor `Retry-After`; keep field feedback inside the owning field group                                                                                                                                               |
| Public API resilience   | CAPTCHA and public-auth calls do not have one documented abort/status policy                                                                          | Add request cancellation, timeout, status-specific mapping, and safe retry rules; distinguish unavailable CAPTCHA from a server error and never log a token, password, or CAPTCHA response                                                                                                                                                                 |
| SecureStore lifecycle   | SecureStore is used, but reinstall, backup restore, OS-lock changes, unavailable keychain, and storage-version migration are unspecified              | Version and namespace records, handle unavailable/invalid storage by signing out safely, exclude sensitive Android backup data, use the platform keychain access group, and test reinstall/restore/biometric-lock scenarios                                                                                                                                |
| Navigation/deep links   | Native routes exist, but protected-route guards and warm/cold link behavior are not one contract                                                      | Centralize signed-in guards, replace rather than stack callback routes, handle cold start and an already-open app, preserve back behavior, and require explicit confirmation before abandoning an unsaved form                                                                                                                                             |
| Device UX               | Safe areas, keyboard avoidance, dynamic type, reduced motion, orientation, and screen-reader semantics are not acceptance criteria                    | Test notch/insets, keyboard overlap, large text, VoiceOver/TalkBack labels and roles, minimum touch targets, reduced-motion transitions, and portrait/landscape policy on supported screens                                                                                                                                                                |
| Locale/theme changes    | Persistence and live system changes are not covered for every native screen                                                                           | Apply a locale or system-theme change without restart, update system-browser return screens and native alerts, persist the choice across restart, and provide translated validation/error strings for every native route                                                                                                                                   |
| Notifications           | A notification adapter is not defined for permission denial or action routing                                                                         | Request permission only when a feature needs it, deep-link notification actions through the same auth guard, handle denied permission with an OS-settings route, and announce important changes accessibly without inventing unread state                                                                                                                  |
| Mobile release          | The repository has a web export script but no documented device build, signing, runtime-version, or rollback policy                                   | Define Android/iOS build profiles, bundle/package identifiers, signing ownership, OTA/store boundaries, runtime compatibility, staged rollout, rollback, privacy disclosure, icon/splash assets, and minimum supported OS before release automation                                                                                                        |
| Native test harness     | Current mobile tests are contract tests rather than device-flow tests                                                                                 | Select and document a device E2E tool (for example Detox, Maestro, or an Expo development build), provide deterministic auth/API fixtures, and run iOS/Desktop device coverage for cold start, callback, logout, deep links, locale, theme, and accessibility; cover Android with native build and source-level CI gates without requiring an emulator run |

Mobile social login is explicitly blocked until the server exposes a registered mobile client and
callback contract. The native client must not exchange a provider token directly or infer an account
from an email address. The same rule applies to a future mobile Admin client: it needs its own client
registration, authority scope, storage namespace, and logout/session invalidation tests.

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

### Additional desktop gaps found in the source audit

The current Electron package has strong native infrastructure, but the authenticated console still
loads the Web renderer. The following findings keep that boundary visible and prevent a partial
migration from being mistaken for a native client.

| Area                       | Finding in the current source                                                                                                                                                                                       | Required native behavior and acceptance criterion                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authenticated renderer     | `main.ts` still loads the bundled Admin/Account Web routes after login                                                                                                                                              | Replace the authenticated route with a desktop-owned native shell and screen registry; keep the Web renderer only as an explicitly named temporary fallback with telemetry-free local diagnostics and a removal milestone                                                     |
| Renderer privileges        | The preload bridge exposes session operations while native screens are not yet fully separated                                                                                                                      | Prefer main-process request adapters for protected API calls; if a renderer receives a typed session facade, it must never receive refresh-token material, generic network passthrough, or arbitrary IPC channels                                                             |
| Auth transaction lifecycle | Fresh PKCE transactions now persist encrypted with Electron `safeStorage` and are restored with a five-minute expiry; callback/second-instance replay and platform-specific restart behavior are not fully verified | Cover one-time consumption, cancellation, browser-close handling, callback mismatch, restart recovery, macOS `open-url`, Windows/Linux second-instance, and an already-open chooser with focused native E2E tests                                                             |
| External navigation        | Native windows need a single policy for links and popup attempts                                                                                                                                                    | Allow only declared HTTPS hosts and exact paths; deny unexpected `will-navigate`, popup, custom-protocol, port, and redirect combinations; open approved external links in the system browser                                                                                 |
| Window lifecycle           | Settings, companion, dialogs, and the main window have different close/focus behavior                                                                                                                               | Define parent/child ownership, modal focus, macOS activation, tray-only mode, dock/menu-bar visibility, multi-monitor bounds, DPI/display removal, always-on-top companion behavior, and no-grey-flash startup for every native window                                        |
| Offline/API state          | Native UI has no unified request proxy, cancellation, or mutation policy                                                                                                                                            | Provide typed request cancellation and offline detection; disable unsafe mutations while disconnected, preserve idempotent retry rules, and show a recoverable localized error without losing form input                                                                      |
| Theme/language             | Live theme propagation exists for part of the renderer, but all native windows, menus, tray labels, and dialogs are not covered                                                                                     | Use one desktop preference source; update every open surface immediately; test OS light/dark and locale changes while a settings, update, companion, or auth dialog is open, including long Turkish strings and system high-contrast mode                                     |
| Update/release integrity   | Update UI and rollback paths exist, but packaging/signing/architecture behavior is not one tested contract                                                                                                          | Verify signed manifests, `latest*.yml`, checksums, rollback markers, architecture matching, interrupted downloads, proxy/air-gapped errors, permission failures, AppImage rollback, and system-package handoff; test macOS universal/x64/arm64, Windows, and Linux separately |
| Package metadata           | Linux packaging depends on desktop entry metadata and maintainer information                                                                                                                                        | Assert `desktopName`, maintainer email, desktop entry association, icon/resource inclusion, ASAR integrity, per-architecture filenames, and install/uninstall behavior in CI smoke jobs                                                                                       |
| Diagnostics/privacy        | A diagnostics surface exists, but redaction/retention/export rules are not complete                                                                                                                                 | Redact authorization codes, tokens, cookies, headers, query/body secrets, file paths, usernames, provider subjects, and PII; define retention, copy/export behavior, crash handler policy, and an explicit no-remote-telemetry default                                        |
| Accessibility              | Native HTML dialogs and Electron windows need a consistent accessibility contract                                                                                                                                   | Test tab order, focus restoration, ARIA names/roles, keyboard-only action, screen readers, reduced motion, high contrast, zoom, and dialogs that cannot trap focus after closing                                                                                              |
| Companion/global shortcut  | Companion visibility and global shortcut settings exist, but conflict and privacy behavior is unspecified                                                                                                           | Detect accelerator conflicts, expose a recoverable setting, restore the previous window focus, and prevent the companion from displaying account/admin data without a valid session                                                                                           |
| Native E2E                 | Existing E2E mostly covers unauthenticated native surfaces and update dialogs                                                                                                                                       | Add an authenticated stub server/fixture and test Admin/Account startup, API 401/403/offline, logout, deep-link callbacks, external-link policy, settings persistence, companion, update states, and packaged smoke runs on macOS/Windows/Linux                               |

Desktop token handling must be treated as a security boundary: the main process owns the vault and
refresh operation, native screens use typed capability-scoped calls, and no diagnostic, crash, or
renderer log may contain token material. A temporary Web fallback may exist during migration, but it
must be explicit, removable, and excluded from the definition of native parity.

## Cross-client contract gaps

The source audit also found contracts that are currently implicit. They must be written once in the
shared package and consumed by Web, Mobile, and Desktop without sharing UI components.

1. **Capability and version negotiation**: expose the client capabilities needed for passkeys, MFA,
   social providers, CIBA, and native update flows. A client must hide unsupported actions and show a
   localized unavailable state rather than sending an unknown request.
2. **Error taxonomy**: standardize error codes for validation, authentication, authorization,
   conflict, rate limit, unavailable, timeout, offline, and update failures. Each platform maps the
   same code to its own visual treatment.
3. **Session model**: define access/ID/refresh token ownership, expiry skew, refresh single-flight,
   logout invalidation, storage version, and per-client namespaces. Account, Admin, and future mobile
   sessions must never share a refresh record.
4. **Deep-link model**: define route names, required parameters, one-time token handling, state and
   code-verifier correlation, cold/warm start semantics, and allowed origins for every client.
5. **Localization catalog**: keep message keys, placeholders, plural rules, accessibility labels,
   error titles, and menu/dialog text in one catalog with English and Turkish coverage checks. Native
   clients may choose a platform font and control, but may not fall back to English silently.
6. **Design tokens and icon semantics**: share semantic colors, spacing, typography roles, and icon
   names only. Each platform maps them to native controls and tests contrast in light/dark/high-
   contrast modes.
7. **Audit and privacy contract**: define which security events are observable locally, how they are
   redacted, and whether any optional telemetry requires consent. Native diagnostics must not become a
   hidden token or personal-data export channel.
8. **Environment and endpoint policy**: development, staging, and production issuers, API origins,
   redirect URIs, and update feeds must be selected by build profile; a packaged build must never
   silently use `127.0.0.1` or a development issuer.

## Native migration gates

The migration cannot advance a client from In progress to Complete on visual similarity alone. Each
vertical slice must satisfy all of the following gates:

- its screen and navigation are owned by the target platform;
- its API calls use a typed adapter and the shared error/session contract;
- its auth callback, refresh, logout, deep-link, offline, and restart behavior are tested;
- its English/Turkish, light/dark/system, accessibility, and loading/error states are complete;
- its secrets, logs, diagnostics, and external navigation follow the platform security policy;
- its CI job runs the focused native tests and a packaged smoke test where packaging is involved;
- the feature matrix records the exact test evidence and any explicit backend/client-registration
  blocker.

If a backend capability is not available yet, record it as Blocked with the missing endpoint or
client registration. Do not mark it Complete by embedding the Web route or by accepting a weaker
security flow.

## Ownership split

The PRD contains 66 checklist items: 26 mobile, 25 desktop, 8 cross-client contracts, and 7
migration gates. The scope and audit tables intentionally overlap where an implementation item also
needs a separate acceptance check. Ownership below keeps the work balanced at 22 items per person;
the owner is responsible for reconciling those overlapping checks instead of implementing them twice.

| Owner       | 22 assigned items                                                                                                                                                                                                                                                                                                                                                                                         | Primary outcome                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Nail**    | Mobile P0 (3), Mobile P1 (6), Mobile audit rows OAuth browser lifecycle, discovery/configuration, refresh races, error contract, public API resilience, SecureStore lifecycle, navigation/deep links, device UX, locale/theme changes (9), and cross-client contracts capability negotiation, error taxonomy, session model, deep-link model (4)                                                          | Reliable Mobile authentication/account foundation with a single session, error, and deep-link contract |
| **Muharem** | Desktop P0 (3), Desktop P1 (5), Desktop audit rows authenticated renderer, renderer privileges, auth transaction lifecycle, external navigation, window lifecycle, offline/API state, theme/language, update/release integrity, package metadata, diagnostics/privacy (10), and cross-client contracts localization catalog, design tokens/icon semantics, audit/privacy, environment/endpoint policy (4) | Native Desktop shell and secure platform boundary, with Web renderer migration explicitly tracked      |
| **Şuayb**   | Mobile P2 (5), Mobile audit rows notifications, mobile release, native test harness (3), Desktop P2 (4), Desktop audit rows accessibility, companion/global shortcut, native E2E (3), and all 7 native migration gates                                                                                                                                                                                    | Cross-platform release confidence, accessibility, E2E coverage, and final parity evidence              |

Each owner must update the feature matrix with evidence, mark unavailable backend/client
registrations as **Blocked**, and link focused tests or packaged smoke results. A person may review
another owner's work, but a review does not transfer implementation ownership.

### Şuayb progress checklist

`[ ]` not started, `[~]` in progress, `[B]` blocked by a missing external contract/configuration,
and `[x]` complete. An item becomes `[x]` only after its acceptance evidence is linked in the
feature matrix. A blocked item must name the missing dependency and must not weaken security to
simulate it.

- [x] Mobile Admin client registration and isolated session namespace: `mobile-admin-console` is registered with the `admin-api` scope, `kitezh://admin/oauth/callback` and `kitezh://admin/logout/callback` redirects, and a separate `kitezh.mobile.admin.session` SecureStore key; contract and callback coverage is in `src/main/mobile/src/shared.contract.test.ts`
- [x] Mobile native Admin shell and navigation: `/admin` has a native sign-in boundary, Admin session provider, dashboard shell, tab navigation, loading, 401/403, retry states, and native resource screens for Users, Clients, Client Scopes, Roles, Groups, Identity Providers, Sessions, Consents, Signing Keys, and Audit Events
- [x] Mobile Admin pagination, filters, authority-aware actions, and confirmations: all resource tabs use bounded server-side query, page, size, and stable sort requests with loading, empty, 401/403, retry, and disabled pagination states; native Users, Clients, Client Scopes, Roles, Groups, and Identity Providers expose create, edit, and delete flows through protected JSON endpoints with validation, inline progress, duplicate-action prevention, and destructive confirmation; locked-user unlock, signing-key rotation, active-session termination, consent revocation, and audit-event deletion retain the same authorization, confirmation, and busy-state contract. API coverage is in `src/main/mobile/src/api/admin-api.test.ts`
- [x] Native development-build and device E2E coverage: Android debug/release builds completed locally, and all four checked-in Maestro flows pass on iPhone 17 Pro / iOS 26.5. Per the user’s verification scope, device-level acceptance is required on iOS and Desktop; Android emulator E2E is not a release gate. Android API behavior remains covered by source-level tests and the CI quality/build gates.
- [x] Mobile store-first release and rollback strategy: `src/main/mobile/README.md` and `eas.json` define development, internal preview, production profiles, store-first delivery, runtime-version boundaries, and rollback by stopping a rollout and promoting the last compatible build. EAS project/update URL and rollout credentials remain deployment prerequisites before enabling distribution; they do not change the documented release/rollback decision.
- [B] Mobile OS notifications and authenticated action-routing are blocked until the backend defines an event/action contract; the local `MobileNoticeProvider` remains implemented and tested for in-app feedback without fabricating unread state or notification actions
- [x] Mobile signing ownership, app-version runtime boundary, and release profiles: README documents EAS as the signing-credential owner, excludes secrets from source control, and defines development/preview/production profiles with remote app-version management. iOS simulator build and device-flow verification passed locally; production credentials and store metadata must be configured in the protected release environment when distribution is authorized.
- [x] Mobile native E2E harness and fixture contract: Maestro and the deterministic fixture are documented in `src/main/mobile/e2e/README.md`; fixture contract test passes, and all four checked-in iOS flows pass on iPhone 17 Pro / iOS 26.5. Device acceptance is scoped to iOS and Desktop; API offline/timeout/refresh and OAuth callback-state behavior is covered by the mobile/shared unit tests.
- [x] Desktop package metadata and packaged smoke: `src/main/desktop/test/package-metadata.test.mjs` asserts product/maintainer/desktop entry/protocol/target metadata; local macOS ARM64 `0.1.3` DMG and ZIP pass integrity checks, and `smoke:package` opens the packaged app and verifies the native chooser, protocol/API config, version, secure-storage status, branding, and Diagnostics safe-field/privacy allowlist. Cross-OS CI is configured; signing/notarization is tracked separately.
- [~] Linux system-package handoff is enforced by `supportsAutoUpdate`; `src/main/desktop/test/update-rollback.test.mjs` verifies AppImage-file and installation-directory restoration, and `e2e/electron.test.mjs` verifies that the restored version reports recovery and consumes the marker at startup. Packaged Linux AppImage rollback and `.deb`/`.rpm`/`.snap` smoke evidence remain
- [~] Desktop update-manifest signature verification is covered by `src/main/desktop/test/update-signature.test.mjs` and CI Sigstore/checksum steps; cross-platform signed release evidence remains
- [x] Desktop accessibility screenshots and native control checks: Settings E2E verifies the redesigned searchable Settings navigation, all five category icons, 680px narrow layout, and 200% zoom without horizontal overflow; it captures automated normal and forced-colors screenshots after a keyboard-focus check. CI uploads the screenshot per OS from `.github/workflows/ci.yml`. Evidence: local `test:e2e` passed 11/11 on 2026-10-10; run hidden in the background.
- [x] Desktop accessibility behavior: shared native dialog CSS exposes visible keyboard focus, Windows forced-colors focus/borders, and reduced-motion styles; `e2e/electron.test.mjs` emulates forced colors and reduced motion, checks 200% zoom, and asserts focused-control styles. Evidence: local desktop `test:e2e` passed 11/11 on 2026-10-10, with Electron windows kept in the background. Screen-reader and OS-level high-contrast validation remain follow-up checks beyond this automated acceptance item.
- [x] Companion/global shortcut conflict handling and privacy behavior: `src/main/desktop/src/security/global-shortcut.ts` falls back to the default accelerator when a requested accelerator is already claimed, and startup persists the actual fallback so Settings does not display a shortcut that is not active; `src/main/desktop/test/security.test.mjs` verifies conflict fallback and both-shortcuts-unavailable behavior, while the companion E2E verifies the local-only chooser, console selection, Escape close, and focus restoration
- [x] Authenticated desktop native E2E fixture and cross-platform protocol coverage: `e2e/electron.test.mjs` exercises fixture OAuth callback, PKCE exchange, encrypted session storage, logout, and diagnostics redaction; `.github/workflows/ci.yml` runs Electron E2E on Linux, macOS, and Windows. Local desktop E2E passed 11/11 on 2026-10-10 with windows hidden; the cross-platform jobs are configured for CI.
- [~] Native screen/navigation ownership gate: `check-native-boundaries.mjs` rejects Web/DOM/Electron/browser-storage imports in Mobile and Shared source, and iOS Maestro owns mobile cold-start/settings navigation flows; Desktop's authenticated consoles still use the bundled Web renderer and require native screen migration
- [x] Typed adapter and shared error/session contract gate: `src/main/shared/src/api.ts` and `src/main/shared/src/session.ts` define Problem Detail, status classification, native session, and single-flight refresh contracts consumed by mobile adapters; `src/main/mobile/src/api/account-api.test.ts`, `admin-api.test.ts`, and `shared.contract.test.ts` verify status mapping, offline/timeout classification, single-flight refresh, and isolated Account/Admin session namespaces
- [x] Auth callback, code exchange, logout, deep-link, and transaction-storage gate: shared OAuth state/scheme and single-flight refresh validation cover Account and Admin callback/logout routes in `src/main/mobile/src/shared.contract.test.ts`; iOS Maestro flows cover Account callback, fixture profile load, logout, and cold/warm email/reset-link routing. Desktop encrypts pending PKCE transactions with Electron `safeStorage`, restores only fresh console-bound transactions after startup, and removes expired or invalid records; `src/main/desktop/test/security.test.mjs` verifies expiry, console binding, and cleanup, while `e2e/electron.test.mjs` exercises callback state, PKCE code exchange, encrypted session storage, and logout. Android device E2E is outside the requested verification scope; broader offline and process-resume scenarios remain in the device E2E gate
- [x] English/Turkish localization and system/light/dark theme gate: iOS settings Maestro flows cover Turkish/light/dark switching; Desktop E2E verifies all three appearance modes, Turkish settings/update copy, and persisted language on reopen. Large-text, screen-reader, loading/error, and accessibility evidence remains in the dedicated accessibility and native E2E gates
- [x] Secret, log, diagnostics, and external-navigation security gate: `check-native-security.mjs` rejects diagnostic logging and token-bearing URLs; desktop unit tests verify credential/PII redaction and configured external-origin allowlists; packaged smoke asserts the Diagnostics safe-field allowlist, and the authenticated desktop callback E2E confirms access/refresh tokens never appear in diagnostics
- [x] Focused CI and packaged smoke-test gate: GitHub Actions run [37956036500](https://github.com/susimsek/kitezh/actions/runs/37956036500) passed the build, mobile quality, and Linux/macOS/Windows desktop package jobs. The latest local mobile change passed typecheck, lint, 29 unit/contract tests, Expo export, native boundary/security/config checks, and all four iOS Maestro flows (CLI 2.11.0); Desktop E2E and packaged smoke evidence is recorded above. This gate covers the configured CI and smoke-test path; production signing credentials remain a release-environment prerequisite.
- [x] Feature-matrix evidence and explicit blocker gate: the mobile matrix and this PRD record Android/iOS build evidence, four-flow iOS Maestro evidence, link each flow and the iOS CI workflow, and keep the remaining mobile, desktop, signing, and backend-event blockers explicit

Progress on 2026-10-10: **18 of 22 complete; 3 in progress and 1 blocked**. Android emulator E2E is not required by the user's acceptance scope; Android source/build checks remain useful, while device-level verification is performed on iOS and Desktop. The remaining notification item is blocked by the missing authenticated backend event/action and device-registration contract, not by lack of a local test environment. The requested commit, push,
tag, and release are gated on all 22 checklist items being complete with evidence.

### Local verification record (2026-10-10)

The following results are from the source and local runs on macOS arm64. They are recorded
separately from the 22-item completion checklist: a local unit or development-build pass does not
complete an item whose acceptance criteria still require an authenticated flow, a target-platform
packaged artifact, or a real-device run.

| Status | Target                               | Local result                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Checklist impact                                                                                                                                                                                                      |
| ------ | ------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[x]`  | Desktop native infrastructure        | **Passed locally**                        | Re-run on 2026-10-10: desktop typecheck, `test:unit` (19/19), and background `test:e2e` (11/11), including redesigned searchable Settings with category icons, normal/forced-colors screenshots, narrow/200% zoom, reduced-motion focus, Turkish plus system/light/dark modes, second-launch focus, developer-tools toggle, companion window, update available/up-to-date/recovered/error states, and a fixture OAuth callback with PKCE exchange, encrypted session storage, logout, and diagnostics redaction; shortcut, auth-vault, and rollback unit tests also pass | Native unauthenticated surfaces and auth/security contracts are verified; authenticated native Admin/Account screens and cross-platform packaged/signed smoke tests remain `[~]`                                      |
| `[x]`  | Packaged desktop smoke (macOS ARM64) | **Passed locally; unsigned**              | `pnpm package` produced the 0.1.3 DMG/ZIP; `hdiutil verify` and `unzip -t` passed; `pnpm run smoke:package` launched the packaged app with isolated user data and verified the native chooser, `app://renderer/`, production API origin, Kitezh protocol configuration, package version, secure-storage status, branding, and a diagnostics safe-field allowlist with no credentials or personal data                                                                                                                             | This proves the local macOS ARM64 package starts and includes its renderer assets; Windows/Linux packaged smoke and signed/notarized artifacts remain `[~]`                                                           |
| `[x]`  | Desktop accessibility smoke          | **Passed locally**                        | Settings E2E emulates forced colors and reduced motion, tabs to a control, asserts a visible focus outline and reduced transition duration, verifies 680px viewport and 200% zoom without horizontal overflow, and captures `settings-accessibility.png`; CI is configured to upload the screenshot for each OS                                                                                                                                                                                                                   | This covers one native settings dialog; screen readers, other dialogs, and OS-level high-contrast validation remain `[~]`                                                                                             |
| `[x]`  | Mobile contracts and static quality  | **Passed locally**                        | Re-run on 2026-10-10: mobile typecheck, lint, `test` (29/29), `test:fixture` (1/1), `check:expo-config`, `check:boundaries`, `check:security`, and Expo web export; API tests cover transport-offline classification, request timeout classification, and one 401 refresh retry                                                                                                                                                                                                                                                   | Source-level boundary, contract, fixture, and security checks are verified; device-level offline/timeout/refresh and accessibility evidence remains `[~]`                                                             |
| `[x]`  | Shared API/session contract          | **Passed locally**                        | Mobile API and shared contract tests passed (29/29), including Problem Detail and HTTP status classification, offline/timeout behavior, a single 401 refresh retry, Account/Admin namespace separation, callback route validation, and single-flight session refresh; mobile boundary and security checks also passed                                                                                                                                                                                                             | The reusable contract gate is complete; authenticated device refresh/logout scenarios remain in the separate E2E gate `[~]`                                                                                           |
| `[x]`  | Android development build            | **Passed locally**                        | `expo run:android --no-bundler` built and installed `app-debug.apk` on `Medium_Phone_API_37.0` (`emulator-5554`) after using Homebrew OpenJDK 17 for the Android Gradle process; Expo SDK dependencies were aligned so Metro now bundles `expo-router` successfully, and the emulator reached the native landing screen without a fatal exception or red bundle-error screen                                                                                                                                                      | Android build and source-level gates are accepted; user does not require Android emulator E2E.                                                                                                                        |
| `[x]`  | Android release build                | **Passed locally**                        | `./gradlew :app:assembleRelease` completed successfully with the aligned Expo dependencies and produced the release APK; only upstream deprecation/compiler warnings were emitted                                                                                                                                                                                                                                                                                                                                                 | Packaged release signing, installation, authenticated flows, and store delivery remain `[~]`                                                                                                                          |
| `[~]`  | Android emulator Maestro flows       | **Not required for requested acceptance** | A prior local run passed `cold-start.yaml`, `settings-locale-theme.yaml`, `deep-links.yaml`, and `authenticated-fixture.yaml`. A later authenticated rerun could not complete after the emulator stopped responding to ADB and Maestro reported `Failure calling service package: Broken pipe`. The Android fixture still builds and has API/contract CI coverage.                                                                                                                                                                | Kept as optional follow-up; Android device instability does not block the user's iOS/Desktop verification scope.                                                                                                      |
| `[x]`  | Android Java toolchain               | **Fixed locally**                         | GraalVM Java 25 and the local GraalVM Java 17 both failed Android SDK 36 `JdkImageTransform`; the same source built successfully with `/opt/homebrew/opt/openjdk@17`                                                                                                                                                                                                                                                                                                                                                              | Keep the repository/backend on Java 25; use a standard OpenJDK 17 toolchain for Expo/Gradle Android builds                                                                                                            |
| `[x]`  | iOS development build                | **Passed locally**                        | Xcode 26.6 (17F113), iOS 26.5 simulator runtime, `expo run:ios --no-bundler --device "iPhone 17 Pro"`, and Metro reload completed; the app installed and opened on the iPhone 17 Pro simulator without a bundle error                                                                                                                                                                                                                                                                                                             | Debug package build/install/launch is verified; broader iOS device E2E acceptance remains `[~]`                                                                                                                       |
| `[x]`  | iOS simulator Maestro flows          | **Passed locally**                        | Re-run after the mobile Settings styling update on 2026-10-10 using Maestro CLI 2.11.0 on iPhone 17 Pro / iOS 26.5: `cold-start.yaml`, `settings-locale-theme.yaml`, `deep-links.yaml`, and `authenticated-fixture.yaml` all passed. The run used `simctl` without opening or foregrounding Simulator.app. The authenticated flow completed the system-browser callback, fixture profile load, logout, and signed-out return; settings now tolerates a persisted starting locale, and the fixture waits for an explicit account-button tap                                                                                                              | Checked-in iOS branding, locale/theme, cold/warm email/reset deep links, and Account callback/profile/logout are verified; OAuth transaction resume/replay, offline, timeout, refresh, and accessibility remain `[~]` |
| `[~]`  | Authenticated device E2E             | **Partially verified on iOS**             | Four iOS Maestro flows passed on 2026-10-10 from a clean simulator, covering Account callback/profile/logout, locale/theme, and cold/warm email/reset links. Android emulator device coverage is not part of the user's requested acceptance scope.                                                                                                                                                                                                                                                                               | Offline/timeout/replay and accessibility cases, notices, Admin device flows, and complete desktop native parity remain open in items 8, 12–21                                                                         |

The local evidence therefore confirms that the existing native source and test harnesses are
healthy, but it does not claim native parity. The remaining `[~]` markers above are intentional:
they require the missing authenticated desktop/mobile screens, backend/client registrations where
noted, packaged cross-platform artifacts, or device-level acceptance evidence. Generated Android
build output and emulator state are local-only and must not be committed.

## Shared/native architecture contract

### Allowed in `src/main/shared`

- DTO and endpoint contracts, pagination/filter models, enum values, permission names, and
  Problem Detail field names.
- PKCE state models, expiry calculations, pure validation, sorting/filtering, and state transitions.
- English/Turkish message keys and platform-neutral message values.
- Semantic colors, spacing, typography, elevation, icon names, and icon metadata.

### Kept platform-specific

| Web                                                                          | Mobile                                                                                          | Desktop                                                                                       |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Next.js routes, DOM, React-Bootstrap, browser storage, browser notifications | React Native screens, Expo Router, SecureStore, system-browser auth, native alerts, device APIs | Electron windows, preload/IPC, safeStorage, menus/tray, updater, OS dialogs, global shortcuts |

No native screen is complete if it imports a Web component, React-Bootstrap, `localStorage`,
`window.desktopApi` on Mobile, or a remote Web route. Native screens may consume the shared package
and typed platform adapters only.

## Acceptance and test plan

Every native vertical slice must pass the following state matrix:

| State            | Mobile                                                             | Desktop                                                                             |
| ---------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Initial load     | Page spinner; controls are not shown until required data arrives   | Native loading window/placeholder; no grey flash or interactive stale controls      |
| Mutation pending | Inline spinner, original label retained, duplicate action disabled | Same behavior in native button/dialog; cancellation policy explicit                 |
| Empty            | Localized empty state with next useful action                      | Localized empty state with navigation back to the relevant shell                    |
| Validation       | Field-level localized message and first-invalid focus              | Native field/dialog validation with keyboard focus                                  |
| 401/403          | One refresh retry, then signed-out or forbidden state              | Vault-aware retry, then signed-out or forbidden state without token leakage         |
| Offline/5xx      | Recoverable localized error and retry                              | Offline banner/native error with retry and safe mutation disablement                |
| Theme/language   | Current screen and persisted preference update immediately         | All open windows, dialogs, menu/tray, and persisted preference update immediately   |
| Accessibility    | Labels, roles, touch target, screen reader announcement            | Keyboard traversal, focus ring, screen reader labels, high contrast, reduced motion |

Required checks for each slice are mobile typecheck/lint/unit/build plus iOS native E2E, desktop
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
