# Kitezh Electron Desktop Console PRD (Keycloak parity)

## Purpose

This product requirements document defines the Electron desktop console and its shared web renderer for the Kitezh application. It is based on an audit of the current Next.js static-export web client, Spring Boot APIs, shared UI components, observability setup, GitHub Actions pipeline, and Render image deployment. It compares the current implementation with Keycloak’s Admin and Account Console information architecture and JHipster’s operational dashboards, while preserving this project’s single-issuer model and existing security boundaries.

The term “desktop” means a packaged Electron application with a local renderer. The existing responsive Next.js UI remains the shared renderer source, while Electron packages its static output locally and connects to the Render-hosted Spring Boot API. Spring Boot remains the authority for authentication, authorization, validation, persistence, audit events, localization, and deployment health.

## Desktop console, shared components, and Render delivery

This section records the codebase audit and the implementation decisions needed to ship a maintainable Keycloak-like Electron desktop console. The application remains a Spring Boot resource server and authorization server with a statically exported Next.js renderer that is served by Spring Boot on the web and packaged locally by Electron.[^7]

### Audit baseline

The current repository already has the right foundation for a desktop-oriented console:

| Concern | Current implementation | Product implication |
| --- | --- | --- |
| Web runtime | Next.js App Router with `output: "export"`, trailing-slash routes, Bootstrap, React-Bootstrap, Redux, React Hook Form, Zod, and i18n | Build the static export once per release, serve it from Spring Boot on the web, and package the same output into Electron. |
| Admin shell | `AdminShell`, `AdminPageHeader`, `AdminBreadcrumb`, `DetailTabs`, `AdminGlobalSearch`, `ConsoleAlertsProvider` | The main navigation and interaction model exists; future work should compose shared primitives rather than replace the shell. |
| Account shell | `AccountShell`, `AccountPageHeader`, shared branding, theme, language, user menu, and alerts | The user console should share shell behavior and accessibility rules with Admin while keeping its own navigation and authorization. |
| Collections | `DataTable`, `ResourceFilters`, `PaginationControls`, `AsyncState`, `RowActions`, and bounded server-side APIs | Preserve predictable search, sort, page size, empty, loading, forbidden, and error states on every resource screen. |
| Branding and appearance | `BrandingProvider`, `BrandLogo`, `ThemeSwitcher`, `LanguageSwitcher`, SVG/icon registry, favicon and app icons | Branding is centralized enough for the current single issuer; preview and upload behavior must remain server-authorized and size-limited. |
| Search | `AdminGlobalSearch` with Cmd/Ctrl+K, grouped users/clients/roles/groups, keyboard escape, and `/api/admin/search` | Search is present. The next increment is keyboard result navigation, permission-aware result filtering, and a consistent no-results state, not a second search implementation. |
| Operational view | Dashboard counts, recent events, server information, signing-key information, and readiness status | This is an overview, not a full monitoring console. Metrics, health details, and log-level operations need an explicit Observability screen or external Grafana links. |
| Desktop delivery | `src/main/desktop` contains a pinned Electron main/preload package, a controlled `app://renderer` protocol, and a build script that packages the shared static export | Keep the Electron shell thin; CI packages Linux, macOS, and Windows installers, while signing and notarization remain release prerequisites. |
| Backend deployment | GitHub Actions builds web/backend and native images, publishes architecture tags and a multi-architecture tag, then triggers Render | The desktop client connects to the Render HTTPS API; image publication and Render deployment remain independent of Electron packaging. |

The audit also found two maintainability risks. `AdminShell` and `AccountShell` duplicate navbar, sidebar, branding, language, theme, user-menu, alert, and responsive behavior. In addition, asynchronous action behavior is implemented by individual forms and tables. These are suitable for incremental extraction into shared primitives; a wholesale rewrite would increase regression risk without improving the product contract.

### Electron application architecture

The desktop application must be a thin native shell around the same static renderer source used by the web console. The packaged app contains a generated local copy of the React build, but not a second implementation of the screens:

