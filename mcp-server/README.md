# Kitezh MCP Server

Kitezh MCP Server is an independent, read-only Spring Boot service. It exposes a stateless Streamable HTTP MCP endpoint at `/mcp`, validates user bearer tokens for its own resource audience, exchanges them at Kitezh's OAuth token endpoint, and calls only the Kitezh Administration API. It has no database dependency. The published container image documentation is in [README-dockerhub.md](README-dockerhub.md).

## Run locally

```bash
KITEZH_SECURITY_ISSUER_URI=http://localhost:9090 \
KITEZH_SECURITY_AUDIENCE=https://kitezh-mcp.onrender.com/mcp \
KITEZH_API_BASE_URL=http://localhost:9090 \
KITEZH_MCP_PUBLIC_URL=https://kitezh-mcp.onrender.com/mcp \
KITEZH_MCP_CLIENT_ID=mcp-server \
KITEZH_MCP_CLIENT_SECRET='<service-client-secret>' \
./mvnw -f mcp-server/pom.xml spring-boot:run
```

The Kitezh Authorization Server must have the dedicated MCP and API resource clients configured before tools can call the API. Register each MCP client's exact OAuth redirect URI, require PKCE S256, and grant only `mcp.read`, `admin-api`, and `roles` scopes. The `mcp.read` access token must have the MCP resource URI and `mcp-server` in its audience. Configure the confidential `mcp-server` client with token exchange, client credentials, delegation, and only the `admin-api` allowed audience. Configure `admin-api` as the API resource audience. Keep the matching confidential client secret in the runtime secret store. Do not use the local demo secret in a deployed environment.

The MCP resource URI is a stable identifier and must be identical in the authorization server's `APP_MCP_RESOURCE_AUDIENCE`, the MCP service's `KITEZH_SECURITY_AUDIENCE`, and `KITEZH_MCP_PUBLIC_URL`. The local example uses the Render URL as that stable resource identifier while connecting to the local server process. For a custom production domain, update all three values together.

## Connect an MCP client

