# Desktop authentication E2E

All Electron launchers and packaged smoke tests set `DESKTOP_E2E_BACKGROUND=true`.
Application windows and fixture login windows remain hidden, including after callbacks,
second-instance delivery, menu actions, and dialog dismissal. Capture screenshots through the
background helper; do not show, focus, or raise windows to make a test pass. Opt-in real-provider
tests still require the user's system browser, while Electron windows remain hidden.
Only background E2E disables Electron's window timer/frame throttling; normal application
windows retain the production default. Pending-action tests hold the fixture response until
duplicate-click assertions complete rather than relying on a short timer.

## Live Admin clients

Run `pnpm --dir src/main/desktop test:e2e:clients:live` with the seeded backend on
`http://localhost:9090`. Hidden Electron and Web windows compare the same Clients
data at 1440 × 1000. The test visits nine native detail tabs, verifies protected
client controls, persists and reloads a small `account-console` name change, and
restores its original configuration in cleanup. A short delay around the real
update request makes spinner and duplicate-submission checks deterministic; no
token exchange or API response is mocked. Only system-browser launch and OS
callback handoff are substituted. English/Turkish, dark/light, narrow-window 200%
zoom, forced colors, reduced motion, and keyboard focus evidence is written to
`e2e/artifacts/clients-live/`, along with method/path/status-only request records.
This does not prove packaged protocol registration or macOS/Linux acceptance.

## Live Admin users

With the local backend running on `http://localhost:9090`, run
`pnpm --dir src/main/desktop test:e2e:users:live`.
This builds and launches the actual native Electron renderer in a hidden window, signs in
with the seeded local `admin/admin`, opens user 1 and visits all seven detail tabs.
Login, PKCE exchange, protected storage, preload IPC, API path authorization and all HTTP
responses use the real application and backend. Only system-browser launch and OS callback
delivery are replaced by a hidden login window; this does not test Windows protocol registration.
The test checks all nine API-provided required actions, disabled/global policy controls, card
order, and persists then removes one assignable action, restoring its initial state on cleanup.
It also types a Users search without pressing Enter, checks the filtered rows and retained input
focus, then clears the field and checks that the full list returns.
Screenshots and request method/path/status evidence are saved under `e2e/artifacts/users-live/`.
No bearer tokens or passwords are recorded in the evidence.

## Windows system-theme event

The opt-in `electron.test.mjs` case changes the current user's Windows app/system
theme values while native windows are open, then restores the original values in
its cleanup path. Run it only on Windows from the repository root:

```powershell
pnpm --dir src/main/desktop run build
$env:DESKTOP_WINDOWS_OS_THEME_E2E = 'true'
node --test --test-name-pattern="propagates actual Windows system-theme changes to open native windows" src/main/desktop/e2e/electron.test.mjs
Remove-Item Env:DESKTOP_WINDOWS_OS_THEME_E2E
```

The test verifies the chooser, Settings, update dialog, and Quick Access companion
follow both dark and light system changes. The original registry values are
restored even when an assertion fails.

## Real Google / Windows protocol callback

The live test is opt-in and uses the local backend on `http://localhost:9090`.
Enable Google and save its real Client ID/Secret in the Administration Console.
Register `http://localhost:9090/login/oauth2/code/google` in the Google application.
Never put credentials in this test, command arguments, or chat.

Close other Kitezh instances before running. This test uses the default development
Electron profile so the Windows protocol handler can return to the same single
instance. It clears local Desktop sessions and registers the development executable
as the `kitezh` handler. It does not change provider configuration or create OAuth keys.

From `src/main/desktop`, in PowerShell:

```powershell
pnpm build
$env:DESKTOP_REAL_GOOGLE_E2E = 'true'
pnpm test:e2e:google
```

Keep Electron open. In the system browser, select Google, complete sign-in and any
provider consent yourself, and accept the browser's existing-application open prompt
if shown. The test allows five minutes. To exercise a fresh Google redirect rather
than local SSO, sign out of the Kitezh browser session before starting. An existing
Google-backed browser session may legitimately return directly to Electron.

The test does not replace `shell.openExternal`, inject callbacks, capture callback
URLs, inspect Google credentials, or print profile/token values. It verifies a real
OS callback, Account profile/social-link HTTP 200, Google link status, absence of an
Admin session, and Account session persistence/API access after Electron restart.
It then clicks the native sign-out button, waits for a real Windows logout callback,
and verifies that the Account vault stays empty after renderer reload. Accept the
browser's open-app prompt again if shown. It closes Electron at the end and leaves
the Account session signed out. Kitezh logout does not sign out the Google account.
The default test invocation is skipped unless explicitly enabled.

## Real GitHub and LinkedIn authentication

The opt-in `social-provider-authenticated.test.mjs` exercises either configured
provider through the system browser and the real Windows `kitezh://` callback. The
developer accounts already contain OAuth applications whose callbacks match:

- GitHub: `http://localhost:9090/login/oauth2/code/github`
- LinkedIn: `http://localhost:9090/login/oauth2/code/linkedin`

The LinkedIn app must have “Sign In with LinkedIn using OpenID Connect” enabled.
Save each provider's real Client ID and Secret in Administration Console settings;
never put either value in a test, command argument, or chat. From `src/main/desktop`:

```powershell
pnpm build
$env:DESKTOP_REAL_GITHUB_E2E = 'true'
pnpm test:e2e:providers
$env:DESKTOP_REAL_GITHUB_E2E = $null
$env:DESKTOP_REAL_LINKEDIN_E2E = 'true'
pnpm test:e2e:providers
```

Complete each provider login in the system browser and accept the Windows prompt to
open Kitezh if shown. Each run verifies the matching linked identity, Account API,
separate Admin vault, and encrypted Account-session persistence after restart. It
does not inject a callback or inspect provider secrets, codes, tokens, or profiles.

This does not prove fresh provider consent on every run, full Account mutation
coverage, real Google authentication in a packaged app, macOS/Linux callbacks,
installer signing, or notarization. The separate packaged authentication test uses
local seeded login and injected callback delivery; it is not real-provider evidence.

## Live native realm roles

Run `pnpm test:e2e:roles:live` with the actual backend on localhost:9090. The test uses hidden Electron windows, real Admin PKCE authentication and temporary roles/users/client roles. It checks the role list, both detail tabs, creation, searches, filters, pagination, descriptions, composite assignments, memberships and view-only access. Temporary resources are removed in `finally`.

Artifacts are written to `e2e/artifacts/roles-live/`. Mutation responses and subsequent GET results are checked independently; inconsistent backend reads or an assignment HTTP 500 keep the live test failing even when all renderer interactions work. See `../ROLES-VERIFICATION.md` for the current evidence and remaining backend limitations.
