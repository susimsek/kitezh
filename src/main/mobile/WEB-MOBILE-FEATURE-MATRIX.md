# Web–Mobile Feature Matrix

This matrix tracks functional parity between the current web renderer and the planned React
Native application under `src/main/mobile`. “Mobile status” must be updated whenever a feature is
implemented, blocked, or intentionally adapted for native interaction.

Status values:

- `Not started`: identified from the current web application, no mobile implementation yet.
- `In progress`: mobile work has started but the acceptance criteria are incomplete.
- `Complete`: behavior, localized states, security behavior, and mobile tests are complete.
- `Blocked`: the current backend/web contract is missing or requires a decision first.
- `Platform-specific`: intentionally belongs to web or desktop and has no mobile equivalent.

## Public and authentication flows

| Area | Current web source | Mobile target | Mobile status | Acceptance and tests |
| --- | --- | --- | --- | --- |
| Public landing page | `src/main/frontend/components/home/HomePage.tsx` | Native landing screen with sign-in/download or app-update entry points as applicable | Not started | Localized content, theme support, navigation, accessibility |
| Login | `src/main/frontend/components/auth/LoginForm.tsx` | Native login screen | Not started | PKCE entry, validation, loading/duplicate-click prevention, localized errors, E2E |
| Registration | `src/main/frontend/components/auth/RegistrationForm.tsx` | Native registration screen | Not started | Zod-equivalent validation contract, CAPTCHA decision, success/error states |
| Forgot/reset/verify email | `src/main/frontend/components/auth/AccountActionForms.tsx` | Native account action screens | Not started | Deep links, localized validation, success/error states |
| Social login | `src/main/frontend/components/auth/LoginForm.tsx` | Native provider list using server-provided provider aliases | Not started | PKCE/browser handoff, disabled unconfigured providers, spinner, callback tests |
| Passkey login | `src/main/frontend/components/auth/LoginForm.tsx` | Native passkey flow | Not started | Platform capability detection, fallback, failure state, security tests |
| MFA and required actions | `src/main/frontend/components/auth/MfaChallengePage.tsx`, `RequiredActionsPage.tsx` | Native MFA/required-action screens | Not started | TOTP, recovery codes, passkey, first-invalid focus, completion/error tests |
| Consent | `src/main/frontend/components/auth/ConsentForm.tsx` | Native consent screen | Not started | Scope selection, deny/approve, loading, localized errors |
| Logout | `src/main/frontend/components/account/AccountSessions.tsx`, `src/main/frontend/components/auth/ConsoleUserMenu.tsx` | Native logout and OIDC post-logout flow | Not started | Separate Admin/Account session clearing, callback and restart tests |

## Shared behavior

| Area | Current web source | Mobile target | Mobile status | Acceptance and tests |
| --- | --- | --- | --- | --- |
| Theme | `src/main/frontend/components/auth/ThemeManager.tsx`, `ThemeSwitcher.tsx` | Native theme provider and semantic tokens | Not started | System/light/dark, persistence, full-screen contrast, restart test |
| Language | `src/main/frontend/components/auth/LanguageSwitcher.tsx`, `src/main/frontend/locales` | Native i18n provider | Not started | Turkish/English, persistence, long text, stale validation message test |
| API/error contract | `src/main/frontend/lib/admin-api.ts`, `account-api.ts`, `problem-detail.ts` | Typed mobile API adapters | Not started | Problem Detail mapping, 401/403, timeout/offline/error states |
| Loading and mutation feedback | Shared frontend components and form screens | Native loading/spinner/disabled patterns | Not started | Every async action prevents duplicate submission and restores state |
| Notifications/alerts | `src/main/frontend/components/auth/ConsoleAlerts.tsx` | Native alert/toast/banner layer | Not started | Localized success/error feedback and auto-dismiss behavior |
| Responsive/accessibility | `src/main/frontend/app/styles.css`, shared components | Native touch, screen reader, orientation, small-screen layouts | Not started | Touch targets, labels, focus order, landscape/narrow-device checks |
| Session refresh | `src/main/frontend/lib/console-auth.ts` | Secure native session adapter | Not started | Near-expiry refresh, one 401 retry, permanent failure cleanup |

## Account Console

| Area | Current web source | Mobile target | Mobile status | Acceptance and tests |
| --- | --- | --- | --- | --- |
| Account shell/navigation | `src/main/frontend/components/account/AccountShell.tsx` | Native authenticated navigation | Not started | Protected routes, locale/theme controls, unauthorized state |
| Personal information | `src/main/frontend/components/account/AccountProfileForm.tsx` | Native profile screen | Not started | Validation, locale preference, save spinner, server errors |
| Password | `src/main/frontend/components/account/AccountPasswordForm.tsx` | Native password screen | Not started | Policy validation, save state, session invalidation behavior |
| Sessions | `src/main/frontend/components/account/AccountSessions.tsx` | Native sessions screen | Not started | Current/other sessions, revoke, destructive confirmation, spinner |
| Offline sessions | `src/main/frontend/components/account/AccountOfflineSessions.tsx` | Native offline sessions screen | Not started | Pagination, revoke, empty/error states |
| Applications/consents | `src/main/frontend/components/account/AccountApplications.tsx` | Native applications/consents screen | Not started | List, revoke, confirmation, authorization invalidation |
| MFA/passkeys | `src/main/frontend/components/account/MfaSettings.tsx`, `PasskeySettings.tsx` | Native security settings | Not started | Setup, verification, recovery, duplicate-click prevention |
| Social account links | `src/main/frontend/components/account/SocialAccountLinks.tsx` | Native provider-link screen | Not started | Explicit link/unlink confirmation, server-side subject handling |
| Account deletion | `src/main/frontend/components/account/AccountDeleteForm.tsx` | Native account deletion screen | Not started | Re-authentication, confirmation, logout, irreversible-action messaging |
| CIBA approvals | `src/main/frontend/components/account/CibaApprovalPanel.tsx` | Native approval screen | Not started | Approve/deny, MFA/step-up states, loading and errors |