The remote endpoint is `https://kitezh-mcp.onrender.com/mcp` (replace it with the MCP service's public URL if you use a custom domain). It uses Streamable HTTP and OAuth bearer tokens. Do not put an access token, client secret, or service credential in a checked-in MCP client config.

### Before connecting Claude Code or Codex

Kitezh uses pre-registered OAuth clients and does not currently implement Dynamic Client Registration (DCR). Register a separate public OAuth client for each MCP host in the Kitezh Authorization Server. Add that host's exact localhost callback URI to its redirect URI allowlist, enable Authorization Code + PKCE (S256), and grant only `openid` and `mcp.read`. Use the issued client ID in the host configuration below. Do not reuse `mcp-server`; that confidential client is only for server-side token exchange. The seeded `mcp-client` client is for MCP Inspector at `http://localhost:6274/oauth/callback`, not Claude Code or Codex.

### Claude Code

Pick a fixed callback port and register `http://localhost:8765/callback` on the Claude Code public client. Then add the remote server and authenticate:

```bash
claude mcp add --transport http \
  --client-id '<KITEZH_CLAUDE_CLIENT_ID>' \
  --callback-port 8765 \
  kitezh https://kitezh-mcp.onrender.com/mcp
```

In Claude Code, run `/mcp` and complete the Kitezh sign-in flow in the browser. Confirm the connection with `claude mcp get kitezh` or `claude mcp list`. The callback must match the URI registered for that OAuth client exactly.

### Codex

Add the remote endpoint with the separately registered Codex public client ID:

```bash
codex mcp add kitezh \
  --url https://kitezh-mcp.onrender.com/mcp \
  --oauth-client-id '<KITEZH_CODEX_CLIENT_ID>'
```

Run `codex mcp login kitezh`, complete the browser sign-in, then check `/mcp` in the Codex TUI or run `codex mcp list`. Codex prints or uses its OAuth callback during setup; register the exact callback URI it requests on that OAuth client before login. Codex CLI and its IDE extension share the MCP configuration.

### MCP Inspector

For local protocol checks, configure the seeded `mcp-client` client in MCP Inspector with its callback `http://localhost:6274/oauth/callback`, the local/remote MCP URL, and the `mcp.read` scope. See the verification workflow below for the automated protocol tests.

### Available tools

All tools are read-only and require the `mcp.read` scope. They expose Kitezh context, users, groups, OAuth clients, sessions, and audit events. The MCP service exchanges the user token for a narrowly scoped token before requesting the Administration API; it never accepts a caller-supplied Kitezh API token.

These examples follow the remote HTTP setup model used by the [Grafana MCP documentation](https://grafana.com/docs/grafana/latest/developer-resources/mcp/configure/) and the [GitHub MCP server's host integration guidance](https://github.com/github/github-mcp-server/blob/main/docs/host-integration.md). The GitHub server also documents that remote OAuth requires host-specific OAuth client support and does not provide DCR itself. For client command syntax, see [Claude Code MCP setup](https://code.claude.com/docs/en/mcp) and [Codex MCP setup](https://developers.openai.com/codex/mcp).

## Verify

```bash
./mvnw -f mcp-server/pom.xml verify
```

The build uses the repository Checkstyle rules, Google Java Format AOSP, and a 96% JaCoCo line coverage gate. Production runs as a GraalVM Native Image executable, compressed with UPX in CI. Build it with GraalVM Native Image installed using `./mvnw -f mcp-server/pom.xml -Pnative -DskipTests native:compile`. The native runtime image is assembled and published through the same Jib Native Image extension used by the backend. CI builds Linux AMD64 and ARM64 executables, and the release creates matching architecture images and a multi-architecture manifest.

## Render and observability

`render.yaml` defines a separate Kitezh MCP Web Service with its own image, readiness check, URL, deployment hook, environment and secrets. Set the MCP service's public URL and audience to the same exact HTTPS URI (for example `https://kitezh-mcp.onrender.com/mcp`). Set `KITEZH_API_BASE_URL` to the private Kitezh service URL where Render private networking is available. Configure the separate `mcp-release` GitHub environment with `MCP_DOCKERHUB_USERNAME`, `MCP_DOCKERHUB_TOKEN`, `MCP_RENDER_RELEASE_DEPLOY_HOOK_URL`, and `MCP_RENDER_API_KEY` to enable tagged releases. The release workflow checks the fixed public readiness URL after deploying the image digest.

OTLP export follows the main Kitezh service environment variables and uses `OTEL_SERVICE_NAME=kitezh-mcp`. The dashboard and Prometheus alert rules are in `observability/`; metric labels contain tool names and outcome only, never user IDs, tokens, query text, or resource IDs.

## Docker Compose

The standalone MCP container is a separate Compose service. Start it with the backend and local PostgreSQL dependencies:

```bash
KITEZH_MCP_CLIENT_SECRET='<service-client-secret>' \
docker compose -f src/main/docker/app.yml up -d
```

The MCP endpoint is `http://localhost:10000/mcp`; its health endpoint is available on the internal management port `10001`. The API calls and OAuth token exchange use the backend container network. The MCP OAuth secret is supplied through the environment and is not stored in Compose files.

## Helm and Terraform

MCP is installed from the independent `helm/kitezh-mcp` chart, in the same namespace as the backend release. Configure its public host and resource audience to match, and create the client secret in Kubernetes before relying on the MCP pod:

```bash
kubectl -n apps create secret generic kitezh-mcp-client-secret \
  --from-literal=client-secret="$KITEZH_MCP_CLIENT_SECRET"
helm upgrade --install kitezh-mcp helm/kitezh-mcp \
  --namespace apps --create-namespace \
  --set ingress.enabled=true \
  --set 'ingress.hosts[0].host=mcp.kitezh.example.com' \
  --set app.security.issuerUri=https://kitezh.example.com \
  --set app.security.audience=https://mcp.kitezh.example.com/mcp \
  --set app.mcp.publicUrl=https://mcp.kitezh.example.com/mcp
```

The chart expects `existingSecret.name` (default `kitezh-mcp-client-secret`) with key `client-secret`. Do not pass the secret as a Helm value. Local Terraform deploys backend and MCP as separate Helm releases; set the ingress hosts and image tags in `terraform/terraform.tfvars`. Terraform does not create or store the OAuth client secret. The example local service endpoints are documented in [`terraform/README.md`](../terraform/README.md).
