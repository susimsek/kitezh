# Desktop authentication E2E

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