| Process | Responsibility | Prohibited behavior |
| --- | --- | --- |
| Main process | Create the single `BrowserWindow`, serve the packaged renderer through a private `app://` protocol, own OAuth callback/window policy, open approved external URLs, and coordinate updates | Do not render feature UI, duplicate API clients, or accept arbitrary IPC commands. |
| Preload | Expose a small typed `window.desktopApi` contract through `contextBridge` | Do not expose `ipcRenderer`, Node modules, filesystem access, shell access, or generic `send/on` functions. |
| Renderer | Load the packaged local static export through `app://` and run the same Next.js React components as the web console | No Node integration, no privileged Electron imports, no secrets in the bundle, and no arbitrary remote navigation. |
| Spring Boot/Render | Authenticate users, issue and revoke OAuth tokens, enforce permissions, persist data, audit mutations, and publish health/observability data | Never trust a renderer-only authorization decision or desktop-provided role claim. |

The package lives in a separate workspace at `src/main/desktop/` with `main`, `preload`, packaging configuration, generated renderer assets, and platform assets. The renderer source continues to come from `src/main/web`. Electron loads the generated local export through `app://renderer/` and calls the Render API through `DESKTOP_API_BASE_URL`, defaulting to `https://kitezh.onrender.com` in the packaged release and `http://localhost:9090` in local development. The backend must allow the exact desktop origin for the required API methods; wildcard CORS is forbidden.

The project layout is:

```text
src/main/desktop/
  package.json                 # Electron shell scripts and pinned tool versions
  tsconfig.json                # Main/preload TypeScript configuration
  electron-builder.yml         # Platform targets and signing hooks (or equivalent config)
  src/
    main.ts                    # BrowserWindow, single-instance lock, URL policy, secure vault
    preload.ts                 # Minimal contextBridge API; no raw IPC exposure
    api-base-url.ts            # Render API URL and local-development override
    security/auth-flow.ts      # PKCE callback, state, and token-response validation
    security/origin-policy.ts  # Exact renderer-origin and navigation allow-list
  assets/                      # Shared 1024px application icon
  test/                        # Callback, PKCE, and origin-policy tests
src/main/web/             # The only React UI shared by web and Electron
  app/
  components/
  lib/
  i18n/
```

`src/main/desktop/` must not contain copies of Admin or Account pages, dictionaries, API DTOs, validation schemas, or business rules. It is a separate Electron package, but it imports no feature UI; it packages the generated output of the common renderer. The web build continues to be copied into Spring Boot static resources, while the Electron package contains the same generated renderer plus the native shell and icons.

For the current local-renderer model, `src/main/web` is the shared source location. A separate `packages/ui` or published shared npm package is intentionally out of scope: there is one React renderer, and both the browser and Electron shell use its build output. Extracting a package now would add workspace/build/versioning overhead without creating a second independent UI implementation. Revisit a separate package only if a second native client or an independently versioned design system is introduced.

Electron security is a release requirement: use a current Electron version, `contextIsolation: true`, `nodeIntegration: false`, renderer sandboxing, restrictive CSP, no `webSecurity` bypass, no arbitrary remote navigation, and sender validation for every IPC message.[^9][^10][^11] The main process must serve the local renderer through a controlled custom protocol rather than broad `file://` access, allow only the app’s own paths, and open unexpected external destinations in the system browser after strict HTTPS allow-list validation.

### Desktop authentication and OAuth callback

The desktop renderer uses Authorization Code + PKCE with the system browser. The local renderer calls the Render authorization server through the configured API base URL; it does not embed arbitrary provider pages in a webview. A dedicated public desktop client uses a custom callback such as `kitezh://oauth/callback`, which Electron registers and forwards to the single running instance.[^13]

1. The Electron window loads the packaged `app://renderer/` export.
2. The renderer asks the preload bridge to start the selected console login.
3. The renderer creates the PKCE transaction, while the main process validates the state, verifier, client, redirect URI, and authorization-server origin before opening the URL and recording the pending request in memory.
4. The authorization server redirects to `kitezh://oauth/callback`; Electron validates the sender, state, issuer, and code, then exchanges the code over HTTPS.
5. The main process stores the access, ID, and refresh token set in the OS-protected vault and exposes only session operations to the renderer.
6. Logout revokes the refresh token when possible, calls OIDC logout with the ID-token hint, clears the vault, and returns the renderer to its local login route.

The backend must register a separate public desktop client with exact custom-protocol redirect URIs and PKCE requirements. It must not contain a client secret. Social-provider callbacks continue to terminate at the authorization server and return to the desktop callback after the provider flow completes.

### P0 implementation status

