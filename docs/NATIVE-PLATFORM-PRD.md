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

### Additional mobile gaps found in the source audit

The following items are not optional polish. They are required to make the existing native
screens reliable on real devices and across app restarts.

| Area | Finding in the current source | Required native behavior and acceptance criterion |
| --- | --- | --- |
| OAuth browser lifecycle | `MobileAuthProvider` starts AuthSession and refreshes tokens, but the PRD did not define background/resume, cancellation, timeout, or replay behavior | Persist only the transaction state needed to resume a browser handoff; reject a second callback, stale state, wrong redirect, and expired code verifier; return a localized cancelled/timeout state; never leave a spinner active after the app resumes |
| Discovery/configuration | `useAutoDiscovery` may be unavailable and the current failure is a generic English message | Validate issuer, client ID, redirect URI, and required endpoints at startup; map discovery, TLS, timeout, and malformed metadata failures to localized states; include a diagnostics-safe error code rather than an endpoint or token |
| Refresh races | Screens can call the API wrapper while the provider is hydrating or another request is refreshing | Use one process-wide single-flight refresh, cancel requests on logout, prevent an old refresh from overwriting a newer session, and make every authenticated adapter use the same retry policy |
| Error contract | Native screens currently reduce several failures to booleans or generic alerts; field violations are not uniformly mapped | Add one Problem Detail parser for `type`, `title`, `detail`, field violations, 401/403, 429, timeout, and 5xx; localize the fallback; honor `Retry-After`; keep field feedback inside the owning field group |
| Public API resilience | CAPTCHA and public-auth calls do not have one documented abort/status policy | Add request cancellation, timeout, status-specific mapping, and safe retry rules; distinguish unavailable CAPTCHA from a server error and never log a token, password, or CAPTCHA response |
| SecureStore lifecycle | SecureStore is used, but reinstall, backup restore, OS-lock changes, unavailable keychain, and storage-version migration are unspecified | Version and namespace records, handle unavailable/invalid storage by signing out safely, exclude sensitive Android backup data, use the platform keychain access group, and test reinstall/restore/biometric-lock scenarios |
| Navigation/deep links | Native routes exist, but protected-route guards and warm/cold link behavior are not one contract | Centralize signed-in guards, replace rather than stack callback routes, handle cold start and an already-open app, preserve back behavior, and require explicit confirmation before abandoning an unsaved form |
| Device UX | Safe areas, keyboard avoidance, dynamic type, reduced motion, orientation, and screen-reader semantics are not acceptance criteria | Test notch/insets, keyboard overlap, large text, VoiceOver/TalkBack labels and roles, minimum touch targets, reduced-motion transitions, and portrait/landscape policy on supported screens |
| Locale/theme changes | Persistence and live system changes are not covered for every native screen | Apply a locale or system-theme change without restart, update system-browser return screens and native alerts, persist the choice across restart, and provide translated validation/error strings for every native route |
| Notifications | A notification adapter is not defined for permission denial or action routing | Request permission only when a feature needs it, deep-link notification actions through the same auth guard, handle denied permission with an OS-settings route, and announce important changes accessibly without inventing unread state |
| Mobile release | The repository has a web export script but no documented device build, signing, runtime-version, or rollback policy | Define Android/iOS build profiles, bundle/package identifiers, signing ownership, OTA/store boundaries, runtime compatibility, staged rollout, rollback, privacy disclosure, icon/splash assets, and minimum supported OS before release automation |
| Native test harness | Current mobile tests are contract tests rather than device-flow tests | Select and document a device E2E tool (for example Detox, Maestro, or an Expo development build), provide deterministic auth/API fixtures, and run a matrix for cold start, callback, refresh, logout, deep links, offline, locale, theme, and accessibility |

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

