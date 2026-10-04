# Spring Authorization Server Samples

[![Build Status](https://github.com/susimsek/spring-authorization-server-samples/actions/workflows/ci.yml/badge.svg)](https://github.com/susimsek/spring-authorization-server-samples/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=spring-authorization-server-samples&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=spring-authorization-server-samples)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=spring-authorization-server-samples&metric=coverage)](https://sonarcloud.io/summary/new_code?id=spring-authorization-server-samples)
[![Vulnerabilities](https://snyk.io/test/github/susimsek/spring-authorization-server-samples/badge.svg)](https://snyk.io/test/github/susimsek/spring-authorization-server-samples)
[![Docker Image Size](https://img.shields.io/docker/image-size/suayb/spring-authorization-server-samples/latest?label=Image%20Size)](https://hub.docker.com/r/suayb/spring-authorization-server-samples)
[![Render](https://img.shields.io/badge/Render-Live%20Demo-46E3B7?logo=render&logoColor=white)](https://spring-authorization-server-samples.onrender.com)
[![Grafana](https://img.shields.io/badge/Grafana-Observability-F46800?logo=grafana&logoColor=white)](https://eagerlattice1653.grafana.net/d/spring-auth-prod/spring-authorization-server)
[![Java](https://img.shields.io/badge/Java-25-ED8B00?logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Maven](https://img.shields.io/badge/Maven-3.9+-C71A36?logo=apache-maven&logoColor=white)](https://maven.apache.org/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1-6DB33F?logo=spring-boot&logoColor=white)](https://spring.io/projects/spring-boot/)
[![Spring Security](https://img.shields.io/badge/Spring%20Security-Authorization%20Server-6DB33F?logo=springsecurity&logoColor=white)](https://docs.spring.io/spring-security/reference/servlet/oauth2/authorization-server/index.html)
[![Spring Data JPA](https://img.shields.io/badge/Spring%20Data%20JPA-Persistence-6DB33F?logo=spring&logoColor=white)](https://spring.io/projects/spring-data-jpa/)
[![Next.js](https://img.shields.io/badge/Next.js-Frontend-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-UI-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Electron](https://img.shields.io/badge/Electron-Desktop-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Liquibase](https://img.shields.io/badge/Liquibase-Migrations-2A62FF?logo=liquibase&logoColor=white)](https://www.liquibase.com/)
[![GraalVM](https://img.shields.io/badge/GraalVM-25%2B-FF6600?logo=graalvm)](https://www.graalvm.org/)
[![H2 Database](https://img.shields.io/badge/H2-Database-007396?logo=h2&logoColor=white)](https://www.h2database.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Docker Compose](https://img.shields.io/badge/Docker_Compose-Orchestration-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Orchestration-326CE5?logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![Helm](https://img.shields.io/badge/Helm-Charts-0F1689?logo=helm&logoColor=white)](https://helm.sh/)
[![Terraform](https://img.shields.io/badge/Terraform-Infrastructure-623CE4?logo=terraform&logoColor=white)](https://www.terraform.io/)
[![Codex](https://custom-icon-badges.demolab.com/badge/Codex-AI%20Agent-74aa9c?&logo=openai&logoColor=white)](https://openai.com/codex/)

This repository is a Spring Boot 4.1 + Java 25 sample application built around the Authorization Server support integrated into **Spring Security 7**. It acts as an OAuth2 Authorization Server and OpenID Connect Provider, stores users and clients in a relational database with Liquibase-managed schema, uses Spring Data JPA and Hibernate second-level cache with Caffeine/JCache, supports H2 for local development and PostgreSQL for production-style runs, loads RSA JWK signing keys from the database, and can be compiled as a GraalVM native executable.

## Table of Contents

1. [Features](#features)
2. [Requirements](#requirements)
3. [Project Layout](#project-layout)
4. [Configuration](#configuration)
5. [Observability](#observability)
6. [Configuration and Profiles](#configuration-and-profiles)
7. [RSA Signing Keys](#rsa-signing-keys)
8. [Persistent User Sessions](#persistent-user-sessions)
9. [Frontend](#frontend)
10. [Administration and Account Consoles](#administration-and-account-consoles)
11. [Run Locally](#run-locally)
12. [API Quick Overview](#api-quick-overview)
13. [OAuth2 and OIDC Endpoints](#oauth2-and-oidc-endpoints)
14. [Authorization Server Flows](#authorization-server-flows)
15. [Try with curl](#try-with-curl)
16. [Client Registration and Seed Data](#client-registration-and-seed-data)
17. [Database](#database)
18. [Internationalization](#internationalization)
19. [Build](#build)
20. [Performance Tests](#performance-tests)
21. [Code Quality](#code-quality)
22. [GraalVM Native Image](#graalvm-native-image)
23. [Docker Image](#docker-image)
24. [Kubernetes Health Probe](#kubernetes-health-probe)
25. [Docker Compose Support](#docker-compose-support)
26. [Helm](#helm)
27. [Terraform](#terraform)
28. [Continuous Integration](#continuous-integration)
29. [Project Policies](#project-policies)

## Features

- OAuth2 Authorization Server with OpenID Connect 1.0 enabled
- Authorization Code, Refresh Token, and Client Credentials grants
- RSA-signed JWT access and ID tokens
- Database-backed RSA JWK signing keys with active/passive key support
- JPA-backed registered client storage
- JPA-backed authorization and consent storage
- Form login backed by Spring Security and JPA user storage
- Optional account TOTP MFA with configurable issuer, algorithm, digits, period, clock-drift window, reusable-code policy, recovery codes, and required-action enrollment
- Built-in Administration and Account consoles using public OIDC clients with Authorization Code + PKCE, refresh tokens, and OIDC logout
- H2 in-memory database in PostgreSQL compatibility mode for `dev`
- H2 web console at `/h2-console` for local `dev`-profile database inspection
- PostgreSQL support for `prod`
- XML-based Liquibase schema migrations
- CSV seed data for authorities, users, user-authorities, and registered OAuth2 clients
- JPA auditing with `Instant` `created_at` and `updated_at`
- Hibernate second-level cache via JCache + Caffeine
- Spring Cache for user lookup, registered-client lookup, and database-backed JWK loading
- OIDC discovery metadata and JWK Set endpoints
- Actuator liveness and readiness probes
- Spotless, Checkstyle, Sonar, and JaCoCo quality gates
- GraalVM native executable build

## Requirements

- Java `25`
- Maven Wrapper (`./mvnw`)
- Kubernetes `1.24+`
- Helm `3.8.0+`
- Docker or Podman *(optional, for Jib, Docker Compose, and Helm deployments)*
- GraalVM Native Image `25+` *(optional, for native builds)*
- OpenSSL *(for RSA signing key generation)*
- `curl` *(optional, for OAuth2 endpoint testing)*
- `jq` *(optional, for parsing token responses)*

## Project Layout

- Application code: `src/main/java/io/github/susimsek/springauthserversamples`
    - `config`: Spring configuration
        - `aot`: GraalVM Native Image runtime hints
        - `cache`: Spring Cache and Hibernate second-level cache configuration
        - `security`: Spring Security and Authorization Server configuration
    - `domain`: JPA entities and auditing base class
    - `repository`: Spring Data JPA repositories
    - `service`: Authorization Server persistence adapters, user details, and JWK loading
    - `security`: localized security handlers, auditor/security utilities, and the database-backed `JWKSource`
    - `web`: lightweight MVC endpoints for sample landing output
- Configuration: `src/main/resources/config`
- Liquibase changelogs: `src/main/resources/db/changelog`
- Liquibase seed data: `src/main/resources/db/data`
- i18n messages: `src/main/resources/i18n`
- Native image metadata: `src/main/resources/META-INF/native-image`
- Docker compose files: `src/main/docker`
- Helm chart: `helm/spring-authorization-server-samples`
- Tests: `src/test/java`
    - Application unit/integration tests: `src/test/java/io/github/susimsek/springauthserversamples`
    - Gatling performance tests: `src/test/java/gatling/simulations`

## Configuration

Main configuration lives in `src/main/resources/config/application.yml`.

Important defaults:

- Application name: `spring-authorization-server-samples`
- HTTP port: `9090`
- Database: `jdbc:h2:mem:authserversamples`
- JPA DDL mode: `none`
- Liquibase changelog: `classpath:db/changelog/db.changelog-master.xml`
- Default issuer: `https://spring-authorization-server-samples.local`
- Hibernate second-level cache: enabled
- Cache provider: JCache backed by Caffeine
- Registration/login CAPTCHA: disabled by default; supports Google reCAPTCHA v2/v3 and reCAPTCHA Enterprise

### Registration CAPTCHA

The public `/register` and `/login` screens follow Keycloak's CAPTCHA model. Configure them from
`Admin Console > Settings > Login > Registration and login CAPTCHA`. Registration and login have
separate enable switches and actions; provider, public site key, Enterprise project ID, v2/v3
mode, score thresholds, and the `recaptcha.net` option are managed there. Public settings are
available from `GET /api/auth/registration-captcha` and `GET /api/auth/login-captcha`.

For standard Google reCAPTCHA, choose `recaptcha`, enter the site key and secret key, then set
`v3` for score-based verification or leave it disabled for the visible v2 checkbox. Choose a score
threshold between `0.0` and `1.0` for score-based verification.

For reCAPTCHA Enterprise, choose `enterprise`, enter the site key, Google Cloud project ID, and
API key. Enterprise verification checks the token's validity, the expected action, and the minimum
score. Enable `recaptcha.net` when the browser script should load from that domain instead of
`google.com`.

Secret/API key handling:

The admin API accepts the secret/API key only on an authenticated update and stores them encrypted
with AES-GCM in the `login_settings` table. The values are never returned to the browser; the
panel only receives a configured/not-configured flag. A blank secret field preserves the current
value. The demo profiles use a fixed sample encryption key; replace it with a deployment-managed
secret before using the production profile outside local development, and keep it stable
across restarts and deployments.

The registration endpoint always verifies the token server-side and rejects missing, expired,
invalid, or failed tokens before creating a user. The login filter verifies the login token before
Spring Security processes the username and password, so failed CAPTCHA requests never reach the
authentication provider. Tokens are generated at submit time for v3 so the backend can validate
the expected action and score.

## Observability

When enabled, the application exports metrics, traces, and Logback logs to Grafana Cloud over OTLP.
Telemetry is disabled by default; configure the standard `MANAGEMENT_*` OTLP variables in Render or
`.env` and keep authorization values out of source control. View the live demo data in
[Grafana Cloud Explore](https://eagerlattice1653.grafana.net/explore).

The production profile also exposes Micrometer metrics at `/actuator/prometheus` for Prometheus
scraping. The production dashboard is stored at
[`src/main/docker/observability/grafana/spring-authorization-server.json`](src/main/docker/observability/grafana/spring-authorization-server.json)
and the baseline Prometheus alert rules are stored at
[`src/main/docker/observability/prometheus/alerts.yml`](src/main/docker/observability/prometheus/alerts.yml).
The dashboard follows Keycloak's observability model: Prometheus collects the metrics and Grafana
renders the dashboard. Production request histograms are enabled so P95 and P99 latency panels are
available. Application Caffeine caches are pre-registered so hit, miss, eviction, size, and
eviction-weight meters are published from startup. The dashboard JSON and baseline alert rules
are kept under `src/main/docker/observability/`.

For local development, the repository includes Grafana's `grafana/otel-lgtm` image. It provides a
local OpenTelemetry Collector, Grafana, Loki, Mimir, and Tempo stack for traces, logs, and metrics.
Start it with its dedicated Compose file. The dashboard is provisioned automatically and opened as
Grafana's home dashboard, while `alerts.yml` is loaded as a Prometheus rule file:

```bash
docker compose -f src/main/docker/observability.yml up -d
```

Open Grafana at [http://localhost:3000](http://localhost:3000) with `admin` / `admin`. To export
telemetry from the locally running Spring Boot application over OTLP/HTTP, start it with:

```bash
MANAGEMENT_OPENTELEMETRY_ENABLED=true \
MANAGEMENT_TRACING_EXPORT_ENABLED=true \
MANAGEMENT_TRACING_EXPORT_OTLP_ENABLED=true \
MANAGEMENT_OPENTELEMETRY_TRACING_EXPORT_OTLP_ENDPOINT=http://localhost:4318/v1/traces \
MANAGEMENT_LOGGING_EXPORT_OTLP_ENABLED=true \
MANAGEMENT_OPENTELEMETRY_LOGGING_EXPORT_OTLP_ENDPOINT=http://localhost:4318/v1/logs \
MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED=true \
MANAGEMENT_OTLP_METRICS_EXPORT_URL=http://localhost:4318/v1/metrics \
./mvnw spring-boot:run
```

The LGTM image is intended for local development, demos, and testing; use Grafana Cloud or a
production OpenTelemetry deployment for production telemetry.

Console and file logs are plain text by default. Set `LOGGING_STRUCTURED_FORMAT_CONSOLE` or
`LOGGING_STRUCTURED_FORMAT_FILE` to `json` or `ecs` for structured output. HTTP access logging is
enabled by default and can be configured with `APP_LOG_SERVER_LEVEL` (`BASIC`, `HEADERS`, or
`FULL`), `APP_LOG_SERVER_EXCLUDE_PATHS`, and `APP_LOG_SERVER_FILE_ENABLED`. Set
`APP_LOG_SERVER_ENABLED=false` to disable it. The `enabled` switch controls whether a handler is
active; there is no `NONE` level. Shared Zalando-style obfuscation is configured under
`APP_LOG_OBFUSCATE_HEADERS`, `APP_LOG_OBFUSCATE_BODY_FIELDS`, `APP_LOG_OBFUSCATE_COOKIES`, and
`APP_LOG_OBFUSCATE_PARAMETERS`, and `APP_LOG_OBFUSCATE_REPLACEMENT`. Query parameters are included
in logged URIs and sensitive names are replaced with `***`. Outgoing HTTP
request metadata is disabled by default. For temporary diagnostics, set
`APP_LOG_CLIENT_ENABLED=true`; this logs method, redacted URI, status, duration, and exceptions
through the shared RestClient builder. Use `APP_LOG_CLIENT_LEVEL=HEADERS` to include masked request
and response headers, or `APP_LOG_CLIENT_LEVEL=FULL` to also capture bounded, masked text, JSON, and
form-encoded request and response bodies. `BASIC` logs method, URI, status, and duration. Body
capture for both inbound and outbound HTTP logs is limited to 8 KiB by default via
`APP_LOG_MAX_BODY_BYTES`; bodies with an unknown or over-limit response size are omitted so the
response stream is not consumed unexpectedly. Use
`APP_LOG_CLIENT_EXCLUDE_PATHS` for comma-separated outbound path prefixes. Body logging is disabled
by default and should only be enabled temporarily in a controlled environment. Set
`APP_LOG_SERVER_LEVEL=FULL` to include the bounded, masked inbound request and response bodies.
Access records carry
`direction=inbound` and `type=request`; outgoing client records carry `direction=outbound` and
`type=request` or `type=response`, with `outcome=failure` for failed calls. With structured logs
enabled, these are queryable fields in Grafana, for example
`{service_name="spring-authorization-server-samples"} | json | direction="outbound"`.

## Configuration and Profiles

Configuration lives under `src/main/resources/config`:

- `application.yml` (shared)
- `application-dev.yml` (H2, debug logs)
- `application-prod.yml` (PostgreSQL, production cache sizing)

Maven profiles:

- `dev` (default) - H2 in-memory database, devtools
- `prod` - PostgreSQL
- `native` - GraalVM native build + Jib native-image extension
- `docker-compose` - Spring Boot Docker Compose integration

`spring.profiles.active` in `application.yml` is filled via Maven resource filtering.

Cache defaults by profile:

- `dev`: `ttl=PT1H`, `initial-capacity=50`, `maximum-size=100`
- `prod`: `ttl=PT1H`, `initial-capacity=500`, `maximum-size=1000`

## RSA Signing Keys

RSA signing keys are stored in the `oauth2_key` table and loaded through a database-backed `JWKSource`.

Initial key material is seeded by Liquibase from:

```text
src/main/resources/db/data/oauth2-keys.csv
```

The seed contains the key type, signing algorithm, public/private key material, active state, `kid`, and JWK use.

Key selection rules:

- exactly one database row must have `active=true`;
- the active key is exposed with its private key to the internal `JWKSource` and is used for signing;
- inactive keys are exposed as public-only JWKs, so tokens issued before a rotation can still be verified;
- all keys remain published by the JWK Set endpoint until they are removed from the table.

The repository result is cached with Spring Cache, so database-side key changes become visible after cache expiry (or explicit cache eviction).

## Persistent User Sessions

Browser authentication sessions are persisted through a custom Spring Session repository backed by Spring Data JPA. The database model follows Spring Session JDBC semantics while using application-owned table names:

```text
USER_SESSION
USER_SESSION_ATTRIBUTES
```

The schema keeps the JDBC model's session id, creation/last-access timestamps, max inactive interval, expiry time, principal index, and binary session attributes. Expired sessions are cleaned every minute. Spring Security continues to use a regular `HttpSession`; `@EnableSpringHttpSession` transparently replaces the servlet-container session store with the JPA repository.

## Frontend
### Authorization UI localization

The frontend remains a Next.js static export. React Router resolves runtime paths such as
`/admin/users/123`, `/admin/clients/abc`, and `/admin/roles/42`; identifiers are never generated at build time.
Spring's `SpaFilter` forwards only frontend GET/HEAD HTML navigations to `/index.html`.
API, OAuth, well-known, actuator, assets and real backend endpoints are excluded.
The two callback pages are explicitly exported at `/admin/callback` and `/account/callback`.

All frontend URLs are locale-free, including `/login`, `/consent`, and `/auth-error`.
`next-i18next` v16 uses `localeInPath: false`, with client-only detection:

1. `locale` cookie
2. Supported browser language (`en` or `tr`)
3. English fallback

The language selector updates the cookie and i18next instance without changing the URL,
reloading the page, or resetting form input. Translation resources live in
`src/main/frontend/locales/{en,tr}/common.json`.
No request-time Next server APIs are used.

The login form still posts to Spring Security's standard `POST /login` endpoint.
PKCE, refresh-token handling, namespaced console token storage and browser SSO are unchanged.

The login screen is implemented with Next.js App Router + TypeScript and exported as static HTML/CSS/JS. The UI uses React-Bootstrap, Bootstrap, and Font Awesome while Spring Security remains responsible for authentication and session handling.

Maven manages a project-local Node.js runtime through `frontend-maven-plugin` and Corepack. The normal lifecycle runs pnpm install, TypeScript checking, and `next build`; the generated `src/main/frontend/out` directory is copied to Spring Boot's `static/` classpath.

```bash
./mvnw verify
```

Frontend-only development:

```bash
cd src/main/frontend
corepack enable
pnpm install
pnpm dev
```

The exported page is served at `/login` and submits credentials directly to Spring Security's `POST /login` endpoint. CSRF protection is intentionally disabled in this sample.

Frontend browser E2E tests use Playwright and are configured independently from the Electron
tests. With the server running on port `9090`, install the Chromium browser once and run:

```bash
cd src/main/frontend
pnpm test:e2e:install
pnpm test:e2e
```

Use `pnpm test:e2e:open` for Playwright UI mode, or set `E2E_BASE_URL` and the
`E2E_ADMIN_*`/`E2E_USER_*` credentials for another environment. The Electron package keeps its
own Playwright-based launch and test configuration under `src/main/desktop`.

### Electron desktop console

The Electron shell packages the same static renderer used by the web consoles. Start the
authorization server with the `dev` profile on port `9090`, then run:

```bash
cd src/main/desktop
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` uses `http://localhost:9090`; `pnpm start` uses the deployed Render API unless
`DESKTOP_API_BASE_URL` is explicitly supplied. Build platform installers with `pnpm package`.
Local development opens Electron DevTools automatically, so the Network panel can be used to
inspect renderer API, token refresh, and logout requests. The OAuth authorization page and the
main-process token exchange run outside that renderer panel; inspect the system browser for the
authorization redirect and use main-process diagnostics when debugging that exchange.
Run `pnpm --dir src/main/desktop test:unit` for main/preload security unit tests and
`pnpm --dir src/main/desktop test:e2e` for the Electron renderer smoke test. Linux CI runs the
Electron test under Xvfb; macOS and Windows run it on their native runners.
Branch builds upload Linux, macOS, and Windows installers as short-lived GitHub Actions artifacts.
To publish a versioned desktop release, push a version tag such as `v0.1.0`; the
`desktop-release` workflow attaches the platform installers to the matching GitHub Release.
Each release includes macOS x64 and universal DMG/ZIP packages, Linux x64 AppImage, Debian, RPM,
and Snap packages, Linux ARM64 AppImage and Debian packages, Windows NSIS, portable EXE, and AppX
packages, plus an SPDX JSON software bill of materials.
macOS and Windows CI packages remain unsigned until their platform signing credentials are configured;
Linux packages receive keyless Sigstore bundles in the release workflow.
The packaged app uses the `springauth://oauth/callback` protocol and stores console sessions in
the operating system's protected Electron storage. Release signing, macOS notarization, and
auto-update publishing require platform certificates and are not part of the unsigned local build.

To enable signing for the `desktop-release` GitHub Environment, configure these secrets without
committing certificate material: `MAC_CSC_LINK` and `MAC_CSC_KEY_PASSWORD` for the base64-encoded
macOS Developer ID `.p12`, `APPLE_API_KEY_BASE64`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER` for
notarization, and `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` for the base64-encoded Windows `.pfx`.
Linux always validates Debian metadata, publishes `SHA256SUMS`, and creates a Sigstore bundle beside
each AppImage, Debian, RPM, and Snap package. These keyless signatures are produced by GitHub Actions
through GitHub OIDC, so no paid certificate or private signing secret is required. Verify a package
with `cosign verify-blob <package> --bundle <package>.sigstore.json` and the release workflow identity
and Sigstore issuer. Adding `LINUX_GPG_PRIVATE_KEY` and the optional `LINUX_GPG_PASSPHRASE` also
publishes `SHA256SUMS.asc` for users who prefer GPG verification.

The packaged desktop app uses `electron-updater` with the GitHub Release metadata generated by
`electron-builder`. Update downloads are explicit: the app verifies the package hash from the
platform manifest, downloads only after the user confirms, and installs only after the complete
download succeeds. The release workflow can add detached Ed25519 signatures for `latest*.yml` by
setting the `UPDATE_MANIFEST_SIGNING_KEY` secret in the `desktop-release` environment; the matching
public key is derived during the build and bundled in the application. When a signature is present,
the desktop app verifies it before asking `electron-updater` to check for a package.
Set `DESKTOP_UPDATE_REQUIRE_SIGNATURE=true` for deployments that must reject unsigned manifests.
Failed signature, download, or installation preparation leaves the current installation in place.
The app also records a short startup health marker and reports an interrupted update on the next
launch. A true post-install binary rollback requires a platform-specific bootstrapper or installer
backup; `electron-updater` does not provide a portable rollback API, so the workflow does not claim
to replace the previous application binary automatically.

## Administration and Account Consoles

The static frontend also contains browser-based OIDC clients for administration and end-user account management. Both use the Authorization Code flow with PKCE (S256), obtain access, ID, and refresh tokens, refresh access tokens before they expire, and sign out through the OIDC end-session endpoint. Access, ID, and refresh tokens remain in browser memory; only the short-lived authorization transaction is retained across the redirect callback.

| Console | Entry URL | OIDC client | API scope | Access |
| --- | --- | --- | --- | --- |
| Administration | `/admin` | `admin-console` | `admin-api` | Administrative API permissions; the seeded `admin/admin` user has `ROLE_ADMIN` |
| Account | `/account` | `account-console` | `account-api` | Authenticated users, including `admin/admin`, `user/user`, `user2/user2`, `user3/user3`, `user4/user4`, `user5/user5`, and `user6/user6` |

The authorization server browser session provides SSO between the login screen and the console clients. The Admin Console includes client, client-scope, user, role, session, consent, signing-key, event, and server-information screens. The Account Console provides personal information, password, TOTP MFA, and one-time recovery-code security, authorized applications, and session-management screens.

The registered redirect and post-logout redirect URIs are seeded for `localhost:9090` and `https://spring-authorization-server-samples.local`. When deploying elsewhere, set `app.authorization-server.issuer` (or `APP_AUTHORIZATION_SERVER_ISSUER`) to the public address and register matching client redirect URIs.

## Run Locally

### Dev (H2)

The development profile uses the Liquibase-seeded sample JWK stored in `oauth2_key`.

Start the authorization server:

```bash
./mvnw spring-boot:run
```

The application listens on:

```text
localhost:9090
```

#### H2 Console (dev only)

Open [http://localhost:9090/h2-console/](http://localhost:9090/h2-console/) after starting the
application with the `dev` profile. Use:

- Driver Class: `org.h2.Driver`
- JDBC URL: `jdbc:h2:mem:authserversamples;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE`
- User Name: `sa`
- Password: leave empty

Select **Connect**. Use the exact JDBC URL above, not the console's default `jdbc:h2:~/test`.
This connects to the same in-memory database used by the application; restarting the application
resets its data. For a read-only check, run `SELECT COUNT(*) FROM OAUTH2_REGISTERED_CLIENT;`.

If `SPRING_DATASOURCE_USERNAME` or `SPRING_DATASOURCE_PASSWORD` is set in your environment,
those values override the defaults above. To explicitly use the local dev defaults without
changing your system environment:

```bash
./mvnw -Pdev spring-boot:run -Dspring-boot.run.arguments="--spring.datasource.username=sa --spring.datasource.password="
```

The console module is included only by the Maven `dev` profile. The console is disabled by
default, allows only local connections, and its frame/security exception applies only in
the Spring `dev` profile (never `prod`). See the
[Spring Boot H2 Console documentation](https://docs.spring.io/spring-boot/4.1/reference/data/sql.html#data.sql.h2-web-console).

### Prod (PostgreSQL)

Start PostgreSQL first:

```bash
docker compose -f src/main/docker/postgresql.yml up -d
```

Configure the datasource and issuer. Signing keys are loaded from the database and are seeded by Liquibase.

```bash
export SPRING_DATASOURCE_USERNAME=appuser
export SPRING_DATASOURCE_PASSWORD=appuser
export APP_AUTHORIZATION_SERVER_ISSUER=http://127.0.0.1:9090
```

Then run the app with the `prod` profile:

```bash
./mvnw -Pprod spring-boot:run
```

The application still listens on:

```text
localhost:9090
```

## API Quick Overview

Public infrastructure:

- `/.well-known/openid-configuration`
- `/.well-known/oauth-authorization-server`
- `/oauth2/jwks`
- `/oauth2/token`
- `/oauth2/bc-authorize`
- `/oauth2/authorize`
- `/actuator/health`
- `/actuator/health/liveness`
- `/actuator/health/readiness`
- `/actuator/metrics`
- `/actuator/prometheus`

Login and consent:

- `/login`
- `/oauth2/authorize`

OIDC:

- `/connect/logout`

## OAuth2 and OIDC Endpoints

Authorization Server endpoints:

- `GET /.well-known/oauth-authorization-server`
- `GET /.well-known/openid-configuration`
- `GET /oauth2/jwks`
- `GET /oauth2/authorize`
- `POST /oauth2/token`
- `POST /oauth2/bc-authorize`
- `POST /oauth2/revoke`
- `POST /oauth2/introspect`

OIDC endpoints:

- `GET /connect/logout`

Health:

- `GET /actuator/health`
- `GET /actuator/health/liveness`
- `GET /actuator/health/readiness`

Metrics:

- `GET /actuator/metrics`
- `GET /actuator/prometheus`

Framework endpoint families supported by Spring Security's Authorization Server:

- Authorization Server metadata: `GET /.well-known/oauth-authorization-server`
- OpenID Provider metadata: `GET /.well-known/openid-configuration`
- JWK Set: `GET /oauth2/jwks`
- Authorization: `GET /oauth2/authorize`
- Token: `POST /oauth2/token`
- Token introspection: `POST /oauth2/introspect`
- Token revocation: `POST /oauth2/revoke`
- OIDC logout: `GET /connect/logout`
- Optional when configured: `GET /userinfo`, `POST /oauth2/par`, `POST /oauth2/device_authorization`, `GET|POST /oauth2/device_verification`, `POST /connect/register`

This sample currently focuses on metadata, JWK Set, authorization code, refresh token, client credentials, CIBA, introspection, revocation, and logout.

## Authorization Server Flows

This sample behaves as an OAuth2 Authorization Server and OpenID Connect Provider. The main runtime responsibilities are:

- publish OIDC discovery metadata
- publish the JWK Set containing the active signing key and passive verification keys
- authenticate end users with form login
- authenticate OAuth2 clients with client credentials
- issue access tokens and refresh tokens
- persist registered clients, authorizations, and consents in the database
- support token introspection and token revocation

### Discovery and JWK Set

Use these endpoints first when integrating a client or resource server:

- `GET /.well-known/oauth-authorization-server`
- `GET /.well-known/openid-configuration`
- `GET /oauth2/jwks`

Discovery returns the issuer, endpoint URLs, supported grant types, and other provider metadata. The JWK Set endpoint exposes the public RSA key material used to validate issued JWTs.

### Client Credentials Flow

Use this flow for machine-to-machine access where no end user is involved.

Request:

```bash
curl -u demo-client:demo-secret \
  -H 'Accept-Language: en' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d grant_type=client_credentials \
  -d scope=openid \
  http://127.0.0.1:9090/oauth2/token
```

Behavior:

- client authentication uses HTTP Basic
- the token is issued directly from `/oauth2/token`
- no browser session, login page, or consent screen is involved
- this is the simplest flow to smoke-test the server

### Authorization Code Flow

Use this flow when an end user signs in through the authorization server.

Start authorization in a browser:

```text
http://127.0.0.1:9090/oauth2/authorize?response_type=code&client_id=demo-client&scope=openid&redirect_uri=http://127.0.0.1:8081/login/oauth2/code/demo-client
```

Then:

1. Sign in with a seeded user such as `admin/admin`.
2. Approve consent if the consent page is shown.
3. Copy the `code` query parameter from the redirect target.
4. Exchange the code for tokens with curl:

```bash
curl -u demo-client:demo-secret \
  -H 'Accept-Language: en' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d grant_type=authorization_code \
  -d code='<AUTHORIZATION_CODE>' \
  -d redirect_uri='http://127.0.0.1:8081/login/oauth2/code/demo-client' \
  http://127.0.0.1:9090/oauth2/token
```

Notes:

- `redirect_uri` must exactly match the value used in the authorize request
- this flow is not practical as a curl-only test because login and redirect handling require a browser
- this flow is the one that produces end-user authorization and consent records

### CIBA Backchannel Authentication Flow

The seeded `ciba-client` is a confidential client that uses the poll delivery mode. It has no
redirect URI because the user approves the request in the Account Console.

Ping and push clients must register a notification endpoint and send a fresh
`client_notification_token` with every backchannel request. The token is encrypted before it is
stored with the pending request and is sent as a bearer token only to the registered endpoint.
The demo profiles provide a fixed AES-GCM key for ping or push delivery. Replace that sample key
with a deployment-managed secret before using the production profile outside this demo.

Create a backchannel authentication request:

```bash
CIBA_RESPONSE=$(curl -s -u ciba-client:demo-secret \
  -H 'Accept-Language: en' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d scope='openid profile offline_access' \
  -d login_hint=admin \
  -d binding_message='Approve sign in' \
  http://127.0.0.1:9090/oauth2/bc-authorize)

AUTH_REQ_ID=$(printf '%s' "$CIBA_RESPONSE" | jq -r '.auth_req_id')
printf 'Approve this request in Account Console, then poll with auth_req_id=%s\n' "$AUTH_REQ_ID"
```

After the signed-in user approves the pending request at `/account/security`, poll the token
endpoint:

```bash
curl -u ciba-client:demo-secret \
  -H 'Accept-Language: en' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d grant_type=urn:openid:params:grant-type:ciba \
  -d auth_req_id="$AUTH_REQ_ID" \
  http://127.0.0.1:9090/oauth2/token
```

The first poll returns `authorization_pending`. After approval, the response contains an access
token, an ID token, and a refresh token because the seeded client requests `offline_access`.

### Confidential Client with PKCE

Use this flow when a confidential client still wants PKCE protection on top of client secret authentication.

What PKCE is:

- PKCE stands for Proof Key for Code Exchange
- it adds a second proof to the authorization code flow
- the client creates a random secret called a `code_verifier`
- the client sends only a derived value called a `code_challenge` in the browser redirect
- when the client later exchanges the authorization code for tokens, it must send the original `code_verifier`
- the authorization server compares the two values and only issues tokens if they match

Why this matters:

- an authorization code passes through the browser and redirect URL
- if that code is intercepted, PKCE makes the stolen code useless without the original `code_verifier`
- this is especially important for SPAs, mobile apps, and any flow that uses a browser redirect
- even confidential clients benefit from PKCE because it protects the authorization code itself, not just the client credentials

How to think about it:

- client secret proves who the client is
- PKCE proves that the same client that started the browser redirect is the one finishing the token exchange
- in this sample, `pkce-client` uses both protections together

Seeded PKCE client:

- client ID: `pkce-client`
- client secret: `demo-secret`
- client authentication method: `client_secret_basic`
- grant types: `authorization_code`, `refresh_token`
- redirect URI: `http://127.0.0.1:8082/callback`
- scopes: `openid`, `profile`
- PKCE: required

Flow summary:

1. The client generates `code_verifier` and `code_challenge`.
2. The browser is redirected to `/oauth2/authorize` with the `code_challenge`.
3. The user signs in and approves consent.
4. The authorization server redirects back with an authorization `code`.
5. The client calls `/oauth2/token` with:
    - client authentication
    - the authorization code
    - the original `code_verifier`
6. The server validates both the client credentials and the PKCE proof before issuing tokens.

Generate a PKCE verifier and challenge:

```bash
CODE_VERIFIER=$(openssl rand -base64 96 | tr -d '=+/' | cut -c1-64)
CODE_CHALLENGE=$(printf '%s' "${CODE_VERIFIER}" | openssl dgst -binary -sha256 | openssl base64 -A | tr '+/' '-_' | tr -d '=')
```

Start authorization in a browser:

```text
http://127.0.0.1:9090/oauth2/authorize?response_type=code&client_id=pkce-client&scope=openid%20profile&code_challenge=<CODE_CHALLENGE>&code_challenge_method=S256&redirect_uri=http://127.0.0.1:8082/callback
```

Then:

1. Sign in with a seeded user such as `admin/admin`.
2. Approve consent if prompted.
3. Copy the `code` query parameter from the redirect target.
4. Exchange the code with both client authentication and the PKCE verifier:

```bash
curl -u pkce-client:demo-secret \
  -H 'Accept-Language: en' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d grant_type=authorization_code \
  -d code='<AUTHORIZATION_CODE>' \
  -d code_verifier="${CODE_VERIFIER}" \
  -d redirect_uri='http://127.0.0.1:8082/callback' \
  http://127.0.0.1:9090/oauth2/token
```

Important PKCE notes:

- PKCE does not replace the authorization code flow; it strengthens it
- `code_verifier` must match the `code_challenge` used in the authorize request
- `code_challenge_method=S256` means the challenge is the SHA-256 hash of the verifier
- `require-proof-key=true` is enabled to prevent PKCE downgrade attacks
- this sample uses a confidential client with PKCE, so the token request still uses HTTP Basic client authentication
- `demo-client` is the non-PKCE confidential client in this sample

### Refresh Token Flow

Use this flow after an earlier grant returns a refresh token.

```bash
curl -u demo-client:demo-secret \
  -H 'Accept-Language: en' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d grant_type=refresh_token \
  -d refresh_token='<REFRESH_TOKEN>' \
  http://127.0.0.1:9090/oauth2/token
```

Behavior:

- the client re-authenticates with Basic auth
- a new access token is issued
- refresh token reuse and rotation behavior depends on the stored `token_settings`
- `offline_access` is optional and is never added as an implicit default scope
- an authorization that explicitly requests `offline_access` is kept outside the browser session,
  so its rotated refresh token remains usable after browser logout until the configured offline
  session idle timeout (`APP_OFFLINE_SESSION_IDLE`, default `P30D`)
- administrators can configure the global offline-session idle timeout and optional absolute
  lifetime from **Admin → Settings → Offline access**, revoke all offline sessions, and revoke
  individual offline sessions from **Admin → Offline sessions**
- client administrators can override the global idle and absolute lifetimes per OAuth client;
  users can review and revoke their own offline sessions from the Account Console

### Token Introspection

```bash
curl -u demo-client:demo-secret \
  -H 'Accept-Language: en' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d token="${TOKEN}" \
  http://127.0.0.1:9090/oauth2/introspect
```

### Token Revocation

```bash
curl -u demo-client:demo-secret \
  -H 'Accept-Language: en' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d token="${TOKEN}" \
  -d token_type_hint=access_token \
  http://127.0.0.1:9090/oauth2/revoke
```

### Logout

OIDC logout is exposed at:

- `GET /connect/logout`

## Try with curl

Fetch the OIDC discovery metadata:

```bash
curl http://127.0.0.1:9090/.well-known/openid-configuration
```

Fetch the Authorization Server metadata:

```bash
curl http://127.0.0.1:9090/.well-known/oauth-authorization-server
```

Fetch the JWK Set:

```bash
curl http://127.0.0.1:9090/oauth2/jwks
```

Seeded users:

| Username | Password | Authorities |
| --- | --- | --- |
| `admin` | `admin` | `ROLE_ADMIN`, `ROLE_USER` |
| `user` | `user` | `ROLE_USER` |
| `user2` | `user2` | `ROLE_USER` |
| `user3` | `user3` | `ROLE_USER` |
| `user4` | `user4` | `ROLE_USER` |
| `user5` | `user5` | `ROLE_USER` |
| `user6` | `user6` | `ROLE_USER` |

Seeded OAuth2 clients:

| Client ID | Client Secret | Grants |
| --- | --- | --- |
| `demo-client` | `demo-secret` | `authorization_code`, `refresh_token`, `client_credentials`, token exchange, CIBA |
| `ciba-client` | `demo-secret` | CIBA, refresh_token |
| `pkce-client` | `demo-secret` | `authorization_code`, `refresh_token` |

Seeded client scopes:

- `pkce-client`: `openid`, `profile`
- `demo-client`: `openid`, `profile`, `offline_access`, `user.read`, `user.write`
- `ciba-client`: `openid`, `profile`, `offline_access`

Get a client credentials token:

```bash
curl -u demo-client:demo-secret \
  -H 'Accept-Language: en' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d grant_type=client_credentials \
  -d scope=openid \
  http://127.0.0.1:9090/oauth2/token
```

Capture the access token:

```bash
TOKEN=$(curl -s -u demo-client:demo-secret \
  -H 'Accept-Language: en' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d grant_type=client_credentials \
  -d scope=openid \
  http://127.0.0.1:9090/oauth2/token | jq -r '.access_token')
```

Introspect the access token:

```bash
curl -u demo-client:demo-secret \
  -H 'Accept-Language: en' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d token="${TOKEN}" \
  http://127.0.0.1:9090/oauth2/introspect
```

Revoke the access token:

```bash
curl -u demo-client:demo-secret \
  -H 'Accept-Language: en' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d token="${TOKEN}" \
  -d token_type_hint=access_token \
  http://127.0.0.1:9090/oauth2/revoke
```

Check readiness:

```bash
curl http://127.0.0.1:9090/actuator/health/readiness
```

## Client Registration and Seed Data

Registered clients are loaded by Liquibase from:

```text
src/main/resources/db/data/oauth2-registered-clients.csv
```

That file seeds:

- `demo-client`
- BCrypt-encoded client secret
- allowed grant types
- redirect URI: `http://127.0.0.1:8081/login/oauth2/code/demo-client`
- post-logout redirect URI: `http://127.0.0.1:8081/`
- scopes: `openid`, `profile`, `user.read`, `user.write`
- PKCE not required
- `pkce-client`
- BCrypt-encoded client secret
- redirect URI: `http://127.0.0.1:8082/callback`
- post-logout redirect URI: `http://127.0.0.1:8082/`
- scopes: `openid`, `profile`
- PKCE required
- `ciba-client`
- BCrypt-encoded client secret
- CIBA grant with poll delivery mode
- scopes: `openid`, `profile`, `offline_access`
- serialized `client_settings`
- serialized `token_settings`

The database seed is the source of truth for registered clients.

## Database

Liquibase resources:

- Master changelog: `src/main/resources/db/changelog/db.changelog-master.xml`
- Changes: `src/main/resources/db/changelog/changes`
- Seed data: `src/main/resources/db/data`

Main tables:

- `users`
- `authorities`
- `user_authorities`
- `oauth2_registered_client`
- `oauth2_authorization`
- `oauth2_authorization_consent`

Development uses:

```text
jdbc:h2:mem:authserversamples;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
```

Production uses PostgreSQL.

## Internationalization

The sample keeps i18n message bundles under:

```text
src/main/resources/i18n
```

OAuth2 error responses support `Accept-Language`.

Example:

```bash
-H 'Accept-Language: tr'
```

## Build

Common commands:

```bash
./mvnw test
./mvnw failsafe:integration-test failsafe:verify
./mvnw verify
./mvnw gatling:test
./mvnw -DskipTests package
```

Integration tests only:

```bash
./mvnw failsafe:integration-test failsafe:verify
```

## Performance Tests

Performance tests are done with Gatling and are located in the `src/test/java/gatling/simulations` folder.

Shared Gatling defaults live in:

```text
src/test/java/gatling/GatlingDefaults.java
```

Run all simulations:

```bash
./mvnw gatling:test
```

The checked-in `OAuth2Simulation` exercises:

- `GET /.well-known/openid-configuration`
- `GET /oauth2/jwks`
- `POST /oauth2/token`
- `POST /oauth2/introspect`

The simulation ramps to the configured number of concurrent virtual users, keeps that load for
the configured duration, and fails when the global error rate exceeds 1% or the 95th-percentile
response time exceeds 2 seconds. Both thresholds can be overridden with
`maxFailurePercentage` and `maxResponseTimeMillis`.

Override common runtime parameters:

```bash
./mvnw gatling:test \
  -DhttpHost=127.0.0.1 \
  -DhttpPort=9090 \
  -Dusers=5 \
  -Dramp=1 \
  -Dduration=1 \
  -DmaxFailurePercentage=1.0 \
  -DmaxResponseTimeMillis=2000 \
  -DclientId=demo-client \
  -DclientSecret=demo-secret \
  -Dscope=openid \
  -Dlocale=tr
```

## Code Quality

### Checkstyle

```bash
./mvnw checkstyle:check
```

Config files:

- `checkstyle.xml`
- `checkstyle-suppressions.xml`

### Spotless

```bash
./mvnw spotless:check
```

Apply formatting:

```bash
./mvnw spotless:apply
```

### Sonar

```bash
export SONAR_TOKEN=...
./mvnw -B -ntp verify
./mvnw -B -ntp -Psonar initialize sonar:sonar \
  -Dsonar.token="$SONAR_TOKEN"
```

The Maven verification phase enforces a 96% instruction and line coverage floor
with JaCoCo. This keeps a one percentage point safety margin above the 95%
coverage target reported by SonarCloud. The SonarCloud project uses the
`Spring Authorization Server 95 Coverage` quality gate for that floor.

## GraalVM Native Image

Native executable:

```bash
./mvnw -Pprod,native -DskipTests native:compile
```

Output:

```text
target/native-executable
```

Native-image build arguments:

```bash
./mvnw -ntp -Pprod,native -DskipTests \
  -DbuildArgs="--no-fallback,-Os,--static,--libc=musl,--verbose,-J-Xmx6g" \
  native:compile
```

UPX compression:

```bash
upx --lzma --best target/native-executable
```

Run it:

```bash
SPRING_PROFILES_ACTIVE=prod \
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/authserversamples \
SPRING_DATASOURCE_USERNAME=appuser \
SPRING_DATASOURCE_PASSWORD=appuser \
APP_AUTHORIZATION_SERVER_ISSUER=http://127.0.0.1:9090 \
./target/native-executable
```

Then test health:

```bash
curl http://127.0.0.1:9090/actuator/health
```

Fetch the JWK Set:

```bash
curl http://127.0.0.1:9090/oauth2/jwks
```

## Docker Image

Build a JVM container image without a Dockerfile:

```bash
./mvnw -DskipTests jib:dockerBuild
```

Push to a registry:

```bash
./mvnw -DskipTests jib:build -Djib.to.image=YOUR_IMAGE
```

Defaults from `pom.xml`:

- Base image: `eclipse-temurin:25-jre-alpine`
- Platform: `linux/arm64`, override with `-Djib-maven-plugin.architecture=amd64` if needed

Native Docker image:

```bash
./mvnw -Pprod,native -DskipTests jib:dockerBuild \
  -Djib.to.image=spring-authorization-server-samples:latest
```

Run the native image with PostgreSQL:

```bash
docker run --rm -p 9090:9090 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/authserversamples \
  -e SPRING_DATASOURCE_USERNAME=appuser \
  -e SPRING_DATASOURCE_PASSWORD=appuser \
  -e APP_AUTHORIZATION_SERVER_ISSUER=http://127.0.0.1:9090 \
  spring-authorization-server-samples:latest
```

## Kubernetes Health Probe

```yaml
livenessProbe:
  httpGet:
    path: /actuator/health/liveness
    port: 9090
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /actuator/health/readiness
    port: 9090
  initialDelaySeconds: 10
  periodSeconds: 10
```

## Docker Compose Support

Files under `src/main/docker/*.yml` are marked as "dev purpose only".

- PostgreSQL: `docker compose -f src/main/docker/postgresql.yml up -d`
- OpenLDAP: `docker compose -f src/main/docker/openldap.yml up -d`
- App with prebuilt native image: `docker compose -f src/main/docker/app.yml up -d`
- Grafana OTel LGTM: `docker compose -f src/main/docker/observability.yml up -d`
- SonarQube Community for local analysis: `docker compose -f src/main/docker/sonar.yml up -d`

SonarQube is an independent Docker development tool and is not enabled by the Spring Boot `dev`
profile. Open [http://localhost:9000](http://localhost:9000) after starting it and sign in with
the local default account `admin` / `admin`.

### LDAP

The OpenLDAP fixture is for local development and end-to-end tests:

```bash
docker compose -f src/main/docker/openldap.yml up -d
```

Use `ldap://localhost:1389` with bind DN `cn=admin,dc=example,dc=com` and password `admin`.
The seeded user is `ldap-user` / `ldap-password`. Data is ephemeral by default; reset it with:

```bash
docker compose -f src/main/docker/openldap.yml down
```

To persist LDAP data, uncomment the service mounts and top-level volume declarations in
`src/main/docker/openldap.yml` together.

Spring Boot Docker Compose integration:

```bash
./mvnw -Pprod,docker-compose spring-boot:run
```

## Helm

- Chart: `helm/spring-authorization-server-samples`

The chart stores database credentials in a generated Kubernetes Secret by default, or can reference an existing Secret with `existingSecret.enabled=true`. RSA JWK signing keys are persisted in PostgreSQL and loaded from the `oauth2_key` table by all replicas.

Lint:

```bash
helm lint helm/spring-authorization-server-samples
```

Render:

```bash
helm template spring-authorization-server-samples helm/spring-authorization-server-samples
```

Create namespace:

```bash
kubectl create namespace apps --dry-run=client -o yaml | kubectl apply -f -
```

Install/upgrade:

```bash
helm upgrade --install spring-authorization-server-samples helm/spring-authorization-server-samples -n apps
```

Install/upgrade with values:

```bash
helm upgrade --install spring-authorization-server-samples helm/spring-authorization-server-samples -n apps -f helm/spring-authorization-server-samples/values.yaml
```

Check release:

```bash
helm list -n apps
kubectl get pods -n apps
kubectl get svc -n apps
kubectl get ingress -n apps
```

Uninstall:

```bash
helm uninstall spring-authorization-server-samples -n apps
```

To use an existing database Secret, provide keys named `database-username` and `database-password`:

```yaml
existingSecret:
  enabled: true
  name: my-database-secret
```

## Terraform

- Directory: `terraform`

Terraform provisions:

- a local `kind` cluster
- namespace `apps`
- namespace `ingress-nginx`
- an `ingress-nginx` controller reachable on host ports `9090` and `8443`
- the local Helm chart
- PostgreSQL from the chart dependency
- an active HTTP ingress for the Authorization Server

Initialize:

```bash
terraform -chdir=terraform init
```

Validate:

```bash
terraform -chdir=terraform validate
```

Plan:

```bash
terraform -chdir=terraform plan
```

Apply:

```bash
terraform -chdir=terraform apply
```

Apply with Podman:

```bash
export KIND_EXPERIMENTAL_PROVIDER=podman
terraform -chdir=terraform apply
```

Apply without confirmation:

```bash
terraform -chdir=terraform apply -auto-approve
```

Read kubeconfig and discovery URL:

```bash
export KUBECONFIG="$(terraform -chdir=terraform output -raw kubeconfig_path)"
terraform -chdir=terraform output -raw openid_configuration_url
```

Default ingress hostname:

```text
spring-authorization-server.127.0.0.1.nip.io
```

Example:

```bash
curl http://spring-authorization-server.127.0.0.1.nip.io:9090/.well-known/openid-configuration
```

Fetch the JWK Set:

```bash
curl http://spring-authorization-server.127.0.0.1.nip.io:9090/oauth2/jwks
```

Fallback access:

```bash
kubectl --kubeconfig="$(terraform -chdir=terraform output -raw kubeconfig_path)" \
  -n apps \
  port-forward svc/spring-authorization-server-samples 9090:9090
```

Destroy only the application Helm release:

```bash
terraform -chdir=terraform destroy -target=helm_release.spring_authorization_server_samples
```

Destroy all:

```bash
terraform -chdir=terraform destroy
```

Destroy without confirmation:

```bash
terraform -chdir=terraform destroy -auto-approve
```

## Continuous Integration

Validation pipeline: `.github/workflows/ci.yml`; versioned backend images: `.github/workflows/backend-release.yml`

- Docker Compose, Helm, and Terraform definitions are validated on every branch.
- `./mvnw verify` for backend tests + quality gates
- `./mvnw -Pprod,native -DskipTests native:compile` for musl static native builds on amd64 and arm64
- Compress each `target/native-executable` with UPX
- Build and verify amd64 and arm64 native executables on validated branch and pull-request runs
- Push architecture-specific native images to Docker Hub only for `v*` release tags via Jib
- Publish both the immutable release tag and the `latest` multi-arch manifest after both release images are available
- Optionally deploy a versioned release image through the existing `RENDER_DEPLOY_HOOK_URL`

### Render Blueprint deployment

`render.yaml` keeps the Render web service configuration in Git. It uses the published
`latest` multi-arch image and the `/actuator/health/readiness` health check. Connect the
repository in Render with **New → Blueprint**, select the `main` branch, and apply the Blueprint
to manage the existing `spring-authorization-server-samples` service. Render prompts for the
database URL, username, password, and public issuer because those values are marked `sync: false`.

Live demo: [Render](https://spring-authorization-server-samples.onrender.com)

Create a GitHub Actions repository secret named `RENDER_DEPLOY_HOOK_URL` from the service's
Render Deploy Hook. A successful `v*` release publishes the immutable release image and refreshes the `latest`
manifest before calling the hook. `autoDeploy` is disabled in the Blueprint, so branch builds and
registry pushes never restart Render. The same hook is reused by the release workflow for now: a
`v0.1.0` tag deploys the immutable `0.1.0` image to this service. A separate production service
and hook can be added later without changing the image build process.

Environment variables:

- SonarCloud: `SONAR_TOKEN` (optional)
- Snyk: `SNYK_TOKEN` (optional)
- Docker Hub push: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` (only on `v*` tags)
- Render release deploy: `RENDER_DEPLOY_HOOK_URL` (optional; only on `v*` tags)

## Project Policies

- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Apache-2.0 License](LICENSE.md)