The initial P0 foundation is implemented in the repository. The Electron main process owns the encrypted session vault, validates the custom-protocol callback and PKCE state, exchanges the authorization code, and sends only a sanitized callback state to the renderer. The preload bridge validates its narrow typed contract, the renderer uses a desktop session adapter, and the backend allows only the configured `app://renderer` origin. Window bounds and maximized state are restored from a noncredential preferences file. The renderer shows a localized offline/API connectivity banner and a visible authorization/storage failure state instead of leaving the console on an endless loading spinner.

Automated desktop tests cover callback route parsing, callback sanitization, state expiry/mismatch, PKCE token-response validation, and renderer-origin enforcement. CI packages Linux, macOS, and Windows artifacts for version tags; Linux packages receive keyless Sigstore bundles, while platform certificates are still required for macOS and Windows signing. Platform update delivery and provider-backed browser E2E remain release work after this P0 foundation.

### Renderer session and IPC contract

The web console keeps its browser session adapter. Electron uses a separate `ElectronSessionAdapter` implemented through the preload bridge and main-process vault because its renderer is local and its API origin is remote. The main process must use asynchronous `safeStorage` backed by the platform keychain/DPAPI/secret store, with explicit unavailable-storage and recovery states.[^12] Tokens must not be stored in renderer `localStorage`, query strings, crash reports, or logs.

The initial typed bridge is intentionally narrow:

- `auth.startLogin(console, authorizationUrl, state, codeVerifier, clientId, redirectUri)`;
- `auth.getSession(console)` and `auth.setSession(console, tokens)` through the main-process vault;
- `auth.clearSession(console)`, `auth.clearAllSessions()`, and `auth.getStorageStatus()`;
- `openExternal(url)` for an allow-listed HTTPS origin;
- `app.getVersion()`;
- `window.onAuthCallback(callback)`;
- Update IPC is reserved for the signed-release phase and is not exposed yet.

Each method validates argument shape, console name, URL scheme, callback state, and sender identity. No bridge method accepts arbitrary channels, JavaScript source, filesystem paths, or shell commands. The desktop must display a clear API configuration error when `DESKTOP_API_BASE_URL` is unavailable; it must not silently fall back to an untrusted URL.

### Desktop window and platform behavior

- Enforce a single running instance. A second launch focuses the existing window and does not create a second renderer session.
- Restore window size and position without storing account data or tokens in the preferences file.
- Support light/dark mode, system theme detection, keyboard shortcuts, screen readers, high-contrast behavior, and the same responsive drawer behavior as the browser console.
- Use native menus only for application-level commands; feature actions remain in the shared React UI.
- Open documentation, Grafana, Swagger, and provider pages in the system browser after strict HTTPS host allow-list validation.
- Treat offline state as a first-class state: show the localized connectivity banner, keep the current authorization state conservative, and add mutation disabling when an offline queue is introduced.
- Do not expose a local development server in production packages.

### Desktop information architecture

The console should retain a stable three-layer structure:

1. **Global shell**: brand mark and product name, global search (Admin only), locale and theme controls, signed-in user menu, responsive navigation toggle, and a persistent content landmark.
2. **Resource shell**: sidebar navigation, breadcrumb, page title/description, primary actions, filters, result count, table, pagination, and an accessible detail route.
3. **Detail shell**: resource title and state, tab strip, section headings, section-level actions, forms/tables, and an explicit return path through the breadcrumb.

The desktop layout may use the available horizontal space for dense tables and side-by-side filters. At widths below the Bootstrap large breakpoint, the sidebar becomes a drawer, the backdrop closes it, actions wrap below the title, filters stack, tables expose horizontal scrolling, and no control may be clipped or require browser zoom. The same semantic order must be preserved at every breakpoint: breadcrumb, title, description, actions, filters, content, pagination.

Keycloak’s realm selector is intentionally omitted. This application has one configured issuer and must not display a fake realm switcher. The account console remains a separate user-facing navigation surface; it must not inherit Admin-only links or administrative authority assumptions.[^1]

### Shared component architecture

The fastest maintainable path is composition around a small set of shared components:

