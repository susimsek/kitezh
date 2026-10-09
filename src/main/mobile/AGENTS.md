# Mobile AI Agent Guidelines

These instructions apply to `src/main/mobile/**`. The repository-root `AGENTS.md` remains
applicable. The web rules in `src/main/web/AGENTS.md` and Electron rules in
`src/main/desktop/AGENTS.md` are references for shared behavior, but their DOM-, CSS-, or
Electron-specific implementation details do not apply directly to React Native.

## Purpose and parity

- The mobile application is a React Native client for the same Kitezh authorization server and
  application APIs.
- Use `WEB-MOBILE-FEATURE-MATRIX.md` as the parity checklist. A web feature is not complete for
  mobile until its mobile behavior, authorization rules, localized states, error states, and tests
  are represented in the matrix.
- Preserve behavior and security contracts across web, desktop, and mobile. Adapt layout and
  interaction patterns to native mobile conventions instead of copying HTML, Bootstrap classes,
  or desktop layouts literally.
- If a feature is absent from the current web/backend implementation, mark it as blocked or not
  available in the matrix. Do not invent a mobile-only version of a server feature.

## Scope and structure

- Keep all mobile-only source under `src/main/mobile`.
- Prefer this structure as the application grows:

  ```text
  src/main/mobile/
  ├── src/
  │   ├── api/              # typed mobile API adapters
  │   ├── auth/             # PKCE, session lifecycle, secure storage adapters
  │   ├── components/       # reusable native components
  │   ├── i18n/             # mobile i18n setup and locale persistence
  │   ├── navigation/       # authenticated and public navigation
  │   ├── screens/          # feature screens
  │   ├── theme/            # semantic tokens and theme provider
  │   └── types/            # mobile-only types
  ├── e2e/
  ├── package.json
  └── tsconfig.json
  ```

- Keep shared contracts and platform-neutral code in an explicitly shared location only after the
  dependency direction is clear. Mobile must not import browser-only modules, React-Bootstrap,
  Electron APIs, `window.desktopApi`, or DOM utilities.
- Do not edit generated output or build artifacts.

## UI and design system

- Bootstrap is the web/Electron renderer design system. React Native must use native components
  and typed styles, while matching the same semantic design tokens: colors, spacing, typography,
  radii, control sizes, focus/pressed states, and action meanings.
- Define tokens by meaning (`primary`, `surface`, `text`, `danger`, `border`, and so on), not by
  platform-specific CSS names. Map those tokens to Bootstrap on web and React Native styles on
  mobile.
- Support system, light, and dark themes. Theme changes must update the complete screen, remain
  readable in all states, and persist across app restarts.
- Support Turkish and English. Keep user-facing messages localized and keep both dictionaries
  aligned. Locale changes must update the current screen and persist according to the selected
  preference.
- Every asynchronous action must prevent duplicate submission, preserve its label, expose a
  visible inline progress indicator, and restore its normal state after completion or failure.
- Every icon-only control needs an accessible label and an adequate mobile touch target. Important
  actions must also have localized visible text where appropriate.
- Forms must use the mobile form/validation equivalent of the web contract: field-level messages,
  localized errors, first-invalid-field focus, server validation mapping, and clearing stale field
  errors when the field changes.
- Do not use hard-coded black/white theme colors or one-off spacing when a semantic token exists.

## Authentication and security

- Use Authorization Code + PKCE (S256) for mobile. The mobile OAuth client is public and must not
  contain a client secret.
- Register a mobile-specific client and redirect URI. Do not reuse desktop or browser client token
  records. Use a validated custom scheme or platform universal/app link configured by the server.
- Keep authorization state, PKCE verifier, callback validation, refresh, logout, and expiry
  handling in a focused authentication adapter. Consume callback state once and reject stale or
  mismatched callbacks.
- Store access, ID, and refresh tokens only in platform secure storage. Never store tokens in
  AsyncStorage, Redux, query strings, URLs, logs, analytics, or crash reports.
- Keep Admin and Account sessions separate, as they are on web and desktop. Never copy token sets
  between consoles.
- Refresh only when the access token is near expiry or an explicit retry requires it. Handle one
  authenticated retry for a 401, then clear the relevant session on permanent refresh failure.
- OIDC logout must use the ID-token hint and the registered mobile post-logout redirect URI.
- Backend authorization is authoritative. Mobile route visibility must not replace API
  authorization checks, and 401/403 responses must render a safe localized state.
- Never log provider responses, authorization codes, PKCE verifiers, access tokens, refresh tokens,
  ID tokens, or client secrets.

## API, data, and behavior

- Reuse the existing backend API contracts and Problem Detail behavior. Do not create a second
  backend flow merely to simplify the mobile UI.
- Keep API access in typed mobile adapters. Do not attach bearer tokens ad hoc in individual
  screens.
- Preserve pagination, filtering, sorting, validation, cache invalidation, audit, and session
  invalidation semantics of the web APIs.
- Do not expose persistence entities directly in mobile UI models. Map API responses to typed
  view models where needed.
- Show a page-level loading state before data-dependent controls, a localized empty state when no
  data exists, and a recoverable error state when a request fails.

## Testing and quality gates

- Required checks for mobile changes are typecheck, lint, unit/component tests, build, and native
  E2E tests appropriate to the selected React Native toolchain.
- Test observable behavior, not implementation details: successful flows, loading and duplicate
  submission prevention, validation, empty/error/401/403 states, theme and locale changes,
  reload/restart persistence, deep links, refresh, logout, and responsive/native layouts.
- Every new mobile feature must include parity coverage in the matrix and tests for the affected
  web-equivalent behavior where the backend contract is shared.
- Do not consider a web Playwright pass to be mobile E2E coverage. Native E2E must launch the
  mobile build and exercise the real navigation/authentication boundaries.
- Run `git diff --check` after changes. Keep changes focused and do not commit, push, merge, or
  rewrite history without explicit user permission.

## Delivery checklist

- Update `WEB-MOBILE-FEATURE-MATRIX.md` when a feature changes status.
- Keep English and Turkish messages aligned.
- Verify light/dark themes, keyboard or screen-reader accessibility where supported, touch targets,
  long localized text, disabled/loading states, offline behavior, deep links, and logout.
- Document any intentional platform difference in the matrix instead of silently diverging.
- Before release, verify Android and iOS builds, secure storage, redirect registration, update
  configuration, and signed release behavior in their supported environments.
