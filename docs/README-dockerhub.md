# Spring Authorization Server Samples (GraalVM Native Image)

A Spring Boot 4.1, Java 25 and Spring Security 7 OAuth2 Authorization Server and OpenID Connect Provider. The published image is a statically linked GraalVM native executable published for `linux/amd64` and `linux/arm64`.

The image provides the authorization server, localized login and consent pages, the Administration Console, and the Account Console on port `9090`.

## Image

```bash
docker pull suayb/spring-authorization-server-samples:latest-native
```

The `latest-native` tag is published to Docker Hub from the `main` branch by GitHub Actions after the native build passes. The image is intended for demonstrations and sample deployments; configure an external PostgreSQL database before using it outside local testing.

## Included capabilities

- OAuth2 Authorization Server with OpenID Connect 1.0
- Authorization Code + PKCE, Refresh Token, Client Credentials, Token Exchange, and CIBA grants
- Token introspection, revocation, DPoP support, and OIDC logout
- Database-backed RSA JWK signing keys with passive public-key publication
- JPA-backed users, groups, roles, registered clients, consents, sessions, and audit events
- PostgreSQL production profile and Liquibase XML migrations with CSV seed data
- Hibernate second-level cache backed by JCache and Caffeine
- Administration Console and Account Console using public OIDC clients with PKCE
- User profile attributes, avatar management, TOTP MFA, recovery codes, and WebAuthn passkeys
- Optional Google, GitHub, LinkedIn, and Microsoft social login
- Actuator liveness, readiness, metrics, and Prometheus endpoints
- Optional OTLP metrics, traces, and logs for Grafana Cloud or a local LGTM stack

## Start with the repository Compose file

From a checkout of this repository, the prebuilt image can be started with PostgreSQL and the separate Liquibase migration container:

```bash
docker compose -f src/main/docker/app.yml up -d
```

The application is available at `http://localhost:9090`. Check readiness with:

```bash
curl http://localhost:9090/actuator/health/readiness
```

Stop the stack with:

```bash
docker compose -f src/main/docker/app.yml down
```

The Compose fixture is for development. PostgreSQL data is ephemeral unless the commented volume in `src/main/docker/postgresql.yml` is enabled.

## Run the image with an external PostgreSQL database

The published image is built with the `prod` profile and requires PostgreSQL settings:

```bash
docker run --rm -p 9090:9090 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/authserversamples \
  -e SPRING_DATASOURCE_USERNAME=appuser \
  -e SPRING_DATASOURCE_PASSWORD=appuser \
  -e APP_AUTHORIZATION_SERVER_ISSUER=http://localhost:9090 \
  suayb/spring-authorization-server-samples:latest-native
```

The application runs Liquibase migrations on startup. Set `SPRING_LIQUIBASE_DROP_FIRST=true` only for an intentionally disposable demo database because it removes existing objects before applying the changelog.

## Browser consoles

Open the following URLs after the application starts:

| Console | URL | Seeded users | Scope |
| --- | --- | --- | --- |
| Administration | `http://localhost:9090/admin` | `admin/admin` | `admin-api` plus the required administrative authority |
| Account | `http://localhost:9090/account` | `admin/admin`, `user/user`, `user2/user2`, `user3/user3`, `user4/user4`, `user5/user5`, `user6/user6` | `account-api` |

Both consoles use Authorization Code + PKCE, refresh-token rotation, and OIDC logout. The issuer and redirect URIs must use the same public address when the image is exposed through another hostname.

