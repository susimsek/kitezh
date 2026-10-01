# AI Agent Guidelines

This repo is a Java 25 + Spring Boot 4.1 sample application for the Authorization Server support integrated into **Spring Security 7**. It uses Spring Security 7 Authorization Server, Spring Data JPA, H2, PostgreSQL, Liquibase XML changelogs, Lombok, Caffeine/JCache, Spotless, Checkstyle, Sonar, JaCoCo, Helm, Terraform, Docker Compose, and GraalVM Native Image support.

## Table of Contents

1.  [Agent MCP Usage Guidelines](#agent-mcp-usage-guidelines)
2.  [Quick Reference](#quick-reference)
3.  [Prerequisites](#prerequisites)
4.  [Project Structure](#project-structure)
5.  [Code Style and Quality Gates](#code-style-and-quality-gates)
6.  [Testing Guidelines](#testing-guidelines)
7.  [Native Image & AOT Guidance](#native-image--aot-guidance)
8.  [Authentication](#authentication)
9.  [Development Guidelines](#development-guidelines)
10. [Pull Request and Commit Guidelines](#pull-request-and-commit-guidelines)
11. [Review Process & What Reviewers Look For](#review-process--what-reviewers-look-for)
12. [Common Mistakes to Avoid](#common-mistakes-to-avoid)

## Agent MCP Usage Guidelines

- Use Context7 when library/API documentation is needed for Spring Boot, Spring Security 7 Authorization Server, Spring Data JPA, Hibernate, Liquibase, Maven plugins, Helm, Terraform, or related setup/configuration details.
- Use the official Grafana MCP server (`mcp-grafana`) for Grafana Cloud observability work, including dashboards, metrics, logs, traces, and alerts. Connect it to the configured Grafana Cloud stack through `GRAFANA_URL` and a Viewer-scoped `GRAFANA_SERVICE_ACCOUNT_TOKEN`.
- Use the official SonarQube MCP server for SonarCloud quality gates, issues, coverage, code smells, and security findings. Run it locally over STDIO from the standalone Java 21+ JAR with `SONARQUBE_READ_ONLY=true`; do not depend on Podman or another container runtime for the local MCP connection.
- Use the GitHub MCP server for repository, branch, commit, pull request, issue, and workflow operations through the configured GitHub MCP endpoint. Authenticate with `GITHUB_PAT_TOKEN` and keep the token in local Codex or environment configuration only.
- Keep Grafana MCP credentials in the local Codex or environment configuration only; never commit service-account tokens or other Grafana credentials to this repository, Docker Compose files, Helm values, or documentation.
- Keep SonarQube MCP credentials in the local Codex or environment configuration only; never commit SonarQube tokens to this repository, Docker Compose files, Helm values, or documentation.
- Prefer official documentation or primary sources for framework behavior.

## Quick Reference

| Action | Command |
| --- | --- |
| Run dev server | `./mvnw spring-boot:run` |
| Run prod server | `./mvnw -Pprod spring-boot:run` |
| Run prod + docker-compose | `./mvnw -Pprod,docker-compose spring-boot:run` |
| Unit tests | `./mvnw test` |
| Integration tests | `./mvnw failsafe:integration-test failsafe:verify` |
| Performance tests | `./mvnw gatling:test` |
| Full verify | `./mvnw verify` |
| Format check | `./mvnw spotless:check` |
| Format apply | `./mvnw spotless:apply` |
| Checkstyle | `./mvnw checkstyle:check` |
| Package | `./mvnw -DskipTests package` |
| Native executable | `./mvnw -Pprod,native -DskipTests native:compile` |
| Sonar scan | `./mvnw -Psonar sonar:sonar` |

## Prerequisites

- Java: `25`
- Maven: use the wrapper (`./mvnw`)
- Optional local infrastructure tooling:
  - `terraform`
  - `kind`
  - `kubectl`
  - Docker or Podman
- Optional OAuth2 testing tools:
  - `curl`
  - `jq`
- Optional native build tooling:
  - GraalVM Native Image

## Project Structure

- `src/main/frontend`: Next.js App Router + TypeScript login, Administration Console, and Account Console UI built with pnpm, React-Bootstrap, Bootstrap, and Font Awesome. Maven exports it into Spring Boot static resources.
  - `routing/AppRoutes.tsx` and `components/admin`: Administration Console routes and UI.
  - `routing/AppRoutes.tsx` and `components/account`: end-user Account Console routes and UI.
  - `lib/console-auth.ts`: shared browser OIDC Authorization Code + PKCE, refresh-token, and logout adapter.

- Application root: `src/main/java/io/github/susimsek/springauthserversamples`
  - `config`: Spring configuration
    - `aot`: GraalVM Native Image runtime hints (`NativeRuntimeHints`)
    - `cache`: Spring Cache and Hibernate second-level cache configuration
    - `security`: Authorization Server security chains, localized handlers, security utilities, and the database-backed JWK source
  - `domain`: JPA entities (`UserEntity`, `AuthorityEntity`) and auditing base class
  - `repository`: Spring Data JPA repositories
  - `security`: authority constants, user-details service, and security utilities
  - `web`: sample landing endpoint
- Application config: `src/main/resources/config/application.yml`
- Liquibase:
  - Master: `src/main/resources/db/changelog/db.changelog-master.xml`
  - Changelogs: `src/main/resources/db/changelog/changes`
  - CSV seed data: `src/main/resources/db/data`
- i18n messages:
  - Default English: `src/main/resources/i18n/messages.properties`
  - Turkish: `src/main/resources/i18n/messages_tr.properties`
- Native image metadata:
  - Runtime hints: `src/main/java/.../config/aot/NativeRuntimeHints.java`
  - Resource-based GraalVM config: `src/main/resources/META-INF/native-image/**`
- Docker compose: `src/main/docker/*.yml`
- Helm chart: `helm/spring-authorization-server-samples`
- Terraform local infrastructure: `terraform`
- Tests: `src/test/java`
  - Unit and integration tests: `src/test/java/io/github/susimsek/springauthserversamples`
  - Gatling performance tests: `src/test/java/gatling/simulations`

## Code Style and Quality Gates

- Formatting: Spotless with `google-java-format` AOSP.
- Checkstyle runs in the `validate` phase.
- Follow `.editorconfig`:
  - LF line endings
  - final newline
  - no trailing whitespace
  - Java indent size 4
  - YAML indent size 2
- Avoid global coverage excludes for handwritten code.
- Do not edit generated or build output under `target/`.
- When you change code: apply formatting and ensure tests pass (`./mvnw spotless:apply` and `./mvnw test`).
- Before committing, inspect the changed code for the recurring Sonar findings listed below and fix
  them when applicable. Do not reintroduce these patterns:
  - `java:S5778`: keep runtime-exception tests to one method invocation.
  - `VariableDeclarationUsageDistance`: keep local declarations close to their first use.
  - `java:S8924`: statically import Mockito core methods where appropriate.
  - `java:S6809`: do not call Spring-proxied methods through `this`.
  - `java:S1192`: extract duplicated string literals when they represent the same concept.
  - `java:S7467`: use unnamed exception variables when the caught value is unused.
  - `java:S6201`: use pattern matching for `instanceof` checks.
  - `OverloadMethodsDeclarationOrder`: keep overloads adjacent or give distinct helper methods
    distinct names.
  - `java:S6213`, `java:S107`, `java:S1130`, `java:S1172`, `java:S1186`, and `java:S3776`:
    avoid restricted identifiers, excessive parameters, redundant throws, unused parameters,
    empty methods, and excessive method complexity.
  - `java:S5838` and `java:S5853`: use dedicated AssertJ assertions and chain consecutive
    assertions where the subject is the same.
  - `java:S1612`: prefer method references over equivalent lambdas.
  - `java:S6204`: use `Stream.toList()` only when an unmodifiable result is safe; preserve a
    mutable collection when downstream serialization or mutation requires it.
  - `EmptyCatchBlock`, `MissingSwitchDefault`, and JavaScript `S2486`: handle exceptions
    explicitly or document/log intentional fallback behavior, and make switch defaults explicit.
- Commit-time quality checks are `./mvnw spotless:check`, `./mvnw checkstyle:check`, the focused
  tests for the changed behavior, and `git diff --check`. Run the full Sonar analysis before
  pushing or in CI rather than on every commit. On Windows, prefer the Linux CI analysis for
  Checkstyle-backed Sonar results because CRLF checkout line endings can create false-positive
  `NewlineAtEndOfFileCheck` issues.
- Every frontend button that starts an asynchronous operation must show an inline progress spinner
  and disable repeated submission while the operation is pending. Keep the button's existing label
  while it is busy; do not add a separate "Saving..." or "Signing in..." label. Restore the normal
  icon when the operation completes. This applies to login, account, administration, MFA, and
  required-action flows, including save, create, delete, and verification actions.
- Administration list pages must render their primary create action in the shared
  `AdminPageHeader` actions area, aligned with the page title as on the Users page. Use the
  standard `btn-primary` style and `AdminActionIcon action="add"`, preserve the existing
  authorization check, and do not place the create button inside `ResourceFilters`. Create pages
  must keep their breadcrumb directly above the page header so all resource screens use the same
  visual order.
- For collection sections embedded under a settings or detail tab, place the section title,
  description, and its create/add action together in the section's `admin-detail-heading`, with
  the action aligned to the right. Examples include User profile attributes, Message overrides,
  and identity-provider Mappers. Do not move these section actions into the global page header or
  the filter toolbar. `ResourceFilters` must contain search, sorting, active-filter, and result
  count controls only.
- Frontend validation messages must remain inside the same field group immediately below the input
  or input group. Use React-Bootstrap's built-in `Form.Control.Feedback` spacing so the
  input-to-message vertical gap is consistent across login, account, administration, and
  required-action screens; do not add one-off custom CSS for this spacing.
- When a validated control is inside an `InputGroup`, use its `hasValidation` prop and Bootstrap's
  `d-block` utility on the feedback so the grouped field's message remains visible.

## Testing Guidelines

- Unit tests live under `src/test/java` and use singular class names ending with `Test`.
- Integration tests live under `src/test/java`, use singular class names ending with `IT`, and use the `@IntegrationTest` meta-annotation where applicable.
- Keep test class names class-based, for example:
  - `AuthorityEntityTest`
  - `UserEntityTest`
  - `SecurityConfigTest`
  - `DomainUserDetailsServiceTest`
  - `AuthorizationServerEndpointsIT`
- Keep integration tests focused on end-to-end wiring of Spring Boot, Spring Security, authorization server endpoints, persistence, and Liquibase-seeded client data.
- Maintain strong JaCoCo coverage for handwritten application code.
- New service behavior requires focused unit tests. New controller behavior requires an HTTP-level integration test when it changes an externally observable contract, authorization rule, persistence behavior, or Problem Detail response.
- Security-sensitive changes must test the affected authorization decision and session/token invalidation behavior.
- The current verification command is:
  - `./mvnw verify`

### Integration Tests

- Run all integration tests:
  - `./mvnw failsafe:integration-test failsafe:verify`
- Run a single integration test:
  - `./mvnw -Dit.test=AuthorizationServerEndpointsIT failsafe:integration-test failsafe:verify`
- Integration tests currently verify:
  - OpenID Provider metadata
  - JWK Set exposure
  - client credentials token flow
  - token introspection flow
  - readiness probe exposure
- Prefer HTTP-level tests for Authorization Server behavior instead of trying to unit-test framework internals.
- JaCoCo reports:
  - unit: `target/site/jacoco/jacoco.xml`
  - integration: `target/site/jacoco-it/jacoco.xml`

### Performance Tests

- Performance tests are implemented with Gatling under `src/test/java/gatling/simulations`.
- Shared Gatling runtime defaults live in `src/test/java/gatling/GatlingDefaults.java`.
- Run all simulations:
  - `./mvnw gatling:test`
- Common runtime overrides:
  - `./mvnw gatling:test -DhttpHost=127.0.0.1 -DhttpPort=9090 -Dusers=5 -Dramp=1 -Dduration=1 -DclientId=demo-client -DclientSecret=demo-secret -Dscope=openid -Dlocale=tr`
- The checked-in `OAuth2Simulation` covers:
  - OpenID discovery
  - JWK Set lookup
  - client credentials token issuance
  - token introspection

### OAuth2 Testing

- Server port: `9090`.
- OIDC discovery:

```bash
curl http://localhost:9090/.well-known/openid-configuration
```

- JWK Set:

```bash
curl http://localhost:9090/oauth2/jwks
```

- Seeded client credentials token:

```bash
curl -u demo-client:demo-secret \
  -H 'Accept-Language: en' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d scope=openid \
  -d grant_type=client_credentials \
  http://localhost:9090/oauth2/token
```

- Token introspection:

```bash
TOKEN=$(curl -s -u demo-client:demo-secret \
  -H 'Accept-Language: en' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d grant_type=client_credentials \
  -d scope=openid \
  http://localhost:9090/oauth2/token | jq -r '.access_token')

curl -u demo-client:demo-secret \
  -H 'Accept-Language: en' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d token="${TOKEN}" \
  http://localhost:9090/oauth2/introspect
```

- Health check:

```bash
curl http://localhost:9090/actuator/health/readiness
```

## Native Image & AOT Guidance

- Native builds use Spring Boot AOT and GraalVM Native Build Tools.
- Build with `./mvnw -Pprod,native -DskipTests native:compile`.
- Runtime hints live in `config/aot/NativeRuntimeHints`; resource-based reflection/resource config lives under `src/main/resources/META-INF/native-image`.
- Update `NativeRuntimeHints` when adding:
  - New i18n message bundles
  - New framework resources that native image must keep
- Liquibase resources under `db/changelog/**` and `db/data/**` are already included by the checked-in native-image resource configuration. Do not add `hints.resources().registerPattern("db/changelog/**")` or `hints.resources().registerPattern("db/data/**")` to `NativeRuntimeHints`.
- If native runtime fails because resources are missing, add focused `RuntimeHints` instead of broad classpath inclusion.
- Pay attention to Liquibase XML/CSV resources, i18n bundles, H2, Hibernate, Hibernate JCache, and the custom JPA-backed Authorization Server services when changing native-sensitive code.
- Verify a native executable after changes to authentication, sessions, persistence, static assets, Liquibase, or runtime hints. Add focused hints only; broad reflection, serialization, or resource allowlists are not acceptable.

## Authentication

- Form login is used for end-user authentication.
- Registered OAuth2 clients are stored in `oauth2_registered_client`.
- Seeded users for local dev: `admin/admin` and `user/user`.
- Seeded OAuth2 clients for local dev: `demo-client/demo-secret`, `pkce-client/demo-secret`, `admin-console`, and `account-console`.
- `admin-console` and `account-console` are public browser clients using Authorization Code + PKCE (S256), `refresh_token`, OIDC logout, and non-reused refresh tokens. Their local redirect URIs use `/admin/callback` and `/account/callback` respectively.
- The Admin Console requests `admin-api`; its APIs additionally require the relevant administrative authority. The Account Console requests `account-api`; `admin/admin` and `user/user` can use it.
- The issuer is configured via `app.authorization-server.issuer`.
- Client secrets are stored as BCrypt hashes in Liquibase seed data.
- The sample enables OpenID Connect 1.0.
- Exactly one `oauth2_key` row must be active; inactive rows are published as public-only verification keys.

## Development Guidelines

### Architecture

- Keep application-specific behavior in repository/config/security layers; do not try to reimplement Spring Authorization Server internals unnecessarily.
- Keep the custom JPA-backed Authorization Server services aligned with Spring Authorization Server's core model and JDBC schema semantics.
- Do not add ad hoc runtime seeders when a value belongs in Liquibase-managed seed data.

### Validation

- This sample does not use the gRPC Protovalidate layer from the original project.
- Validate every application request DTO with Jakarta Bean Validation and `@Valid`/`@Validated` at the controller boundary; do not rely on service-layer checks alone.
- Put constraints on the DTO field that owns the rule, including nullability, blank values, length, format, ranges, collection size, and cross-field rules where applicable.
- Use validation groups only when create/update semantics genuinely differ, and keep group selection explicit in the controller.
- Convert validation failures through the centralized Problem Detail contract, including stable field names and localized messages in both `messages.properties` and `messages_tr.properties`.
- Prefer request validation through Spring Security / Authorization Server defaults unless there is a clear application-specific need.
- Keep configuration minimal and consistent with framework defaults.

### DTOs, Mapping, and API Documentation

- Keep application request and response records under the relevant `dto/<feature>` package; never expose JPA entities directly from an application API.
- Annotate every DTO and every DTO field with Springdoc `@Schema` metadata: description, representative example, format where meaningful, and `requiredMode`. Use explicit enum and nullable documentation when applicable.
- Keep `@Schema` requiredness aligned with Bean Validation and actual runtime behavior; do not mark optional or nullable fields as required in OpenAPI.
- Document every controller operation with `@Operation`, relevant `@ApiResponse` entries, request/response schemas, representative examples, parameters, and `@SecurityRequirement`. Keep documentation on the controller contract, not in generated or ad hoc code.
- Use MapStruct mappers for entity-to-DTO, DTO-to-entity, and update mappings where a mapper exists or the mapping is non-trivial. Keep mapping orchestration out of controllers and avoid duplicating mapping logic in services.
- Place mapper interfaces under `mapper`, define explicit null/ignore behavior for partial updates, and add mapper tests when mappings contain derived fields, nested data, or security-sensitive values.
- Keep OpenAPI examples valid against the DTO constraints and current endpoint behavior; update documentation and tests together when a contract changes.

### API, Services, and Administration Flows

- Keep controllers limited to HTTP concerns. Put authorization checks, transactions, domain validation, mapping orchestration, and side effects in services.
- Put API request and response records under the relevant `dto/<feature>` package, use the `DTO` suffix, and use MapStruct for entity-to-DTO mapping where a mapper is warranted.
- Every application API error must use the centralized `ApiException` / `ApiErrorCode` / `ApiExceptionHandler` Problem Detail contract. Add localized message keys for new codes and map validation violations to field names.
- Document every application endpoint in its controller with Springdoc `@Operation`, request/response schemas, representative examples, and relevant security requirements. Do not add endpoint documentation programmatically when controller annotations can express it.
- Every mutable administration operation must define its authorization rule, audit event, cache impact, session/token impact, and tests before it is considered complete.
- Any change that affects a user's effective permissions, credentials, enabled state, group memberships, group role mappings, consent, or active authorization must invalidate affected browser sessions and OAuth2 authorizations through `UserAccessInvalidationService` in the same transaction.
- Use stable, resource-oriented audit event names such as `group.user.added` and include the resource type and identifier.
- Collection endpoints must use `Pageable`, default to `size=20`, enforce `size <= 100`, and use a stable default sort. Do not return unbounded collections from application APIs.
- List DTO assembly must not issue a repository query per row. Preload related data or use batch/aggregate queries for counts and derived fields to avoid N+1 behavior.
- Backend authorization is authoritative. Match UI access flags with explicit HTTP method and path rules, but never rely on hidden UI controls for protection.

### Error Handling and i18n

- Centralized domain exception handling is currently minimal compared to the original gRPC sample.
- Keep default messages in `messages.properties`; add Turkish translations in `messages_tr.properties`.
- Avoid adding custom exception layers unless they serve application-specific behavior that Spring Authorization Server does not already provide.
- In Java source, use imports and simple class names for application types. Keep fully qualified names only where a string value, logger/configuration key, reflection metadata, or another framework contract explicitly requires the name.

### Transaction Management

- Put `@Transactional` on service methods when introducing explicit service-layer logic.
- Use `@Transactional(readOnly = true)` for read-only paths.
- Avoid transaction annotations on configuration beans.

### Caching and indexing

- Keep Hibernate second-level caching enabled for stable, read-heavy reference and configuration entities: users and their authority/group collections, groups and authority collections, registered clients, client scopes, authorities, signing keys, required-action definitions, login settings, email settings, and authorization consents.
- Do not cache high-churn or one-time data such as authorization records, sessions, audit events, password history, recovery codes, action tokens, impersonation tickets, or login-rate-limit windows. Keep Hibernate query cache disabled for dynamic, filtered, and paginated queries.
- Cache repository lookups only when the key and invalidation path are explicit. Every administration update that changes cached configuration or reference data must evict the corresponding Spring cache in the same service transaction; user permission changes must also invalidate affected sessions as described above.
- Add indexes for foreign-key join columns and for frequently combined filter/order predicates used by repository queries. Keep the index in the existing table create changelog for bootstrap changes, avoid duplicate indexes already provided by primary or unique constraints, and use lowercase Liquibase types.

### Security

- Keep Authorization Server protocol endpoint security in `AuthorizationServerConfig` and application/login security in `SecurityConfig`.
- Keep user loading in `DomainUserDetailsService`.
- Keep authority constants in `AuthoritiesConstants`.
- Do not store plain text passwords or client secrets in seed data.
- Keep the Authorization Server filter chain scoped to authorization endpoints; do not collapse multiple chains into `anyRequest`.
- Preserve the current split between HTML login redirects and non-HTML localized OAuth2 error responses.
- Keep console authentication aligned with the Keycloak JavaScript adapter model: use Authorization Code + PKCE, refresh only when the access token is near expiry (or explicitly forced), and invoke the OIDC logout endpoint with the ID-token hint and registered post-logout URI.
- Persist each console's access, ID, and refresh token set in its namespaced browser `localStorage` record so a browser reload can hydrate Redux before the next API request. Replace that record atomically after every successful authorization-code or refresh-token exchange and remove it on logout or permanent refresh failure. OAuth authorization and token records remain in `oauth2_authorization`.

### Social login

- Social login is implemented with Spring Security OAuth2 Client. Provider enablement, Client IDs, and Client Secrets are managed from the Administration Console and persisted in the database, matching Keycloak’s identity-provider model. Do not add provider credential fallbacks to application YAML or environment variables. Keep `SOCIAL_LOGIN_ENCRYPTION_KEY` stable across restarts and deployments so encrypted provider secrets remain readable.
- Supported registrations are `google`, `github`, `linkedin`, and `microsoft`. Their callback URI is `http://localhost:9090/login/oauth2/code/{registrationId}` in local development; each provider application must register its exact callback URI.
- The login page obtains configured registrations from `GET /api/auth/social-providers` and starts the standard `/oauth2/authorization/{registrationId}` flow. It must keep the existing label, disable duplicate clicks, and show an inline spinner while redirecting.
- A successful provider response is converted into a local session authentication. `SocialLoginService` stores a unique `(provider, subject)` link in `social_identities`, creates the local `UserEntity` on first login, and assigns only `ROLE_USER`. The local username is a deterministic provider/subject-derived value; provider email and profile names are imported when present.
- A previously linked `(provider, subject)` always reuses its local user. A provider identity is never silently attached to an existing local account with the same email; the first-login flow stores the verified provider subject server-side, redirects to local login, and links it only after successful local re-authentication. The account security console also exposes an explicit provider-link flow backed by `/account/social-links/{registrationId}/start`; it must show `Bağla` for unlinked providers and a confirmed `Kaldır` action for linked providers, backed by the authenticated account DELETE endpoint. Never trust an email alone as a provider subject.
- Social users receive a random encoded password so the non-null local password invariant remains intact; the OAuth2 provider remains the only supported authentication path until the user explicitly establishes local credentials.
- Administrators can manage social provider Client IDs and rotate Client Secrets from `/admin/settings/login` through `/api/admin/settings/social-providers`. Secrets are encrypted with AES-GCM before persistence in `login_settings`; keep `SOCIAL_LOGIN_ENCRYPTION_KEY` stable across restarts and deployments. A blank secret means keep the currently configured secret. Microsoft credentials are entered there in production; no production client ID or secret is committed to the repository.

### Keycloak parity review

- The implementation follows Keycloak’s identity-broker model for provider-specific subject links, first-login local-user creation, profile import, local session establishment, and provider callback flows.
- When an unlinked social identity reports an email already owned locally, the sample follows the safe part of Keycloak’s First Broker Login behavior: it returns `account_link_required`, keeps only the verified provider subject in the server session, and requires local authentication before linking. Authenticated users can also start linking from the Account Console security page. It does not enable Keycloak’s deliberately unsafe automatic-linking variant.
- The implementation is intentionally limited to Google, GitHub, LinkedIn, and Microsoft. Additional Keycloak providers or arbitrary OIDC/SAML providers should be added through a focused registration/configuration change, not by accepting provider URLs from user input.

### Database and Liquibase

- Use XML-based Liquibase changelogs.
- Use lowercase database types in changelog XML (`bigint`, `varchar`, `boolean`, `timestamp`).
- Shared Liquibase properties such as `${now}` belong in `db.changelog-master.xml`.
- Registered client seed data lives in CSV and must stay aligned with `RegisteredClientEntity`, `RegisteredClientMapper`, and Spring Authorization Server's registered-client model.
- For DB changes: add a new Liquibase XML changelog and include it from `db/changelog/db.changelog-master.xml`.
- Social provider links are persisted in `social_identities`; keep the `(provider, subject)` unique constraint and cascading `user_id` foreign key aligned with `SocialIdentityEntity` and `SocialLoginService`.
- Do not modify existing changelogs that have already been applied unless this is still local sample bootstrap work and no migration history needs preservation.
- This repository is a demo bootstrap: do not use Liquibase `update`, `alter`, or follow-up seed correction changesets for schema or initial data changes. Put the final columns, constraints, and initial rows in the create changelog and its first seed CSV; keep related seed data in the existing feature CSV instead of adding separate correction files.
- Hibernate second-level cache uses JCache backed by Caffeine. Cache regions are configured in `config/cache/CacheConfig`.
- Every entity annotated with `@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)` must have a matching `Entity.class.getName()` region registered in `CacheConfig`; add the region and a focused `CacheConfigTest` assertion in the same change.

### Docker Compose (Optional)

- Spring Boot Docker Compose integration is enabled only with the Maven profile `-Pdocker-compose`.
- Compose config: `src/main/docker/services.yml`.
- Native image compose app: `src/main/docker/app.yml`.
- The application listens on port `9090`.

## Pull Request and Commit Guidelines

- Keep changes focused; avoid drive-by refactors in the same PR.
- Prefer small, logically grouped commits; avoid `WIP` or noisy fixup commits.
- Do not commit local generated output such as `target/`.
- Do not commit secrets. The sample credentials are for local development only.
- Before opening a PR: apply formatting and run tests (`./mvnw spotless:apply` and `./mvnw test`).
- Use **Conventional Commits**:
  - `feat`: new feature
  - `fix`: bug fix
  - `docs`: documentation only
  - `test`: adding or fixing tests
  - `chore`: build, CI, or tooling changes
  - `perf`: performance improvement
  - `refactor`: code changes without feature or fix
  - `build`: changes that affect the build system
  - `ci`: CI configuration
  - `style`: code style
  - `revert`: reverts a previous commit

## Review Process & What Reviewers Look For

- All automated checks pass (build, tests, Spotless, Checkstyle).
- Changes are focused and minimal; no unrelated refactors or drive-by cleanups.
- Commit history is clean, logical, and follows Conventional Commits.
- No secrets or environment-specific values are committed.
- PR description clearly explains what changed, how to verify, and any risks.
- Tests are added or updated when behavior changes.
- Social login changes must cover first-login creation, stable provider-subject reuse, safe handling of an existing local email, explicit account linking after local re-authentication, configured-provider discovery, account-console link status, and login-page redirect/spinner behavior.
- Cross-cutting impacts are explicitly called out when relevant:
  - Liquibase migrations
  - Security rules (`AuthorizationServerConfig`, `SecurityConfig`)
  - Native Image / AOT hints (`NativeRuntimeHints`)
  - Helm / Terraform values

## Common Mistakes to Avoid

- Reintroducing gRPC-specific assumptions into this HTTP/OAuth2 sample.
- Moving registered client seed logic back into runtime Java code instead of Liquibase.
- Editing build output under `target/`.
- Forgetting to run `./mvnw spotless:apply` before committing.
- Forgetting that port `9090` is now the sample’s default HTTP port.
- Changing `oauth2_registered_client` seed structure without checking `RegisteredClientEntity`, mapper behavior, and Spring Security's `RegisteredClient` model.
- Adding new Liquibase resources or native-sensitive framework usage without updating runtime hints where needed.

## Session persistence

- Browser authentication state uses Spring Session with the custom JPA-backed `JpaIndexedSessionRepository`.
- Keep `USER_SESSION` and `USER_SESSION_ATTRIBUTES` aligned with Spring Session JDBC schema semantics.
- OAuth authorization/token state remains in `oauth2_authorization`; do not duplicate it into session attributes.
- Session attributes use the dedicated Security Jackson JSON mapper through the `springSessionConversionService` bean. Keep JVM and native-image session serialization on this single path, and update native reflection hints when adding new persisted Spring Security session attribute types.
