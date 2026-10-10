# Native Desktop feature matrix

Status: `Complete` means acceptance evidence covers the requested native behavior;
`In progress` means the native slice exists but parity or platform evidence remains;
`Blocked` is reserved for missing backend/client registration where implementation
would otherwise require weakening security.

This matrix records Muharem's Desktop assignment from the Ownership split in
[`NATIVE-PLATFORM-PRD.md`](NATIVE-PLATFORM-PRD.md). The Web console remains the
reference implementation; the Electron native renderer owns its presentation and
uses typed, capability-scoped API calls.

## Desktop P0 and P1

| Scope                                                              | Status      | Native implementation and evidence                                                                                                                                                                                                                       | Remaining work                                                                                       |
| ------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Desktop P0 shell, session adapter, Account slice                   | In progress | Native chooser and authenticated screens; main-process API/session adapter with separate Admin/Account vaults; focused unit tests and Windows Electron E2E                                                                                               | Authenticated packaged and macOS/Linux evidence; broader platform release smoke                      |
| Desktop P1 authenticated Admin read screens                        | In progress | Native dashboard, resource summaries, bounded search/paging, EN/TR, protected API calls, safe-field display; Windows `src/main/desktop/e2e/electron.test.mjs`                                                                                            | Full Admin CRUD and remaining settings edit workflows                                                |
| Desktop P1 CIBA and Offline Access policy settings                 | In progress | Existing backend GET/PUT contracts, exact API allowlist, validation draft recovery, duplicate-action spinner; Windows E2E exercises validation and successful save                                                                                       | Bulk revoke remains unavailable in native UI; packaged cross-platform evidence                       |
| Desktop P1 Branding settings                                       | In progress | Existing backend GET/PUT contract; editable application name and three six-digit hex colors; icon/logo paths remain read-only. Unit and Windows E2E cover exact-route permission, field validation, draft recovery, success, spinner, and EN/TR feedback | Packaged cross-platform evidence                                                                     |
| Desktop P1 Login, Email, and Localization edits                    | In progress | Native screens currently provide safe read-only summaries; secrets and common-password data are omitted                                                                                                                                                  | Add a bounded native mutation only after confirming backend contract, validation and secret handling |
| Desktop audit: authenticated renderer and renderer privileges      | In progress | Native renderer avoids Web components, React-Bootstrap and browser storage; typed Admin/Account request namespaces; API allowlist denies unspecified writes                                                                                              | Full authenticated packaged review                                                                   |
| Desktop audit: auth transaction and external navigation            | In progress | PKCE callback validation, sanitized callback handoff, approved external URL policy; focused security tests and Windows E2E                                                                                                                               | Remaining lifecycle/platform callback and packaged evidence                                          |
| Desktop audit: window lifecycle, offline/API state, theme/language | In progress | Native settings/companion windows, timeout/offline/401/403 mapping, EN/TR, persisted light/dark/system behavior; Windows E2E                                                                                                                             | Multi-window live preference and cross-platform lifecycle coverage                                   |
| Desktop audit: update/release integrity and package metadata       | In progress | Manifest signature checks, rollback/system-package policy and package metadata tests                                                                                                                                                                     | Signed packaged artifact and install/update smoke on each OS/architecture                            |
| Desktop audit: diagnostics/privacy                                 | In progress | No token/code fields in native renderer UI; sensitive values omitted in Admin summaries                                                                                                                                                                  | Complete redaction/retention/export review and packaged crash diagnostics evidence                   |

## Shared cross-client contracts

| Contract                         | Status      | Evidence / remaining work                                                                                                                               |
| -------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Localization catalog             | In progress | Shared English/Turkish message keys; native policy and branding save feedback tested in both locales. Audit remaining native flows for parity.          |
| Design tokens and icon semantics | In progress | Shared semantic tokens/icon metadata; broader native surface and high-contrast coverage remains.                                                        |
| Audit and privacy                | In progress | Backend audit events exist for policy/branding writes; native rendering omits sensitive settings. Complete cross-client redaction and retention review. |
| Environment and endpoint policy  | In progress | Configured API origin and external navigation policy have focused security tests and Windows E2E; packaged platform evidence remains.                   |

## Latest focused evidence

- `pnpm --dir src/main/desktop run test:unit`: 21/21 passed.
- `pnpm --dir src/main/desktop run test:e2e`: Windows Electron suite, 11/11 passed.
- Prettier check on changed TypeScript, JavaScript, and shared localization sources passed.
- `git diff --check` passed for the committed slices.

The Native Admin surface is intentionally not marked fully complete while management
parity and packaged cross-platform smoke evidence remain open. Missing backend or
registered-client capabilities must be reported as `Blocked`; permissions must not
be broadened to work around them.
