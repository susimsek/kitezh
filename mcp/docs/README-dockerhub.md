# Kitezh MCP Server

Kitezh MCP Server is a separately deployed Model Context Protocol (MCP) service with read-only tools enabled by default and guarded, opt-in write tools for the Kitezh identity platform. It uses Spring Boot, Spring AI, and Streamable HTTP, and runs as a GraalVM Native Image executable compressed with UPX. The published image supports `linux/amd64` and `linux/arm64`.

The MCP endpoint listens on port `10000` at `/mcp`. The server has no database dependency: it authenticates the MCP user's OAuth access token and forwards that same token to the Kitezh Administration API.

## Image

```bash
docker pull suayb/kitezh-mcp:latest
```

Official links:

- Source: [github.com/susimsek/kitezh](https://github.com/susimsek/kitezh)
- Docker Hub: [hub.docker.com/r/suayb/kitezh-mcp](https://hub.docker.com/r/suayb/kitezh-mcp)
- MCP client setup: [mcp/README.md](https://github.com/susimsek/kitezh/blob/main/mcp/README.md)
- Product requirements: [Kitezh MCP Server PRD](https://github.com/susimsek/kitezh/blob/main/docs/KITEZH-MCP-SERVER-PRD.md)
- Kitezh Authorization Server: [kitezh.onrender.com](https://kitezh.onrender.com)
- Kitezh MCP endpoint: [kitezh-mcp.onrender.com/mcp](https://kitezh-mcp.onrender.com/mcp)

Docker selects the matching architecture from the `latest` multi-architecture manifest. Validated `v*` releases publish versioned architecture images such as `0.1.0-amd64` and `0.1.0-arm64`, then combine them into the versioned `0.1.0` and `latest` manifests. The MCP Render deployment is pinned to the verified image digest.

## Capabilities

- Stateless Streamable HTTP MCP endpoint at `/mcp`
- OAuth 2.0 bearer-token authentication with issuer, audience, and `mcp.read`/`mcp.write` scope validation
- Protected Resource Metadata at `/.well-known/oauth-protected-resource`
- Forwarding the validated user bearer token to the Kitezh Administration API
- Read tools for Kitezh context, users, groups, OAuth clients, sessions, and audit events
- Eight opt-in preview/apply write tools for user status, group membership, and single-session revocation
- Health, readiness, liveness, metrics, and Prometheus endpoints
- Optional OTLP metrics, traces, and logs for Grafana Cloud or an OpenTelemetry Collector
- GraalVM Native Image runtime assembled with the Jib Native Image extension

Write toolsets are excluded from `all` and require `mcp.write`, an eligible user role, and explicit server-side enablement. Each write uses a caller-bound, five-minute, single-use preview and checks for stale target state before applying. The client must request user confirmation before an `apply_*` call. The server never connects directly to the Kitezh database and never returns passwords, tokens, client secrets, or recovery codes.

## Run the image

The MCP resource URL must match the resource audience configured in the Kitezh Authorization Server. The Administration API must accept the forwarded token and enforce the MCP purpose-token route/method allowlist and the existing role authorization rules.

```bash
docker run --rm -p 10000:10000 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e SERVER_PORT=10000 \
  -e APP_AUTHORIZATIONSERVER_ISSUER=https://kitezh.onrender.com \
  -e APP_SECURITY_AUDIENCE=https://kitezh-mcp.onrender.com/mcp \
  -e APP_API_BASE_URL=https://kitezh.onrender.com \
  -e APP_MCP_PUBLIC_URL=https://kitezh-mcp.onrender.com/mcp \
  -e MANAGEMENT_OPENTELEMETRY_ENABLED=true \
  -e MANAGEMENT_TRACING_EXPORT_ENABLED=true \
  -e MANAGEMENT_TRACING_EXPORT_OTLP_ENABLED=true \
  -e MANAGEMENT_LOGGING_EXPORT_OTLP_ENABLED=true \
  -e MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED=true \
  -e MANAGEMENT_OPENTELEMETRY_TRACING_EXPORT_OTLP_ENDPOINT='<OTLP_COLLECTOR_URL>/v1/traces' \
  -e MANAGEMENT_OPENTELEMETRY_LOGGING_EXPORT_OTLP_ENDPOINT='<OTLP_COLLECTOR_URL>/v1/logs' \
  -e MANAGEMENT_OTLP_METRICS_EXPORT_URL='<OTLP_COLLECTOR_URL>/v1/metrics' \
  suayb/kitezh-mcp:latest
```

The native image includes OTLP exporter support so deployments can provide collector URLs at runtime. Supply valid trace, log, and metrics endpoints when running the published image. Store collector authorization headers in the deployment secret manager.

Check the server's readiness:

```bash
curl http://localhost:10000/actuator/health/readiness
```

## Connect an MCP client

Kitezh currently uses pre-registered OAuth clients and does not provide Dynamic Client Registration. Register a separate public OAuth client for each MCP host in Kitezh. Allowlist that host's exact localhost callback URI, enable Authorization Code with PKCE S256, and grant `openid` and `mcp.read`; add `mcp.write` only for hosts allowed to call explicitly enabled write tools.

### Claude Code

Register `http://localhost:8765/callback` as the callback URI on the Claude Code client, then run:

```bash
claude mcp add --transport http \
  --client-id '<claude-oauth-client-id>' \
  --callback-port 8765 \
  kitezh https://kitezh-mcp.onrender.com/mcp
```

Run `/mcp` in Claude Code and complete the Kitezh sign-in in the browser. The registered callback must match the callback port exactly.

### Codex

Register the exact localhost callback URI requested by Codex for its OAuth client, then add the server:

```bash
codex mcp add kitezh \
  --url https://kitezh-mcp.onrender.com/mcp \
  --oauth-client-id '<codex-oauth-client-id>'
```

Run `codex mcp login kitezh` and finish signing in through the browser. The Codex CLI and IDE extension use the same MCP configuration.

For MCP Inspector, configure the seeded `mcp-client` OAuth client with callback `http://localhost:6274/oauth/callback` and scope `mcp.read`; request `mcp.write` only when testing a write toolset.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SERVER_PORT` | `10000` | HTTP listen port |
| `SPRING_PROFILES_ACTIVE` | Spring's default profile | Select the Spring profile; set to `prod` for deployment |
| `APP_AUTHORIZATIONSERVER_ISSUER` | `https://kitezh.onrender.com` | OAuth issuer used to validate user tokens; follows the backend configuration property |
| `APP_SECURITY_JWK_SET_URI` | `<issuer>/oauth2/jwks` | Override the Authorization Server signing-key endpoint |
| `APP_SECURITY_AUDIENCE` | `https://kitezh-mcp.onrender.com/mcp` | Required audience on MCP access tokens |
| `APP_API_BASE_URL` | `http://localhost:9090` | Kitezh Administration API base URL |
| `APP_MCP_PUBLIC_URL` | `https://kitezh-mcp.onrender.com/mcp` | Public MCP resource identifier |
| `APP_CORS_ALLOWED_ORIGINS` | `app://renderer,http://localhost:6274,http://127.0.0.1:6274` | Browser origins allowed by MCP CORS; explicitly listed localhost origins also permit matching localhost Host values |
| `APP_MCP_TOOLSETS` | `all` | Enabled toolsets. `all` excludes `users_write`, `groups_write`, and `sessions_write`; combine `all` with a named write toolset, such as `all,users_write`, to opt in |
| `APP_MCP_ADDITIONAL_TOOLS` | empty | Exact comma-separated MCP tool names to add to the selected toolsets |
| `APP_MCP_TOOL_ALLOWLIST` | `*` | Exact comma-separated MCP tool names allowed by this deployment, intersected with selected toolsets, additional tools, and caller roles; `*` allows all selected names; scope and caller roles still apply |
| `APP_LOG_CLIENT_ENABLED` | `false` | Enable redacted outbound HTTP request/response logs |
| `APP_LOG_CLIENT_LEVEL` | `BASIC` | Outbound detail level: `BASIC`, `HEADERS`, or `FULL` |
| `APP_LOG_CLIENT_EXCLUDE_PATHS` | empty | Comma-separated path prefixes excluded from outbound logs |
| `APP_LOG_SERVER_ENABLED` | `true` | Enable inbound MCP access logs |
| `APP_LOG_SERVER_LEVEL` | `BASIC` | Inbound detail level: `BASIC`, `HEADERS`, or `FULL` |
| `APP_LOG_SERVER_EXCLUDE_PATHS` | health and metrics endpoints | Comma-separated regular expressions excluded from inbound access logs |
| `APP_LOG_SERVER_FILE_ENABLED` | `false` | Write access logs to a separate rolling file |
| `APP_LOG_SERVER_FILE_PATH` | `logs/application-access.log` | Inbound access log file path |
| `APP_LOG_FILE_ENABLED` | `false` | Write application logs to a rolling file |
| `APP_LOG_FILE_PATH` | `logs/application.log` | Application log file path |
| `APP_LOG_SYSLOG_ENABLED` | `false` | Enable Syslog output |
| `APP_LOG_SYSLOG_HOST` | `localhost` | Syslog host |
| `APP_LOG_SYSLOG_PORT` | `514` | Syslog port |
| `APP_LOG_SYSLOG_FACILITY` | `USER` | Syslog facility |
| `APP_LOG_SYSLOG_OUTPUT` | `default` | Syslog output format; `json` enables structured output |
| `APP_LOG_SYSLOG_JSON_FORMAT` | `default` | Structured Syslog format, such as `ecs` or `logstash` |
| `APP_LOG_ASYNC_ENABLED` | `true` | Send configured appenders through asynchronous queues |
| `APP_LOG_ASYNC_QUEUE_SIZE` | `512` | Async appender queue size |
| `APP_LOG_ASYNC_NEVER_BLOCK` | `false` | Drop log events instead of blocking when an async queue is full |
| `APP_LOG_MAX_BODY_BYTES` | `8192` | Maximum text body size considered for logging; larger/unknown bodies are omitted |
| `APP_LOG_OBFUSCATE_REPLACEMENT` | `***` | Replacement for sensitive values in logs |
| `APP_LOG_OBFUSCATE_HEADERS` | Authorization and cookie headers | Comma-separated sensitive header names |
| `APP_LOG_OBFUSCATE_BODY_FIELDS` | Common token and credential fields | Comma-separated sensitive JSON/form body field names |
| `APP_LOG_OBFUSCATE_PARAMETERS` | Common token and OAuth parameters | Comma-separated sensitive query/form parameter names |
| `LOGGING_STRUCTURED_FORMAT_CONSOLE` | `default` | Console format; set to `json` or `ecs` for structured logs |
| `LOGGING_STRUCTURED_FORMAT_FILE` | `default` | File format; set to `json` or `ecs` for structured logs |
| `LOGGING_STRUCTURED_ECS_SERVICE_NAME` | `kitezh-mcp` | ECS service name |
| `LOGGING_STRUCTURED_ECS_SERVICE_ENVIRONMENT` | Active Spring profile | ECS deployment environment |
| `MANAGEMENT_OPENTELEMETRY_ENABLED` | `false` | Enable OpenTelemetry resource/export configuration |
| `MANAGEMENT_TRACING_EXPORT_ENABLED` | `false` | Enable trace export |
| `MANAGEMENT_TRACING_EXPORT_OTLP_ENABLED` | `false` | Enable OTLP trace export |
| `MANAGEMENT_TRACING_SAMPLING_PROBABILITY` | `1.0` | Fraction of traces to sample |
| `MANAGEMENT_TRACING_EXEMPLARS_INCLUDE` | `sampled-traces` | Trace exemplars attached to metrics |
| `MANAGEMENT_LOGGING_EXPORT_OTLP_ENABLED` | `false` | Enable OTLP log export |
| `MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED` | `false` | Enable OTLP metric export |
| `MANAGEMENT_OPENTELEMETRY_TRACING_EXPORT_OTLP_ENDPOINT` | empty | OTLP trace endpoint |
| `MANAGEMENT_OPENTELEMETRY_LOGGING_EXPORT_OTLP_ENDPOINT` | empty | OTLP log endpoint |
| `MANAGEMENT_OTLP_METRICS_EXPORT_URL` | empty | OTLP metrics endpoint |

Keep OTLP authorization headers and deployment credentials in the platform's secret manager. Never put them in source control, the image, or a shared desktop MCP configuration.

Inbound and outbound body, header, and parameter redaction follows the shared `APP_LOG_OBFUSCATE_*` settings. Cookie values are protected through the `Cookie` and `Set-Cookie` header rules. Outbound logging is opt-in; `FULL` mode can include non-sensitive response content and should only be used for short diagnostic windows. Inbound access logging defaults to `BASIC`; `HEADERS` and `FULL` add more request details and should be enabled only for short diagnostic windows.

Toolset, additional-tools, and allowlist values are operator-controlled deployment settings. The effective catalog is the union of selected toolsets and additional tools, intersected with `APP_MCP_TOOL_ALLOWLIST` and the caller's role permissions. Client headers and tool arguments cannot widen these server-side limits. An empty allowlist disables all tools.

## Deploy

The repository Render Blueprint runs Kitezh MCP as a separate Web Service in Frankfurt, with an independent URL, configuration, secrets, readiness check, and release lifecycle. Tagged MCP releases build native binaries on GraalVM, compress them with UPX, publish architecture images through Jib, create multi-architecture Docker Hub tags, and deploy the verified image digest to Render.

The MCP service calls Kitezh over its API. Configure the API base URL to use Render private networking when available. The MCP and Kitezh services must be deployed with compatible API contracts.

## Health and management endpoints

```text
GET /actuator/health
GET /actuator/health/liveness
GET /actuator/health/readiness
GET /actuator/metrics
GET /actuator/prometheus
```

Keep management endpoints private to the deployment platform or cluster.
