# Spring Authorization Server Samples

[![Build Status](https://github.com/susimsek/spring-authorization-server-samples/actions/workflows/ci.yml/badge.svg)](https://github.com/susimsek/spring-authorization-server-samples/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=spring-authorization-server-samples&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=spring-authorization-server-samples)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=spring-authorization-server-samples&metric=coverage)](https://sonarcloud.io/summary/new_code?id=spring-authorization-server-samples)
[![Vulnerabilities](https://snyk.io/test/github/susimsek/spring-authorization-server-samples/badge.svg)](https://snyk.io/test/github/susimsek/spring-authorization-server-samples)
[![Docker Image Size](https://img.shields.io/docker/image-size/suayb/spring-authorization-server-samples/latest-native?label=Image%20Size)](https://hub.docker.com/r/suayb/spring-authorization-server-samples)
[![Java](https://img.shields.io/badge/Java-25-ED8B00?logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Maven](https://img.shields.io/badge/Maven-3.9+-C71A36?logo=apache-maven&logoColor=white)](https://maven.apache.org/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1-6DB33F?logo=spring-boot&logoColor=white)](https://spring.io/projects/spring-boot/)
[![Spring Security](https://img.shields.io/badge/Spring%20Security-Authorization%20Server-6DB33F?logo=springsecurity&logoColor=white)](https://docs.spring.io/spring-security/reference/servlet/oauth2/authorization-server/index.html)
[![Spring Data JPA](https://img.shields.io/badge/Spring%20Data%20JPA-Persistence-6DB33F?logo=spring&logoColor=white)](https://spring.io/projects/spring-data-jpa/)
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
5. [Configuration and Profiles](#configuration-and-profiles)
6. [RSA Signing Keys](#rsa-signing-keys)
7. [Persistent User Sessions](#persistent-user-sessions)
8. [Frontend](#frontend)
9. [Administration and Account Consoles](#administration-and-account-consoles)
10. [Run Locally](#run-locally)
11. [API Quick Overview](#api-quick-overview)
12. [OAuth2 and OIDC Endpoints](#oauth2-and-oidc-endpoints)
13. [Authorization Server Flows](#authorization-server-flows)
14. [Try with curl](#try-with-curl)
15. [Client Registration and Seed Data](#client-registration-and-seed-data)
16. [Database](#database)
17. [Internationalization](#internationalization)
18. [Build](#build)
19. [Performance Tests](#performance-tests)
20. [Code Quality](#code-quality)
21. [GraalVM Native Image](#graalvm-native-image)
22. [Docker Image](#docker-image)
23. [Kubernetes Health Probe](#kubernetes-health-probe)
24. [Docker Compose Support](#docker-compose-support)
25. [Helm](#helm)
26. [Terraform](#terraform)
27. [Continuous Integration](#continuous-integration)

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
value. Configure a stable `SOCIAL_LOGIN_ENCRYPTION_KEY` before saving secrets, and keep it stable
across restarts and deployments.

The registration endpoint always verifies the token server-side and rejects missing, expired,
invalid, or failed tokens before creating a user. The login filter verifies the login token before
Spring Security processes the username and password, so failed CAPTCHA requests never reach the
authentication provider. Tokens are generated at submit time for v3 so the backend can validate
the expected action and score.

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
- `/oauth2/authorize`
- `/actuator/health`
- `/actuator/health/liveness`
- `/actuator/health/readiness`

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
- `POST /oauth2/revoke`
- `POST /oauth2/introspect`

OIDC endpoints:

- `GET /connect/logout`

Health:

- `GET /actuator/health`
- `GET /actuator/health/liveness`
- `GET /actuator/health/readiness`

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

This sample currently focuses on metadata, JWK Set, authorization code, refresh token, client credentials, introspection, revocation, and logout.

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
| `demo-client` | `demo-secret` | `authorization_code`, `refresh_token`, `client_credentials` |
| `pkce-client` | `demo-secret` | `authorization_code`, `refresh_token` |

Seeded client scopes:

- `pkce-client`: `openid`, `profile`
- `demo-client`: `openid`, `profile`, `user.read`, `user.write`

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
./mvnw -B -ntp -Psonar verify sonar:sonar \
  -Dsonar.token="$SONAR_TOKEN"
```

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
  -Djib.to.image=spring-authorization-server-samples:latest-native
```

Run the native image with PostgreSQL:

```bash
docker run --rm -p 9090:9090 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/authserversamples \
  -e SPRING_DATASOURCE_USERNAME=appuser \
  -e SPRING_DATASOURCE_PASSWORD=appuser \
  -e APP_AUTHORIZATION_SERVER_ISSUER=http://127.0.0.1:9090 \
  spring-authorization-server-samples:latest-native
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
- App with prebuilt native image: `docker compose -f src/main/docker/app.yml up -d`

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
- an `ingress-nginx` controller reachable on host ports `8080` and `8443`
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
curl http://spring-authorization-server.127.0.0.1.nip.io:8080/.well-known/openid-configuration
```

Fetch the JWK Set:

```bash
curl http://spring-authorization-server.127.0.0.1.nip.io:8080/oauth2/jwks
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

Pipeline: `.github/workflows/ci.yml`

- `./mvnw verify` for backend tests + quality gates
- `./mvnw -Pprod,native -DskipTests native:compile` for a musl static native build
- Compress `target/native-executable` with UPX
- Push the native Docker image to Docker Hub on the `main` branch via Jib

Environment variables:

- SonarCloud: `SONAR_TOKEN` (optional)
- Snyk: `SNYK_TOKEN` (optional)
- Docker Hub push: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` (only on `main`)