| Shared primitive | Required contract | Consumers |
| --- | --- | --- |
| `ConsoleShell` | Common navbar, responsive drawer, backdrop, content landmark, branding, locale, theme, alerts, and user menu; accepts an Admin or Account navigation model | `AdminShell`, `AccountShell` |
| `ConsoleNavbar` | Brand, search slot, locale/theme controls, user menu, mobile toggle, focus handling, and responsive overflow rules | Both consoles |
| `ConsoleSidebar` | Permission-filtered links, active-route matching, keyboard focus, drawer close on navigation, and stable footer | Both consoles |
| `AdminPageHeader` + `AdminBreadcrumb` | One title/description/actions layout; create actions stay in the header, immediately below the breadcrumb | All Admin resource pages |
| `DetailTabs` + `AdminDetailHeading` | Stable tab URLs, active-state semantics, section title/description/action alignment | User, group, role, client, settings, identity-provider, and policy details |
| `ResourceFilters` | Search, sort, active filters, and count only; no create/save action | All collection screens |
| `DataTable` + `PaginationControls` | Bounded page size, stable sort, loading/empty/error/forbidden rows, responsive overflow, and accessible headers | Users, groups, clients, roles, events, mappers, messages, sessions |
| `AsyncButton` | Existing label retained while pending, inline spinner, disabled duplicate submission, restored icon, and localized success/error feedback | Login, account, Admin, MFA, passkey, create, save, delete, and verification actions |
| `ConsoleFormField` | React-Bootstrap validation, `InputGroup hasValidation`, `d-block` feedback, labels, help text, and focus-on-first-error | All forms |
| `ConsoleAlerts` | One alert queue with success/error/info/warning dismissal, auto-dismiss policy, screen-reader announcement, and route-safe cleanup | All shells and mutable screens |
| `Icon`/`ActionIcon`/`BrandLogo` | Central icon registry and theme-aware SVG assets; no ad hoc Font Awesome markup in feature screens | All UI |

These components should be extracted only when a second consumer exists or a shared accessibility/behavior bug is being fixed. Feature components retain domain-specific data loading and authorization; the shared layer must not become a second service layer.

### One UI for web and Electron

Web and desktop must use the same React component tree, dictionaries, design tokens, route definitions, validation schemas, API DTOs, and test fixtures. The Electron shell is an adapter around the renderer; it is not a second Admin or Account web client.

The shared web package remains under `src/main/web`:

- `components/shared`, `components/auth`, `components/admin`, and `components/account` contain platform-neutral UI and domain behavior;
- `lib/*` exposes a typed `ConsoleSessionAdapter` and API client contract;
- the browser implementation persists its existing namespaced session record in browser storage;
- the Electron implementation supplies an `ElectronSessionAdapter` through the typed preload bridge, while its API adapter targets `DESKTOP_API_BASE_URL`;
- feature components depend on the contract, never on `electron`, `ipcRenderer`, `window.require`, or platform checks;
- a small `PlatformCapabilities` interface may expose safe capabilities such as `isDesktop`, `openExternal`, `getAppVersion`, and update status;
- the web adapter provides no-op or browser equivalents, so the same pages run under Spring Boot without Electron.

The build produces two delivery targets from one renderer build: Spring Boot static resources for the web console and a thin Electron shell containing the generated local renderer. The Electron API adapter prefixes backend calls with `DESKTOP_API_BASE_URL`, which points to the Render application URL. Route URLs, localized messages, form validation, loading/error states, authorization checks, and table behavior remain identical. Only the session adapter, API-base adapter, external-link adapter, update adapter, and native window commands differ between the web and desktop targets.

### Electron packaging and release

Use Electron Forge or an equivalent maintained packaging tool to produce signed installers. Electron’s distribution guidance requires packaging, platform code signing, and a signed update path for safe distribution.[^14][^15][^16]

The release matrix is:

| Platform | Primary artifact | Minimum release requirements |
| --- | --- | --- |
| macOS | Signed `.dmg`/`.zip` for arm64 and x64 | Apple signing and notarization, stable bundle identifier, Keychain-compatible signature, deep-link registration |
| Windows | Signed x64 installer; arm64 when supported by the selected maker | Authenticode signing, custom protocol registration, per-user update behavior |
| Linux | AppImage or deb for x64; arm64 where the runner/toolchain supports it | Package metadata, desktop entry, secure secret-store detection, explicit unsupported-secret-store warning |