| Area | Finding in the current source | Required native behavior and acceptance criterion |
| --- | --- | --- |
| Authenticated renderer | `main.ts` still loads the bundled Admin/Account Web routes after login | Replace the authenticated route with a desktop-owned native shell and screen registry; keep the Web renderer only as an explicitly named temporary fallback with telemetry-free local diagnostics and a removal milestone |
| Renderer privileges | The preload bridge exposes session operations while native screens are not yet fully separated | Prefer main-process request adapters for protected API calls; if a renderer receives a typed session facade, it must never receive refresh-token material, generic network passthrough, or arbitrary IPC channels |
| Auth transaction lifecycle | Pending PKCE authorizations are in memory and callback/second-instance paths are not fully specified | Add expiry, cancellation, one-time consumption, browser-close handling, callback mismatch handling, and recovery after app restart; cover macOS `open-url`, Windows/Linux second-instance, and an already-open chooser |
| External navigation | Native windows need a single policy for links and popup attempts | Allow only declared HTTPS hosts and exact paths; deny unexpected `will-navigate`, popup, custom-protocol, port, and redirect combinations; open approved external links in the system browser |
| Window lifecycle | Settings, companion, dialogs, and the main window have different close/focus behavior | Define parent/child ownership, modal focus, macOS activation, tray-only mode, dock/menu-bar visibility, multi-monitor bounds, DPI/display removal, always-on-top companion behavior, and no-grey-flash startup for every native window |
| Offline/API state | Native UI has no unified request proxy, cancellation, or mutation policy | Provide typed request cancellation and offline detection; disable unsafe mutations while disconnected, preserve idempotent retry rules, and show a recoverable localized error without losing form input |
| Theme/language | Live theme propagation exists for part of the renderer, but all native windows, menus, tray labels, and dialogs are not covered | Use one desktop preference source; update every open surface immediately; test OS light/dark and locale changes while a settings, update, companion, or auth dialog is open, including long Turkish strings and system high-contrast mode |
| Update/release integrity | Update UI and rollback paths exist, but packaging/signing/architecture behavior is not one tested contract | Verify signed manifests, `latest*.yml`, checksums, rollback markers, architecture matching, interrupted downloads, proxy/air-gapped errors, permission failures, AppImage rollback, and system-package handoff; test macOS universal/x64/arm64, Windows, and Linux separately |
| Package metadata | Linux packaging depends on desktop entry metadata and maintainer information | Assert `desktopName`, maintainer email, desktop entry association, icon/resource inclusion, ASAR integrity, per-architecture filenames, and install/uninstall behavior in CI smoke jobs |
| Diagnostics/privacy | A diagnostics surface exists, but redaction/retention/export rules are not complete | Redact authorization codes, tokens, cookies, headers, query/body secrets, file paths, usernames, provider subjects, and PII; define retention, copy/export behavior, crash handler policy, and an explicit no-remote-telemetry default |
| Accessibility | Native HTML dialogs and Electron windows need a consistent accessibility contract | Test tab order, focus restoration, ARIA names/roles, keyboard-only action, screen readers, reduced motion, high contrast, zoom, and dialogs that cannot trap focus after closing |
| Companion/global shortcut | Companion visibility and global shortcut settings exist, but conflict and privacy behavior is unspecified | Detect accelerator conflicts, expose a recoverable setting, restore the previous window focus, and prevent the companion from displaying account/admin data without a valid session |
| Native E2E | Existing E2E mostly covers unauthenticated native surfaces and update dialogs | Add an authenticated stub server/fixture and test Admin/Account startup, API 401/403/offline, logout, deep-link callbacks, external-link policy, settings persistence, companion, update states, and packaged smoke runs on macOS/Windows/Linux |

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