## Administration Console

| Area | Current web source | Mobile target | Mobile status | Acceptance and tests |
| --- | --- | --- | --- | --- |
| Admin shell/navigation | `src/main/frontend/components/admin/AdminShell.tsx` | Native admin navigation | Not started | Authority-aware navigation, protected deep links, responsive layout |
| Dashboard | `src/main/frontend/components/admin/AdminDashboard.tsx` | Native dashboard | Not started | Health/cards/links, loading/error states |
| Users | `src/main/frontend/components/admin/UserEntityRoute.tsx`, `UserForm.tsx` | Native user list/detail/create/edit | Not started | Pagination, filters, validation, permissions, mutation/session tests |
| Roles | `src/main/frontend/components/admin/RoleEntityRoute.tsx`, `RolesTable.tsx` | Native roles list/detail/create/edit | Not started | CRUD, assignment, authorization and confirmation states |
| Groups | `src/main/frontend/components/admin/GroupEntityRoute.tsx`, `GroupsTable.tsx` | Native groups list/detail/create/edit | Not started | Membership/role mappings, pagination, mutation tests |
| Clients | `src/main/frontend/components/admin/ClientEntityRoute.tsx`, `ClientsTable.tsx` | Native clients list/detail/create/edit | Not started | OAuth settings, secret handling, validation and security tests |
| Client scopes | `ClientScopeEntityRoute` components | Native client-scope screens | Not started | Assignments, roles, mappers, evaluation and permissions |
| Identity providers | `IdentityProvider*` components | Native provider list/detail/form | Not started | OIDC/SAML fields, secret rotation, redirect/security states |
| Sessions/offline sessions | `Admin*Sessions` components | Native session administration | Not started | Filtering, revocation, authorization and invalidation |
| Consents | `Admin` consent components | Native consent administration | Not started | List/detail/revoke, empty/error states |
| Keys | Admin key resources | Native signing-key administration | Not started | Active/inactive status, safe actions, confirmation |
| Events | `AdminEvents.tsx`, `AdminEventSettings.tsx` | Native event list/settings | Not started | Filters, pagination, settings mutations |
| Authentication settings | `AdminAuthentication.tsx` | Native authentication settings | Not started | Policy sections, validation, save/loading/error states |
| Login/email/LDAP settings | `LoginSettings.tsx`, `EmailSettings.tsx`, `LdapFederationSettings.tsx` | Native settings screens | Not started | Sensitive fields, secret preservation, validation, authorization |
| Localization/branding settings | `AdminLocalizationSettings.tsx`, `AdminBrandingSettings.tsx` | Native localization/branding screens | Not started | Supported locales, overrides, previews, save/delete feedback |
| CIBA/offline access settings | `AdminCibaPolicySettings.tsx`, `AdminOfflineAccessSettings.tsx` | Native policy settings | Not started | Validation, save state, access checks |
| Server info | `ServerInfo.tsx` | Native server info screen | Not started | Health, URLs, key metadata, safe display |

## Explicitly not shared as-is

| Web/desktop concern | Mobile decision | Status |
| --- | --- | --- |
| React-Bootstrap components and Bootstrap CSS classes | Rebuild with React Native components mapped to shared semantic tokens | Platform-specific |
| Electron `window.desktopApi`, desktop settings, native update windows | Use mobile platform APIs and mobile update strategy; do not import Electron code | Platform-specific |
| Browser `localStorage` token records | Use platform secure storage and separate mobile session records | Platform-specific |
| Desktop menu bar, dock, global shortcut, packaged update dialogs | No direct mobile equivalent; document native alternative if required | Platform-specific |
| Organizations | Current `main` branch has no confirmed web/backend Organizations feature | Blocked |

## Mobile test plan

- Unit/component tests for every screen and shared component with success, loading, validation,
  empty, error, 401, and 403 states.
- Authentication tests for PKCE state, callback validation, refresh, logout, secure-storage
  boundaries, and Admin/Account session separation.
- Native E2E tests for login, locale/theme persistence, deep links, account flows, admin flows,
  logout, offline/error behavior, and duplicate submission prevention.
- Build checks for Android and iOS in their supported environments.
- Update this matrix when a test is added, skipped, blocked, or completed.