GitHub Actions should build the renderer for the Render release, package the local renderer together with the thin Electron main/preload shell on supported runners, sign only with repository/environment secrets, publish checksums and a release manifest, and run a smoke test that opens the packaged app, calls the configured Render API, completes a test PKCE callback, loads the Admin and Account routes, and verifies logout. Electron artifacts are versioned with the renderer build, while the release records the compatible API base URL, backend issuer, and API version.

Automatic updates are opt-in and signature-verified. A failed update must leave the current signed version usable. The app must never download or execute an unsigned JavaScript bundle or native binary from an arbitrary URL.[^16]

### Feature map and parity gaps

The existing screen map should be retained and completed in the following order:

| Priority | Area | Current state | PRD requirement |
| --- | --- | --- | --- |
| P0 | Authorization and navigation | Backend authorization is authoritative and the sidebar hides unavailable areas | Add route-level forbidden states to every deep link, verify viewer/manager behavior, and keep sidebar visibility aligned with API permissions. |
| P0 | Forms and async actions | Shared React-Bootstrap forms and many inline spinners exist | Finish the `AsyncButton`/feedback contract across every mutable flow and focus the first invalid field. |
| P1 | Authentication flows | Password, OTP, WebAuthn, CIBA, and policy screens exist, but a complete flow/execution/binding editor is not yet a Keycloak-equivalent area | Add flow graph/execution/requirement/binding views only with matching backend APIs, persistence, authorization, audit events, and tests. |
| P1 | Identity brokering | Google, GitHub, LinkedIn, Microsoft, dynamic OIDC subset, mappers, sync modes, token/logout policies, and account linking are implemented | Keep provider CRUD, mapper CRUD, icon/alias/order, hide-on-login, account-linking-only, and secret rotation in one consistent detail layout; SAML and LDAP remain separate future work. |
| P1 | Branding and themes | Static, database-backed branding and light/dark assets exist | Complete an authorized preview and upload flow with MIME/size validation, cache invalidation, fallback assets, and login/admin/account/email theme separation if those themes are added. |
| P1 | Observability | Dashboard exposes counts, events, server information, signing key, and readiness | Add Admin → Observability with Overview, Health, Metrics, and Logs, or link clearly to Grafana. Never expose unrestricted actuator data through the public Render route. |
| P1 | Client authorization | Client roles, scopes, mappers, evaluation, sessions, consents, and events exist | Add resources, policies, permissions, and evaluation history only if Authorization Services is a supported product scope. |
| P2 | API discoverability | OpenAPI/Swagger is configured in Spring Security but not prominent in the console | Add an authorized Server Info/Help link to Swagger UI and OpenAPI JSON; do not duplicate the API documentation in React. |
| P2 | Notifications and help | A contextual `HelpItem` exists; there is no notification center | Add a notification center only when there is a durable event source and read/unread contract. A static bell with no backend is misleading. |
| P2 | Browser install experience | Browser-responsive shell and icons exist | Keep a web manifest optional for the browser deployment. Electron packaging is the required desktop delivery and must use the same renderer components. |

### Observability product requirements

JHipster’s monitoring model is a useful reference: a Metrics view for JVM/HTTP/cache/database metrics, a Health view for Actuator health, a Logs view for runtime logger levels, and security metrics.[^3][^4] The application should expose the same operational concepts while keeping sensitive operational endpoints protected.

The Admin → Observability screen should contain:

- **Overview**: availability, request rate, error rate, latency percentiles, deployment/image identity, instance identity, and the time range used by every panel.
- **Health**: liveness, readiness, started state, database, cache, and dependency status with the last transition time and a clear degraded/unknown state.
- **HTTP**: traffic by method, normalized URI, status, outcome, duration, request/response bytes, and trace exemplars. High-cardinality raw IDs and query strings must be removed or normalized.
- **JVM**: heap used/committed/max, non-heap, threads, class loading, GC count/pause/cause when the runtime publishes those meters, and native-image process memory where available.
- **Caches**: Caffeine cache name, hit/miss, puts, evictions, size, and invalidation events. Hibernate second-level statistics should be shown only when explicitly enabled and actually exported.
- **Database**: Hikari active/idle/max, acquisition time, pending threads, timeout count, and database health. SQL values and credentials must never be logged or displayed.
- **OAuth/security**: authorization, token, refresh, introspection, revocation, logout, CIBA, login failure, and consent counters with outcome labels.
- **Logs**: a link to Grafana Explore and, if an authenticated backend endpoint is added, bounded logger-level management with audit events. Raw actuator loggers must not be exposed anonymously.

