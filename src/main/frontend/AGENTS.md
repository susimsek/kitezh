# Frontend AI Agent Guidelines

These instructions apply to `src/main/frontend/**` and supplement the repository-root `AGENTS.md`. The root instructions remain applicable unless this file provides a more specific frontend rule.

## Table of Contents

1.  [Quick Reference](#quick-reference)
2.  [Project Structure](#project-structure)
3.  [Code Style and Quality Gates](#code-style-and-quality-gates)
4.  [Testing Guidelines](#testing-guidelines)
5.  [Authentication](#authentication)
6.  [Development Guidelines](#development-guidelines)
7.  [UI and Visual Standards](#ui-and-visual-standards)
8.  [Common Mistakes to Avoid](#common-mistakes-to-avoid)

## Quick Reference

| Action               | Command                                   |
| -------------------- | ----------------------------------------- |
| Install dependencies | `corepack pnpm install --frozen-lockfile` |
| Format check         | `pnpm format:check`                       |
| Type check           | `pnpm typecheck`                          |
| Lint                 | `pnpm lint`                               |
| Unit/component tests | `pnpm test:unit`                          |
| Production build     | `pnpm build`                              |
| Playwright E2E tests | `pnpm test:e2e`                           |

## Project Structure

- `app`: static SPA entry and explicit OAuth callback entries. `routing/AppRoutes.tsx` owns browser-only Administration, Account and public routes; no locale prefixes or build-time dynamic parameters.
- `components/admin`: Administration Console UI and shared administrative list/detail/form components.
- `components/account`: Account Console UI and account-management components.
- `components/auth`: login, consent, locale, theme, and shared authentication UI.
- `lib/console-auth.ts`: shared browser OIDC Authorization Code + PKCE, refresh-token, and logout adapter.
- `lib/admin-api.ts` and `lib/account-api.ts`: authenticated Administration and Account Console API clients.
- `store/reducers.ts` and `store/*-slice.ts`: the JHipster-style root reducer registry for shared auth, locale, and theme state; page-scoped API data stays local to its feature.
- `locales/en` and `locales/tr`: English and Turkish user-facing messages.
- `e2e`: frontend browser E2E specifications and shared Playwright fixtures. Electron tests remain independently configured under `src/main/desktop/e2e`.

## Code Style and Quality Gates

- Use TypeScript for application code. Do not weaken type safety with unnecessary `any`, unchecked casts, or ignored type errors.
- Follow `.editorconfig`: LF line endings, final newline, and no trailing whitespace. Do not edit generated build output.
- Use the repository's configured formatter and ESLint rules. Run `pnpm format:check`, `pnpm typecheck`, and `pnpm lint` after frontend changes.
- Keep components focused. Put API requests in `lib`, reusable UI primitives in `components`, and route composition in `routing`.
- Keep English and Turkish dictionaries aligned when adding or changing user-visible text. Do not hard-code user-facing strings in components when a dictionary key is appropriate.

## Testing Guidelines

- Keep Jest tests close to the component or library behavior they cover and use the existing test naming conventions.
- Test observable behavior: loading, successful state, empty state, validation, failed requests, authorization failures, and mutation feedback where relevant.
- Social-login UI coverage must verify provider discovery rendering, backend redirect targets, duplicate-click prevention, and the inline loading spinner; provider-owner authentication itself requires configured test credentials and must not be simulated by entering secrets into committed tests.
- New or materially changed console flows require component coverage and Playwright E2E coverage for the affected login, refresh/reload, direct deep-link, mutation, error, and logout paths.
- Keep Playwright route assertions aligned with the unprefixed route contract. Frontend and Electron suites use Playwright but keep separate package dependencies, configs, and launch targets so either application can be built and tested independently.
- Run `pnpm build` after changes to routes, static-export configuration, or production rendering behavior.

## Authentication

- The frontend is a Next.js static export served by Spring Boot. Spring Security continues to process `POST /login`; CSRF is intentionally disabled in this application.
- Keep console authentication in `lib/console-auth.ts` aligned with the project's Keycloak-style model: Authorization Code + PKCE, namespaced console token records, single-flight refresh near expiry, one retry after a 401, and OIDC logout with an ID-token hint and registered post-logout URI.
- Persist each console's access, ID, and refresh token set only in its namespaced `localStorage` record. Browser SSO remains supplied by the server-side Spring Session; never copy a token set from one console to the other.
- Use `adminRequest` for Administration Console APIs and `accountRequest` for Account Console APIs. Do not add parallel Axios clients, custom bearer-token handling, or a second console authentication flow.
- The public login page may render only the enabled, login-visible social providers returned by `/api/auth/social-providers`. The returned identifier is the administrator-configured provider alias (the built-in values are `google`, `github`, `linkedin`, or `microsoft`); use it unchanged in `/oauth2/authorization/{registrationId}` and account-linking URLs. Providers marked account-linking-only are intentionally absent from public login while remaining available to authenticated account linking. Providers without saved credentials remain visibly disabled until configured. Start each configured flow through a full-page browser redirect; do not route this backend endpoint through the SPA or implement provider token exchange in the browser.
- The Administration Console login settings page manages provider Client IDs and secret rotation through `/api/admin/settings/social-providers`; never render a stored secret back to the browser, and treat an empty secret field as "keep current".
- Social-login buttons are redirect actions: preserve the provider label, disable all provider buttons after submission, and show an inline spinner on the selected button until navigation completes. Keep English and Turkish divider/action messages aligned.
- Render provider branding from the server-provided allowlisted `iconKey` through the shared icon registry. Never load provider icon URLs or accept arbitrary icon names from API data; unknown keys must use the generic globe fallback on login and account-linking screens.
- Keep provider-level `shortStateParameter` and `caseSensitiveUsername` controls in the identity-provider form and submit them with the provider configuration; these switches are server-enforced and must not be inferred only from UI state.
- Social login creates and links the local account on the server. Never store provider access tokens or social identity subjects in browser storage, Redux, query strings, or frontend telemetry.
- The Account Console security page may list enabled provider configuration and link status from `/api/account/social-links`; the API identifier is the configured provider alias. Account Console visibility (`always`, `when-linked`, or `never`) is enforced by the server, and unconfigured providers remain visible but disabled only when the provider is configured for Account Console display. Starting a link must use the full-page `/account/social-links/{registrationId}/start` redirect so the server can require the existing local session and complete the OAuth callback. Show `Bağla` for configured unlinked providers and a confirmed `Kaldır` action for linked providers through `DELETE /api/account/social-links/{provider}`. Disable duplicate link/unlink clicks, show inline progress spinners, and keep provider subjects server-side.
- Provider tokens are never persisted in browser storage or exposed in provider-list responses. The authenticated Account API may read `GET /api/account/social-links/{provider}/token` only when the administrator enabled both encrypted token storage and stored-token readability for that provider; treat the response as sensitive and do not render or cache it in the UI.
- Do not use RTK Query, SWR, or React Query for server data. Keep authenticated requests in `lib`; use local component or feature-hook state for page-scoped API data and mutations. Use Redux for shared application state such as authentication, theme, and locale, and use a feature-level `createSlice`/`createAsyncThunk` only when data is genuinely shared across routes. Do not build a second global cache layer.
- Console routes use `/admin/` and `/account/`. Callback routes must remain aligned with registered-client redirect URIs. `next-i18next` manages client locale with `localeInPath: false`: `locale` cookie, browser languages, then English.

## Development Guidelines

### Forms and Validation

- All user-editable create and update forms must use React Hook Form with a Zod schema and `zodResolver`.
- Define required, trimming, length, format, range, collection, and cross-field rules in the schema; do not rely on HTML `required` alone or validate only after the API call.
- Use `noValidate` with React Hook Form, render field-level errors through the shared Bootstrap invalid-control pattern, and ensure submit validation focuses or navigates to the first invalid field/step.
- Render each field's validation message inside the same `Form.Group`, immediately after its control or `InputGroup`, using React-Bootstrap's built-in `Form.Control.Feedback` spacing. Do not render a password or other field error as a sibling below a completed field group; all screens must keep the input-to-message vertical gap consistent without one-off CSS.
- For validation inside an `InputGroup`, set `hasValidation` and render the feedback with Bootstrap's `d-block` utility immediately after the group so the message is visible with the grouped control.
- Do not manage submitted field values or validation errors with component-local state. Keep only transient UI state local, such as search input, selected table row, modal visibility, and loading state.
- Form validation messages must come from the localized dictionary. Map backend `ProblemDetail` violations to the matching React Hook Form fields where applicable.
- Clear a server-side field error as soon as the user changes that field, including forms using `onBlur` or the default `onSubmit` mode, so stale backend errors do not remain visible after the value is edited.
- Disable submission while a mutation is pending, show localized success/error feedback, and reset form values only after a successful server response.
- Route mutation success/error feedback through the shared `ConsoleAlerts` provider so notifications are rendered consistently and auto-dismiss after the standard timeout. Reserve inline alerts for persistent load failures and field-level validation; do not leave save or test-operation success alerts mounted indefinitely.
- Keep frontend validation consistent with backend constraints, but treat backend validation and authorization as authoritative; never remove server-side checks because a client schema exists.
- Administration settings forms keep editable controls in a single vertical column, matching the Keycloak-style settings layout; do not place settings inputs side by side in grid columns.

### Lists and API Responses

- Use `DataTable`, `ResourceFilters`, `PaginationControls`, and `useAdminTableState` for pageable console lists.
- Send `page`, `size`, `sort`, and filters to the server. Do not fetch a full pageable resource with `size=100` merely to render a table.
- When a screen contains multiple independent pageable lists, namespace their URL query parameters so one list cannot overwrite another list's pagination or filters.
- Use `whoami` access flags for navigation and action visibility, but handle backend 401/403 responses gracefully because backend authorization is authoritative.

### Routes and Static Export

- Every new static-export route must update route validation and include SPA fallback test coverage.
- Do not generate placeholder routes or use `generateStaticParams`. React Router resolves dynamic identifiers at runtime; Spring forwards frontend GET/HEAD HTML navigation to `/index.html`.
- Keep the login, Administration Console, and Account Console UI in `src/main/frontend`. Do not move application authentication behavior into Next.js.

## UI and Visual Standards

- Use the shared design tokens in `app/styles.css` for control heights, spacing, typography, radii, touch targets, and focus rings. Do not introduce one-off dimensions when an existing token covers the need.
- Keep visible form controls aligned to the shared sizes: normal `2.5rem`, small `2.25rem`, and large `3rem`. Apply the same rhythm to `Form.Control`, `Form.Select`, `InputGroup`, and action buttons.
- Use the shared semantic action colors consistently: `primary` for normal create/save/add/assign actions, `secondary` for cancel/back/copy/view actions, `danger` for destructive or session-invalidating actions, and `warning` only for sensitive cautionary operations.
- Do not use `outline-*` or `btn-outline-*` button variants. Use solid Bootstrap variants so controls remain legible in both `data-bs-theme="light"` and `data-bs-theme="dark"`.
- Do not hard-code theme-sensitive colors such as white or black for UI content. Prefer Bootstrap theme variables (`--bs-body-*`, `--bs-*-bg`, `--bs-*-text-emphasis`, `--bs-border-*`, and their RGB variables); preserve visible focus indicators with the shared focus-ring token.
- Keep page headers, breadcrumbs, form sections, cards, tables, modals, empty states, loading states, and responsive action areas aligned with the existing shared CSS classes before adding a new pattern.
- Use the shared spacing rhythm (`--console-space-*`) and surface/control radii. Keep table cells vertically centered, preserve horizontal scrolling for dense tables on small screens, and stack modal/form actions when space is constrained.
- Status badges must communicate the same state with the same semantic color across screens. Prefer filled, theme-compatible badges and avoid `text-bg-light` for content that must work on dark surfaces.
- Icon-only controls must meet the shared touch target where practical and include an accessible `aria-label` or equivalent visible name. Do not remove focus styles to achieve visual similarity.
- Use the centralized icon registry in `lib/icon-loader.ts` through the shared `Icon`, `ActionIcon`, and `AdminActionIcon` components. Use `ActionIcon`/`AdminActionIcon` for actions and `Icon` for decorative or navigational visuals. Do not import Font Awesome definitions directly into feature components or create one-off inline SVG/action icons.
- Reuse the same semantic icon for the same action everywhere (`save`, `edit`, `delete`, `disable`, `enable`, `unlock`, `view`, `copy`, `search`, and so on); add a registry entry before introducing a new action icon.
- Keep icon meaning independent from color, provide an accessible label for icon-only controls, and use localized visible labels for important actions. Decorative icons must be hidden from assistive technology.
- Prefer shared components and CSS classes for cards, forms, tables, alerts, modals, buttons, loading, empty, and error states. Add a new visual pattern only when an existing shared pattern cannot express the requirement.
- Check light/dark themes, keyboard focus, validation/error states, disabled/loading states, responsive layout, and long localized text for every materially changed screen.

## Common Mistakes to Avoid

- Replacing the shared Keycloak-style OIDC adapter with a custom token flow.
- Sharing or copying Admin and Account token records, or storing tokens outside the shared console-auth adapter.
- Adding a second HTTP client or manually attaching bearer tokens outside `adminRequest`, `accountRequest`, and the shared adapter.
- Using local component state instead of React Hook Form + Zod for editable form models.
- Fetching complete pageable resources to implement client-side pagination.
- Adding a new frontend route without static-export and fallback coverage.
- Hiding an action in the UI and treating that as an authorization control.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