| Owner | 22 assigned items | Primary outcome |
| --- | --- | --- |
| **Nail** | Mobile P0 (3), Mobile P1 (6), Mobile audit rows OAuth browser lifecycle, discovery/configuration, refresh races, error contract, public API resilience, SecureStore lifecycle, navigation/deep links, device UX, locale/theme changes (9), and cross-client contracts capability negotiation, error taxonomy, session model, deep-link model (4) | Reliable Mobile authentication/account foundation with a single session, error, and deep-link contract |
| **Muharem** | Desktop P0 (3), Desktop P1 (5), Desktop audit rows authenticated renderer, renderer privileges, auth transaction lifecycle, external navigation, window lifecycle, offline/API state, theme/language, update/release integrity, package metadata, diagnostics/privacy (10), and cross-client contracts localization catalog, design tokens/icon semantics, audit/privacy, environment/endpoint policy (4) | Native Desktop shell and secure platform boundary, with Web renderer migration explicitly tracked |
| **Şuayb** | Mobile P2 (5), Mobile audit rows notifications, mobile release, native test harness (3), Desktop P2 (4), Desktop audit rows accessibility, companion/global shortcut, native E2E (3), and all 7 native migration gates | Cross-platform release confidence, accessibility, E2E coverage, and final parity evidence |

Each owner must update the feature matrix with evidence, mark unavailable backend/client
registrations as **Blocked**, and link focused tests or packaged smoke results. A person may review
another owner's work, but a review does not transfer implementation ownership.

### Şuayb progress checklist

`[ ]` not started, `[~]` in progress, and `[x]` complete. An item becomes `[x]` only after its
acceptance evidence is linked in the feature matrix.

- [~] Mobile Admin client registration and isolated session namespace: `mobile-admin-console` is registered with the `admin-api` scope, `kitezh://admin/oauth/callback` redirect, and a separate `kitezh.mobile.admin.session` SecureStore key; native Admin screens remain to be built
- [~] Mobile native Admin shell and navigation: `/admin` now has a native sign-in boundary, Admin session provider, dashboard shell, tab navigation, loading, 401/403, and retry states; resource screens remain to be built
- [~] Mobile Admin pagination, filters, authority-aware actions, and confirmations: native Users, Clients, Client Scopes, Roles, and Groups tabs use bounded server-side query, page, size, and stable sort requests with loading, empty, 401/403, retry, and disabled pagination states; Users enable/disable/delete actions are server-authorized with native confirmation, while broader resource actions remain
- [ ] Android/iOS development-build and device E2E coverage
- [~] Mobile store-first release and rollback strategy documented in `src/main/mobile/README.md` and `eas.json`; EAS project, staged rollout, and OTA configuration remain
- [~] Mobile in-app notification adapter with localized auto-dismiss feedback (`MobileNoticeProvider`); OS permission and authenticated action-routing remain blocked until a backend event contract and native E2E harness are available
- [~] Mobile signing ownership, app-version runtime boundary, and release profiles documented; CI signing, staged rollout evidence, and store metadata remain
- [~] Mobile native E2E harness and fixture contract selected for Maestro in `src/main/mobile/e2e/README.md`; device build, fixture server, and CI matrix remain
- [~] Desktop package metadata smoke check added in `src/main/desktop/test/package-metadata.test.mjs`; macOS/Windows/Linux packaged startup, protocol, storage, asset, and signed-artifact runs remain
- [~] Linux system-package handoff is enforced by `supportsAutoUpdate` and covered by desktop tests; packaged AppImage rollback and `.deb`/`.rpm`/`.snap` smoke evidence remain
- [~] Desktop update-manifest signature verification is covered by `src/main/desktop/test/update-signature.test.mjs` and CI Sigstore/checksum steps; cross-platform signed release evidence remains
- [~] Desktop accessibility screenshots and native control checks
- [~] Desktop accessibility behavior: focus, keyboard, ARIA, high contrast, and reduced motion
- [~] Companion/global shortcut conflict handling and privacy behavior
- [~] Authenticated desktop native E2E fixture and cross-platform protocol coverage
- [ ] Native screen/navigation ownership gate
- [ ] Typed adapter and shared error/session contract gate
- [ ] Auth callback, refresh, logout, deep-link, offline, and restart test gate
- [ ] Localization, theme, accessibility, loading, and error-state gate
- [ ] Secret, log, diagnostics, and external-navigation security gate
- [ ] Focused CI and packaged smoke-test gate
- [ ] Feature-matrix evidence and explicit blocker gate

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
