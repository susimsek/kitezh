# Desktop AI Agent Guidelines

These instructions apply to `src/main/desktop/**` and supplement the repository-root `AGENTS.md` and the shared frontend rules in `src/main/frontend/AGENTS.md`. The root rules remain applicable unless this file provides a more specific Electron rule.

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Project Structure](#project-structure)
3. [Electron Architecture](#electron-architecture)
4. [Security](#security)
5. [Authentication](#authentication)
6. [Development and Configuration](#development-and-configuration)
7. [Testing and Quality Gates](#testing-and-quality-gates)
8. [Packaging and Release](#packaging-and-release)
9. [UI and Renderer Standards](#ui-and-renderer-standards)
10. [Common Mistakes to Avoid](#common-mistakes-to-avoid)

## Quick Reference

| Action | Command |
| --- | --- |
| Install dependencies | `pnpm install --frozen-lockfile` |
| Type check | `pnpm typecheck` |
| Build main/preload | `pnpm run build:main` |
| Build renderer and Electron code | `pnpm run build` |
| Run desktop unit tests | `pnpm test:unit` |
| Run Electron E2E tests | `pnpm test:e2e` |
| Run desktop security tests | `pnpm test` |
| Run local desktop app | `pnpm dev` |
| Run against deployed API | `pnpm start` |
| Build installers | `pnpm package` |

Run the Spring Boot development server on port `9090` before using `pnpm dev`.

## Project Structure

- `src/main.ts`: Electron main process, window lifecycle, custom renderer protocol, IPC handlers, deep links, secure session vault, and external navigation policy.
- `src/preload.ts`: the narrow, typed `contextBridge` API exposed to the renderer.
- `src/config.ts`: API origin, desktop protocol, and environment validation.
- `src/security/auth-flow.ts`: PKCE state, callback parsing, token exchange, and callback sanitization.
- `src/security/origin-policy.ts`: trusted renderer and external-origin checks.
- `scripts/build-renderer.mjs`: builds the shared Next.js static renderer into `renderer/`.
- `scripts/run-desktop.mjs`: cross-platform local/production launcher and local DevTools configuration.
- `test/`: Node test-runner coverage for callback, origin, and token-exchange security behavior.
- `assets/`: packaged application artwork.
- `renderer/`, `dist/`, and `release/`: generated build output; never edit these files by hand.

## Electron Architecture

- Keep privileged operations in the main process. The renderer must not access Node.js APIs, the filesystem, the process environment, or Electron modules directly.
- Keep `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true` enabled for every BrowserWindow.
- Expose only the smallest required API through `contextBridge`; use explicit method names and validate every argument in the main process.
- Serve the static renderer through the trusted `app://renderer` protocol. Do not load application screens from arbitrary remote URLs.
- Reuse the shared frontend components, routes, translation dictionaries, API clients, and design tokens. Do not create a second desktop-only UI system or duplicate browser authentication logic.
- Keep platform-specific behavior behind small adapters. Use Node's path and URL APIs instead of shell-specific path or command assumptions.

## Security

- Validate the IPC sender frame against the trusted renderer origin before handling any request.
- Validate all values crossing IPC boundaries, including console names, token records, callback URLs, client IDs, redirect URIs, and external URLs. Reject malformed or unexpected values.
- Allow external navigation only for the configured authorization server and explicitly allowlisted OAuth provider hosts. Open approved external URLs with `shell.openExternal`; deny arbitrary renderer navigation and popup windows.
- Keep the Content Security Policy synchronized with the configured API origin. Do not add broad `*` source allowances.
- Keep the `springauth://oauth/callback` protocol exact. Accept only the registered callback route, validate the PKCE state, reject stale or mismatched requests, and sanitize callback data before sending it to the renderer.
- Store desktop access, ID, and refresh tokens only in the main-process operating-system protected storage through Electron `safeStorage`. Never put tokens in renderer `localStorage`, query strings, URLs, Redux state, logs, crash reports, or telemetry.
- Never log authorization codes, PKCE verifiers, access tokens, refresh tokens, ID tokens, client secrets, or provider responses containing credentials.
- Do not add development bypasses, disabled certificate validation, insecure HTTP origins, or unrestricted shell execution to make a flow easier to test.
- Keep the production package free of DevTools and development diagnostics. Local `pnpm dev` may enable DevTools through `DESKTOP_DEVTOOLS=true` only.

## Authentication

- Use Authorization Code + PKCE (S256) for both the Admin and Account desktop clients.
- Keep the desktop client IDs and `springauth://oauth/callback` redirect URI aligned with Liquibase-seeded registered clients.
- Generate high-entropy state and code verifiers, retain pending authorization only in the main process, expire it, and consume it once.
- Complete the authorization-code exchange in the main process. The renderer receives only the sanitized result and the session adapter state it needs.
- Refresh tokens only through the shared console authentication adapter when the access token is near expiry or a refresh is explicitly required. Replace the encrypted session record atomically after a successful exchange.
- Clear the relevant protected session on logout or permanent refresh failure. Invoke the OIDC logout endpoint with the ID-token hint and registered post-logout URI.
- Preserve separate Admin and Account session records. Never copy or merge their token sets.
- Preserve first-launch and second-instance deep-link handling on macOS, Windows, and Linux.

## Development and Configuration

- `pnpm dev` targets `http://localhost:9090` and opens Electron DevTools automatically. Use the Network panel for renderer API, refresh, and logout requests.
- OAuth authorization is opened in the system browser, so its network activity appears in the browser's DevTools. Main-process token exchange is outside the renderer Network panel; diagnose it through safe, redacted main-process diagnostics.
- `pnpm start` targets the deployed Render API unless `DESKTOP_API_BASE_URL` is explicitly supplied.
- `DESKTOP_API_BASE_URL` must be an origin only and must pass the allowlist in `src/config.ts`; never accept arbitrary user-provided endpoints.
- Keep development-only flags such as `DESKTOP_DEVTOOLS` out of packaged production configuration.
- Do not commit credentials, OAuth secrets, signing certificates, notarization credentials, or service tokens. Use local environment configuration or CI secrets.
- When the API origin changes, update the origin allowlist, CSP, registered desktop client redirect configuration, tests, and documentation together.

## Testing and Quality Gates

- Run `pnpm typecheck`, `pnpm test`, and `pnpm build` after desktop changes.
- Run `pnpm test:e2e` for changes to the main process, preload bridge, renderer startup,
  protocol handling, or desktop authentication flow. Linux CI should run it through `xvfb-run`.
- Keep Electron E2E independently configurable from the frontend suite: desktop tests use the
  desktop package's pinned `playwright-core` Electron launcher and Node test runner, while
  frontend browser tests use `@playwright/test` under `src/main/frontend/e2e`.
- Run `pnpm package` when changing packaging configuration, protocol registration, assets, preload/main behavior, or renderer integration.
- Add or update tests for:
  - callback route and protocol validation;
  - PKCE state, expiry, replay, and token-response validation;
  - trusted renderer and external-origin policies;
  - secure storage validation and Admin/Account session separation;
  - first-launch and second-instance deep-link delivery.
- Test observable failure states, including unavailable API, invalid callback, expired state, denied authorization, token exchange failure, refresh failure, logout failure, and unavailable secure storage.
- Use the repository formatter and keep `git diff --check` clean. Do not edit generated output under `dist/`, `renderer/`, or `release/`.
- A successful local package is unsigned. Signing, notarization, auto-update publication, and real-device packaged E2E checks require platform credentials and must be performed in the release workflow.

## Packaging and Release

- Keep the Electron application ID, product name, protocol registration, icons, and platform targets aligned in `package.json`.
- Preserve the current platform targets: macOS DMG/ZIP, Linux AppImage/deb, and Windows NSIS unless a release decision changes them.
- Build each platform in its supported CI environment; do not claim that a local package is signed or notarized.
- Upload installers as CI artifacts before publishing them. Do not place generated installers or blockmaps in source control.
- Test protocol registration and callback delivery on each target OS before a release. A browser redirect must return to the correct console and must not be accepted by the other console.
- Keep production API defaults and release URLs explicit and reviewable; do not silently switch a packaged build to localhost.

## UI and Renderer Standards

- Follow `src/main/frontend/AGENTS.md` for all shared renderer components, forms, validation, localization, icons, responsive layout, accessibility, loading states, and theme behavior.
- Keep the desktop sign-in and console chooser visually consistent with the web login surface. Reuse shared cards, buttons, icons, typography, spacing, light/dark tokens, and localized messages.
- Keep Admin and Account actions separate and clearly labeled. Preserve the existing solid Bootstrap button variants; do not introduce outline button variants or one-off icons.
- Every asynchronous action must disable duplicate submission and show the inline progress spinner while it is pending, including sign-in, refresh, logout, and retry actions.
- Verify light and dark themes, keyboard focus, narrow windows, long localized text, offline/error banners, disabled/loading states, and screen-reader labels.
- Do not expose sensitive authentication details in visible error messages or client-side telemetry.

## Common Mistakes to Avoid

- Loading the web application from a remote URL inside the Electron window.
- Moving token exchange or secure-storage logic into the renderer.
- Using arbitrary `shell.openExternal` URLs or accepting callback URLs without state validation.
- Enabling DevTools, verbose token logging, or insecure origins in packaged builds.
- Duplicating the web console's API client, OAuth adapter, translations, or design system.
- Editing generated `dist/`, `renderer/`, or `release/` files instead of their source files.
- Treating a successful unsigned local installer as proof of signing, notarization, update, or cross-platform E2E readiness.