The browser should consume a purpose-built, permission-checked summary API or signed Grafana links. It should not fetch `/actuator/prometheus`, `/actuator/metrics`, or log streams directly from a public Render ingress. Keep OTLP endpoints, Grafana tokens, and datasource credentials in Render/GitHub secret configuration only.

### Render deployment architecture

Render is configured as an image-backed Blueprint service in `render.yaml`. Render supports prebuilt image services, explicit port binding, and health checks; the Blueprint schema represents this as `runtime: image` with an `image` field.[^5][^6] The service uses the Frankfurt region, the free plan for the demo, `SERVER_PORT=10000`, and `/actuator/health/readiness` as its health check. PostgreSQL values, issuer, and OTLP credentials are supplied as Blueprint prompts or Render environment values; credentials must never be committed.

The packaged Electron app uses a local renderer and the Render deployment as its backend API. Its production configuration must set `DESKTOP_API_BASE_URL=https://kitezh.onrender.com`; local development may override this with `http://localhost:9090`. The value is a nonsecret, signed-release configuration value. The desktop API adapter must validate the URL scheme and exact host, prepend it to API and authorization requests, and never silently fall back to an arbitrary origin. The backend must allow the exact `app://renderer` origin for the required desktop API calls; wildcard CORS is forbidden.

The supported release path is:

1. GitHub Actions checks the repository, web client, backend, security, Compose, Helm, Terraform, and native-image metadata.
2. The native-image matrix produces versioned `${VERSION}-amd64` and `${VERSION}-arm64` images.
3. The publish job creates and verifies both the `${VERSION}` and `latest` multi-architecture manifests.
4. The workflow calls `RENDER_DEPLOY_HOOK_URL` after the manifest is available.
5. Render pulls the manifest-selected image for its architecture, starts the container on port `10000`, and waits for readiness.
6. The deployment smoke check verifies the public issuer, discovery document, readiness, login page, static assets, protected Admin route, and the API endpoints used by the Electron local-renderer smoke test.

Render’s prebuilt-image service does not rebuild from Git on every commit. Therefore `autoDeploy` is not the control plane for this service; the image tag/digest and deploy hook are. For reproducible production rollouts, record the immutable image digest in the release and retain the previous digest for rollback. The demo may continue to use `latest`, but the release log must record the resolved digest.

The deployment contract must also define:

- one source of truth for the image repository and tag;
- a failed-deploy alert and a readiness timeout;
- a rollback procedure to the previous digest;
- database bootstrap behavior appropriate for a demo (`SPRING_LIQUIBASE_DROP_FIRST=true` is destructive and must never be used for a persistent production database);
- public versus private actuator boundaries;
- OTLP export failure behavior that does not block login or token issuance;
- a secret rotation procedure for datasource, social-provider, Render hook, and Grafana credentials.

### Static export constraints

The web client is intentionally a static export. Next.js documents API routes, rewrites, redirects, headers, middleware, ISR, and default image optimization as unsupported or constrained for static export.[^7] Those server-only features must not be introduced into feature work unless the deployment architecture is changed first. Spring Boot remains the authority for authentication, authorization, API contracts, validation, persistence, audit events, and localization data.

Every new route must therefore satisfy all of the following:

- it has a statically generated page entry and trailing-slash-safe deep link;
- it loads data through the existing authenticated browser API adapters;
- it has loading, empty, forbidden, validation, and server-error states without server rendering;
- it preserves the current locale, theme, branding, and token-hydration behavior after a hard reload;
- it does not place secrets, provider credentials, or privileged decisions in client code;
- it is covered by a browser test for the main success path and a permission/error path.

### Security, data, and cache requirements

All new console features must follow the existing server-authoritative model. Hide unauthorized links for usability, but enforce the same decision on every HTTP method and deep link. Mutable administration operations must emit an audit event, invalidate affected sessions/authorizations when effective permissions change, evict the corresponding cache in the same transaction, and expose a bounded DTO rather than a JPA entity.

Use the existing cache policy: cache stable reference/configuration data, avoid caching sessions, audit events, one-time tokens, recovery codes, and filtered/paginated query results, and register every Hibernate second-level region explicitly. New Liquibase bootstrap data belongs in the create changelog/seed CSV for this demo; do not add corrective update changesets for initial bootstrap data.