The public demo is available at [spring-authorization-server-samples.onrender.com](https://spring-authorization-server-samples.onrender.com).

## OAuth2 and OIDC checks

Fetch provider metadata and public signing keys:

```bash
curl http://localhost:9090/.well-known/openid-configuration
curl http://localhost:9090/.well-known/oauth-authorization-server
curl http://localhost:9090/oauth2/jwks
```

Request a client-credentials token with the seeded client:

```bash
curl -u demo-client:demo-secret \
  -H 'Accept-Language: en' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d grant_type=client_credentials \
  -d scope=openid \
  http://localhost:9090/oauth2/token
```

Inspect or revoke a token:

```bash
TOKEN=$(curl -s -u demo-client:demo-secret \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d grant_type=client_credentials \
  -d scope=openid \
  http://localhost:9090/oauth2/token | jq -r '.access_token')

curl -u demo-client:demo-secret \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d token="${TOKEN}" \
  http://localhost:9090/oauth2/introspect

curl -u demo-client:demo-secret \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d token="${TOKEN}" \
  -d token_type_hint=access_token \
  http://localhost:9090/oauth2/revoke
```

The seeded `ciba-client` supports the CIBA grant with poll delivery. The seeded `demo-client` also includes token exchange and CIBA grant types.

## Configuration

The most relevant environment variables are:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SPRING_PROFILES_ACTIVE` | `prod` in the published image | Select the Spring profile |
| `SERVER_PORT` | `9090` | HTTP listen port; Render sets this to `10000` |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/authserversamples` in `prod` | PostgreSQL JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | none in `prod` | Database username |
| `SPRING_DATASOURCE_PASSWORD` | none in `prod` | Database password |
| `SPRING_LIQUIBASE_ENABLED` | `true` | Enable Liquibase migrations |
| `SPRING_LIQUIBASE_DROP_FIRST` | `false` | Drop database objects before migration; use only for disposable demos |
| `APP_AUTHORIZATION_SERVER_ISSUER` | `https://spring-authorization-server-samples.local` | Public OAuth2/OIDC issuer |
| `APP_DPOP_NONCE_REQUIRED` | `false` | Require DPoP nonce validation |
| `MANAGEMENT_OPENTELEMETRY_ENABLED` | `false` | Enable OpenTelemetry resource/export configuration |
| `MANAGEMENT_TRACING_EXPORT_ENABLED` | `false` | Enable trace export |
| `MANAGEMENT_TRACING_EXPORT_OTLP_ENABLED` | `false` | Enable OTLP trace export |
| `MANAGEMENT_LOGGING_EXPORT_OTLP_ENABLED` | `false` | Enable OTLP log export |
| `MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED` | `false` | Enable OTLP metric export |
| `MANAGEMENT_OPENTELEMETRY_TRACING_EXPORT_OTLP_ENDPOINT` | empty | OTLP trace endpoint |
| `MANAGEMENT_OPENTELEMETRY_LOGGING_EXPORT_OTLP_ENDPOINT` | empty | OTLP log endpoint |
| `MANAGEMENT_OTLP_METRICS_EXPORT_URL` | empty | OTLP metric endpoint |
| `MANAGEMENT_TRACING_SAMPLING_PROBABILITY` | `1.0` | Trace sampling probability |

Keep OTLP authorization headers and database credentials in deployment secrets. Do not commit them to the repository or bake them into the image.

### Social login

Social providers are configured from **Administration → Settings → Login**. The provider enablement, Client ID, and Client Secret are stored in the database; secrets are encrypted before persistence. Keep `SOCIAL_LOGIN_ENCRYPTION_KEY` stable across restarts and deployments. Provider credentials are intentionally not read from application YAML or environment variables.

The callback URI is `https://<public-host>/login/oauth2/code/{registrationId}`. Register the exact callback URI with each provider.

## Health and management endpoints

```text
GET /actuator/health
GET /actuator/health/liveness
GET /actuator/health/readiness
GET /actuator/metrics
GET /actuator/prometheus
```

The application exposes liveness and readiness probes with the database included in readiness. Management endpoints should remain private to the cluster or deployment platform.

## Container deployment

The Render Blueprint in `render.yaml` deploys the same Docker Hub image with:

- image: `docker.io/suayb/spring-authorization-server-samples:latest-native`
- region: Frankfurt
- health check: `/actuator/health/readiness`
- port: `10000` through `SERVER_PORT`
- PostgreSQL and OTLP values supplied as Render environment variables

The GitHub Actions workflow builds amd64 and arm64 native images with GraalVM, publishes architecture-specific tags through Jib, combines them into the `latest-native` multi-arch manifest, and optionally triggers the Render Deploy Hook.

## Build and publish locally

Build the native executable:

```bash
./mvnw -Pprod,native -DskipTests native:compile
```

Build a local native image with Jib:

```bash
./mvnw -Pprod,native -DskipTests jib:dockerBuild \
  -Djib-maven-plugin.architecture=amd64 \
  -Djib.to.image=spring-authorization-server-samples:latest-native
```

The CI publish command uses the Docker Hub repository and tag below:

```text
docker.io/suayb/spring-authorization-server-samples:latest-native
```

## Notes

- The `latest-native` tag selects the `linux/amd64` or `linux/arm64` image automatically; architecture-specific tags are available as `latest-native-amd64` and `latest-native-arm64`.
- The image uses a static native executable and does not contain a shell or package manager.
- H2 is a development dependency and is not included in the published `prod,native` image.
- Liquibase seed data is the source of truth for users, groups, authorities, and registered clients.
- Keep at least one active RSA signing key and retain old public keys during key rotation.
- Use the repository README for the full API, Helm, Terraform, observability, and development documentation.