### Verification and acceptance criteria

The PRD is complete only when the following checks are reproducible:

- backend `./mvnw verify`, Spotless, Checkstyle, focused integration tests, and native-image smoke start;
- web type check, lint, format, static build, and focused Admin/Account tests pass;
- Compose, Helm, Terraform, and Render Blueprint validation pass;
- an image manifest inspection confirms both supported architectures and the expected digest;
- a Render deployment passes readiness, discovery, static asset, login, and protected-route smoke checks;
- Admin and Account screens are usable at desktop, tablet, and narrow mobile widths in light and dark themes;
- keyboard-only navigation covers the shell, global search, tables, tabs, dialogs, and first-error focus;
- browser tests cover viewer/manager authorization, empty/error states, duplicate-click prevention, and logout/session expiry;
- Grafana logs, traces, metrics, and exemplars are linked to the same service name and release identity;
- no secrets, local tokens, generated build output, or environment-specific credentials are present in Git.

### Recommended delivery sequence

1. **Foundation**: extract `ConsoleShell`/navbar/sidebar contracts, standardize async buttons and alerts, and finish responsive/accessibility regression tests.
2. **Operations**: add the authorized Observability overview and Grafana links, health/readiness/startup display, and deployment smoke checks.
3. **Identity administration**: complete authentication flow/execution/binding and theme/branding parity where backend contracts exist.
4. **Authorization Services**: add client resources/policies/permissions only after the scope is explicitly approved.
5. **Hardening**: add the optional static web manifest, image-digest release records, rollback automation, and the remaining browser/Native/Sonar coverage.[^8]

This sequence gives the project a Keycloak-like desktop experience without copying Keycloak’s multi-realm assumptions, avoids a risky web-client rewrite, and keeps Render deployment reproducible.

## Sources

[^1]: Keycloak, *Server Administration Guide*, current Admin Console, authentication, themes, identity brokering, groups, clients, and Account Console: <https://www.keycloak.org/docs/latest/server_admin/>
[^2]: Keycloak, *UI customization and localization*, themes, message bundles, supported locales, and overrides: <https://www.keycloak.org/ui-customization/localization>
[^3]: JHipster, *Monitoring*, Metrics, Health, Logs, JVM, HTTP, cache, database-pool, and security monitoring patterns: <https://www.jhipster.tech/monitoring/>
[^4]: JHipster, *Monitoring documentation archive*, generated monitoring UI and logger-management behavior: <https://www.jhipster.tech/documentation-archive/v8.5.0/monitoring/>
[^5]: Render, *Web Services*, prebuilt image services, ports, health checks, and deployment behavior: <https://render.com/docs/web-services>
[^6]: Render, *Blueprint Specification*, image services, environment prompts, regions, and health checks: <https://render.com/docs/blueprint-spec>
[^7]: Next.js, *Static Exports*, supported and unsupported features for `output: "export"`: <https://nextjs.org/docs/14/pages/building-your-application/deploying/static-exports>
[^8]: Next.js, *Web app manifest*, static manifest metadata for installable browser experiences: <https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest>
[^9]: Electron, *Security*, security checklist for context isolation, sandboxing, navigation, CSP, IPC sender validation, and secure protocols: <https://www.electronjs.org/docs/latest/tutorial/security>
[^10]: Electron, *Context Isolation*, safe preload-to-renderer API exposure: <https://www.electronjs.org/docs/latest/tutorial/context-isolation>
[^11]: Electron, *Using Preload Scripts*, preload and IPC boundaries: <https://www.electronjs.org/docs/latest/tutorial/tutorial-preload>
[^12]: Electron, *safeStorage*, OS-backed encryption and asynchronous secret storage: <https://www.electronjs.org/docs/latest/api/safe-storage>
[^13]: Electron, *Deep Links*, custom protocol registration and single-instance callback handling: <https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app>
[^14]: Electron, *Distribution Overview*, packaging, code signing, publishing, and updates: <https://www.electronjs.org/docs/latest/tutorial/distribution-overview>
[^15]: Electron, *Packaging Your Application*, Forge packaging and platform signing requirements: <https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging>
[^16]: Electron, *Updating Applications*, signed auto-update delivery: <https://www.electronjs.org/docs/latest/tutorial/updates>
