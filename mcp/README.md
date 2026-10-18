# Kitezh MCP Server

Kitezh MCP Server is an independent, read-only Spring Boot service. It exposes a stateless Streamable HTTP MCP endpoint at `/mcp`, validates user bearer tokens for its own resource audience, forwards them to the Kitezh Administration API, and has no database dependency. The published container image documentation is in [README-dockerhub.md](README-dockerhub.md).

## Table of Contents

- [Run locally](#run-locally)
- [Authentication and authorization](#authentication-and-authorization)
  - [OAuth 2.0 Authorization Code with PKCE](#oauth-20-authorization-code-with-pkce)
  - [Personal access token (PAT)](#personal-access-token-pat)
- [Connect from MCP clients](#connect-from-mcp-clients)
  - [OAuth client registration](#oauth-client-registration)
  - [Codex CLI and IDE extension](#codex-cli-and-ide-extension)
  - [Claude Code](#claude-code)
  - [Claude Desktop and Claude on the web](#claude-desktop-and-claude-on-the-web)
  - [Cursor](#cursor)
  - [Visual Studio Code and GitHub Copilot Chat](#visual-studio-code-and-github-copilot-chat)
  - [GitHub Copilot CLI](#github-copilot-cli)
  - [Windsurf Cascade](#windsurf-cascade)
  - [ChatGPT custom MCP connector](#chatgpt-custom-mcp-connector)
  - [MCP Inspector](#mcp-inspector)
  - [Available tools](#available-tools)
    - [Server-side toolsets and allowlist](#server-side-toolsets-and-allowlist)
- [Installation guides](docs/installation-guides/README.md)
- [Verify](#verify)
- [Render and observability](#render-and-observability)
- [Docker Compose](#docker-compose)
- [Helm and Terraform](#helm-and-terraform)

## Run locally

```bash
./mvnw -f mcp/pom.xml spring-boot:run
```

The Maven `dev` profile is active by default. Its issuer is configured in `src/main/resources/config/application-dev.yml`; the local Admin API URL and the stable MCP resource URI use the defaults in `application.yml`. Override them with environment variables only when your local backend or public MCP resource URI is different.

Register a public OAuth client for each MCP host with its exact redirect URI, Authorization Code + PKCE S256, and the `mcp.read` scope. MCP validates the inbound token's issuer, MCP audience, and scope, then forwards that same user token to the Kitezh Administration API. The API must accept the forwarded token and apply its own read-only endpoint and role authorization rules. No confidential MCP service client or token-exchange secret is required.

The MCP resource URI is a stable identifier and must be identical in the authorization server's `APP_MCP_RESOURCE_AUDIENCE`, the MCP service's `APP_SECURITY_AUDIENCE`, and `APP_MCP_PUBLIC_URL`. The local example uses the Render URL as that stable resource identifier while connecting to the local server process. For a custom production domain, update all three values together.

## Authentication and authorization

The MCP endpoint is `https://kitezh-mcp.onrender.com/mcp` (replace it with the MCP service's public URL if you use a custom domain). It uses Streamable HTTP and accepts user access tokens. Choose either OAuth 2.0 Authorization Code with PKCE or a personal access token (PAT). Both represent the signed-in user and require `mcp.read`. Do not put a bearer token or client secret in a committed client config.

### OAuth 2.0 Authorization Code with PKCE

Use OAuth when the MCP client should sign the user in through a browser. The client discovers the protected resource metadata at `/.well-known/oauth-protected-resource`, then uses the Kitezh Authorization Server issuer and its OAuth metadata to start Authorization Code with PKCE (S256). Dynamic Client Registration is not enabled, so register a public client for each MCP host first.

Flow:

1. The MCP client sends a request to `/mcp` and receives `401` with the protected-resource metadata URL and required `mcp.read` scope.
2. The MCP client reads the metadata and starts authorization at the Kitezh issuer with its registered `client_id`, exact callback URI, PKCE challenge, and `mcp.read` scope.
3. The user signs in to Kitezh in the browser. The client receives the authorization code at its local callback and posts it with the PKCE verifier to `/oauth2/token`.
4. The MCP client calls `/mcp` with the returned access token. MCP verifies its signature, issuer, MCP resource audience, and `mcp.read` scope.
5. MCP forwards that same user token to the Admin API. The API verifies the token is active and has the MCP and `admin-api` audiences, then applies its GET-only MCP route allowlist and the user's role permissions.

No MCP client secret or token exchange is used. Access tokens are short lived; the MCP host handles refresh or asks the user to sign in again according to its OAuth support.

Production discovery and token endpoints:

- MCP protected-resource metadata: `https://kitezh-mcp.onrender.com/.well-known/oauth-protected-resource`
- Authorization Server metadata: `https://kitezh.onrender.com/.well-known/oauth-authorization-server`
- Authorization: `https://kitezh.onrender.com/oauth2/authorize`
- Token: `https://kitezh.onrender.com/oauth2/token`
- Signing keys: `https://kitezh.onrender.com/oauth2/jwks`

### Personal access token (PAT)

Use a PAT for a client that accepts a configured bearer token and does not need browser-based OAuth. Sign in to the Account Console (`admin/admin` or `user/user` in local development), open **Security → Personal access tokens**, create a token, and choose its name, description, and expiration. The expiration choices include 7, 30, 60, 90 days, a custom date, and **Never expires**. Copy the bearer value when it is shown; it cannot be retrieved later. Revoking the PAT in the Account Console removes its authorization. Store it in a local secret store or environment variable.

The PAT is a signed user access token with the MCP and `admin-api` audiences and the `mcp.read` scope. MCP forwards it unchanged to the Admin API, which checks that it is active and enforces the same GET-only route allowlist and user role permissions as the OAuth flow. PAT use does not require an OAuth client registration, client secret, or token exchange.

Client-specific OAuth and PAT configuration examples are in [Connect from MCP clients](#connect-from-mcp-clients).

## Connect from MCP clients

The server URL is `https://kitezh-mcp.onrender.com/mcp`. Kitezh supports two user-authentication methods: browser-based OAuth 2.0 Authorization Code + PKCE, and a personal access token (PAT) sent as `Authorization: Bearer <token>`. Use a separate PAT per client so access can be revoked independently. Never commit a token in a project MCP configuration.

Host-specific setup guides, an authentication support matrix, and secure configuration notes are in the [Installation Guides](docs/installation-guides/README.md) index.

### OAuth client registration

Kitezh does not currently support Dynamic Client Registration (DCR). For an OAuth client that allows a pre-registered client ID, create a separate public client in the Kitezh Authorization Server for that MCP host. Enable Authorization Code + PKCE (S256), allow only the exact callback URI used by that host, and grant `openid` and `mcp.read`. Do not configure a client secret for a public client. The seeded `mcp-client` is for MCP Inspector only (`http://localhost:6274/oauth/callback`).

Some clients only support automatic OAuth registration and do not let you provide a pre-registered client ID. Their OAuth sign-in will not work with Kitezh until that client supports a configured client ID or Kitezh enables a compatible registration method. Use PAT where the client supports custom bearer headers. The sections below call out this limitation instead of assuming every OAuth button can connect.

### Codex CLI and IDE extension

[Codex CLI and IDE extension](https://developers.openai.com/codex/mcp) share the same MCP configuration. For OAuth, add the MCP server with a separately registered public client ID:

```bash
codex mcp add kitezh \
  --url https://kitezh-mcp.onrender.com/mcp \
  --oauth-client-id '<codex-oauth-client-id>'
```

Codex prints the callback URI when adding the server. Add that exact URI to the OAuth client's redirect URI list, then run:

```bash
codex mcp login kitezh
codex mcp list
```

For PAT authentication, put the token in the local shell environment before starting Codex:

```bash
export KITEZH_MCP_TOKEN='<kitezh-pat>'
```

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.kitezh]
url = "https://kitezh-mcp.onrender.com/mcp"
bearer_token_env_var = "KITEZH_MCP_TOKEN"
```

In the Codex TUI, use `/mcp` to confirm the server and its tools are available.

### Claude Code

[Claude Code](https://code.claude.com/docs/en/mcp) supports a pre-registered public client. Choose a fixed callback port and register `http://localhost:8765/callback` on that client, then add the server:

```bash
claude mcp add --transport http \
  --client-id '<claude-code-oauth-client-id>' \
  --callback-port 8765 \
  kitezh https://kitezh-mcp.onrender.com/mcp
```

Run `/mcp` in Claude Code and complete Kitezh sign-in in the browser. Verify with `claude mcp get kitezh` or `claude mcp list`. The registered callback must match exactly.

For PAT authentication, export the token before launching Claude Code and use a local `.mcp.json` (do not commit the resolved token):

```bash
export KITEZH_MCP_TOKEN='<kitezh-pat>'
```

```json
{
  "mcpServers": {
    "kitezh": {
      "type": "http",
      "url": "https://kitezh-mcp.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer ${KITEZH_MCP_TOKEN}"
      }
    }
  }
}
```

Claude Code expands environment variables in HTTP headers. Keep this file local or replace the PAT with a secure environment-based configuration before sharing it.

### Claude Desktop and Claude on the web

Add a remote connector from **Settings → Connectors → Add custom connector**, then enter `https://kitezh-mcp.onrender.com/mcp` and continue through the sign-in flow. See Anthropic's [remote MCP connector guide](https://support.anthropic.com/en/articles/11503834-building-custom-integrations-via-remote-mcp). Claude Desktop uses this remote connector flow; a local `claude_desktop_config.json` entry is for local MCP processes, not this hosted HTTP server.

Kitezh currently has DCR disabled, while the Claude connector UI does not expose a field for a Kitezh pre-registered client ID. Therefore the OAuth login is not currently compatible with this UI. This will work once Kitezh or the connector supports a compatible client registration path. Claude Code supports a configured client ID as shown above.

### Cursor

Add the remote HTTP server to `~/.cursor/mcp.json` for all workspaces or `.cursor/mcp.json` for one workspace, following [Cursor's MCP guide](https://docs.cursor.com/context/model-context-protocol):

```json
{
  "mcpServers": {
    "kitezh": {
      "url": "https://kitezh-mcp.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer <kitezh-pat>"
      }
    }
  }
}
```

Replace `<kitezh-pat>` locally and keep the file out of version control. Restart Cursor and authenticate or refresh the server from its MCP settings. Cursor's automatic OAuth registration cannot complete while Kitezh DCR is disabled; use a configured static OAuth client if your Cursor version exposes one, or use the PAT header above.

### Visual Studio Code and GitHub Copilot Chat

Create `.vscode/mcp.json` and use VS Code's secret input prompt for the PAT, following [VS Code's MCP setup guide](https://code.visualstudio.com/docs/agent-customization/mcp-servers):

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "kitezhMcpToken",
      "description": "Kitezh personal access token",
      "password": true
    }
  ],
  "servers": {
    "kitezh": {
      "type": "http",
      "url": "https://kitezh-mcp.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer ${input:kitezhMcpToken}"
      }
    }
  }
}
```

Open Copilot Chat in Agent mode and enable Kitezh in the tools picker. VS Code's OAuth **Auth** action depends on OAuth support for a pre-registered client; Kitezh DCR is currently disabled. For user-wide setup, add the same server under the `servers` object in your VS Code user MCP configuration.

### GitHub Copilot CLI

Add Kitezh as a remote Streamable HTTP server using a PAT, as described in the [Copilot CLI MCP guide](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers):

```bash
copilot mcp add --transport http \
  --header "Authorization: Bearer <kitezh-pat>" \
  kitezh https://kitezh-mcp.onrender.com/mcp
```

Run `copilot mcp list`, then `/mcp` in the interactive CLI to check the connection. Treat the PAT as a secret: the command may store the supplied header in the local Copilot configuration and shell history. For a safer setup, configure the header through the CLI's MCP configuration editor and secret/environment substitution supported by your installed version.

### Windsurf Cascade

In Windsurf, open **Cascade → MCPs → Configure** and add the hosted endpoint to `mcp_config.json`, following the [Cascade MCP guide](https://docs.devin.ai/desktop/cascade/mcp). The file is typically `~/.codeium/windsurf/mcp_config.json` on macOS/Linux:

```json
{
  "mcpServers": {
    "kitezh": {
      "serverUrl": "https://kitezh-mcp.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer ${env:KITEZH_MCP_TOKEN}"
      }
    }
  }
}
```

Set `KITEZH_MCP_TOKEN` in the environment used to launch Windsurf, then reload Cascade. Windsurf supports environment interpolation in remote HTTP headers. Its OAuth path requires a compatible pre-registered client; Kitezh DCR is currently disabled.

### ChatGPT custom MCP connector

In a ChatGPT workspace that allows custom MCP connections, open **Plugins** (or the workspace's custom apps page), choose **Add custom MCP server**, and enter `https://kitezh-mcp.onrender.com/mcp`. Follow OpenAI's [custom MCP connection guide](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt). ChatGPT supports OAuth-based custom MCP connections, but its connection setup requires a supported client-registration method.

Kitezh currently supports pre-registered OAuth clients only; it does not advertise DCR or CIMD. ChatGPT therefore cannot complete OAuth sign-in to this server yet. Do not paste a PAT into a shared workspace connector. Use Codex or Claude Code for pre-registered OAuth, or a local client configuration that supports PAT headers.

### MCP Inspector

For local protocol checks, configure the seeded `mcp-client` client in MCP Inspector with its callback `http://localhost:6274/oauth/callback`, the local/remote MCP URL, and the `mcp.read` scope. See the verification workflow below for the automated protocol tests.

### Available tools

All tools are read-only and require the `mcp.read` scope. They expose Kitezh context, users, groups, OAuth clients, sessions, and audit events. MCP forwards the validated inbound user token to the Administration API without exchanging it. The API remains responsible for enforcing its read-only endpoint and role rules.

#### Server-side toolsets and allowlist

Operators can limit the catalog for a deployment with `APP_MCP_TOOLSETS` and `APP_MCP_TOOL_ALLOWLIST`. `APP_MCP_TOOLSETS` defaults to `all`; `APP_MCP_TOOL_ALLOWLIST` defaults to `*`, preserving the complete catalog. Supported toolset IDs are `users`, `groups`, `clients`, `roles`, `events`, `organizations`, `context`, `dashboard`, `notifications`, and `signing-keys`. Set the toolset variable to a comma-separated selection and the allowlist to the exact comma-separated MCP tool names allowed by that deployment. An empty allowlist disables every tool.

The effective catalog is the union of the configured toolsets, intersected with the server allowlist and the tools authorized for the caller's roles. These are deployment-side settings. MCP client headers, tool arguments, or client preferences cannot expand the configured catalog; the same authorization policy applies to `tools/list` and direct `tools/call` requests. Tool authorization in the Kitezh Administration API remains authoritative.

Example deployment settings:

```bash
APP_MCP_TOOLSETS=users,groups
APP_MCP_TOOL_ALLOWLIST=kitezh_search_users,kitezh_get_user,kitezh_search_groups,kitezh_get_group
```

Use `all` and `*` to keep the full catalog enabled. Toolset names and tool names are validated by the server at startup so configuration mistakes fail visibly.

These examples follow the remote HTTP setup model used by the [Grafana MCP documentation](https://grafana.com/docs/grafana/latest/developer-resources/mcp/configure/) and the [GitHub MCP server's host integration guidance](https://github.com/github/github-mcp-server/blob/main/docs/host-integration.md). The GitHub server also documents that remote OAuth requires host-specific OAuth client support and does not provide DCR itself. For client command syntax, see [Claude Code MCP setup](https://code.claude.com/docs/en/mcp) and [Codex MCP setup](https://developers.openai.com/codex/mcp).

## Verify

```bash
./mvnw -f mcp/pom.xml verify
```

The build uses the repository Checkstyle rules, Google Java Format AOSP, and a 96% JaCoCo line coverage gate. Production runs as a GraalVM Native Image executable, compressed with UPX in CI. Build it with GraalVM Native Image installed using `./mvnw -f mcp/pom.xml -Pnative -DskipTests native:compile`. The native runtime image is assembled and published through the same Jib Native Image extension used by the backend. CI builds Linux AMD64 and ARM64 executables, and the release creates matching architecture images and a multi-architecture manifest.

## Render and observability

`render-mcp.yaml` defines an independent Blueprint for the `kitezh-mcp` Web Service, so it can be deployed without duplicating the backend service. The service has its own image, readiness check, URL and environment. Set the MCP service's public URL and audience to the same exact HTTPS URI (for example `https://kitezh-mcp.onrender.com/mcp`). Set `APP_API_BASE_URL` to the private Kitezh service URL where Render private networking is available. MCP image publishing and deployment use the shared `backend-release` GitHub environment (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, and `RENDER_API_KEY`), plus the MCP-specific `MCP_RENDER_RELEASE_DEPLOY_HOOK_URL` secret. The release workflow checks the fixed public readiness URL after deploying the image digest.

OTLP export follows the main Kitezh service environment variables and uses `OTEL_SERVICE_NAME=kitezh-mcp`. The dashboard and Prometheus alert rules are in `observability/`; metric labels contain tool names and outcome only, never user IDs, tokens, query text, or resource IDs.

## Docker Compose

The standalone MCP container is a separate Compose service. Start it with the backend and local PostgreSQL dependencies:

```bash
docker compose -f src/main/docker/app.yml up -d
```

The MCP endpoint is `http://localhost:10000/mcp`; its health endpoint is available on the internal management port `10001`. API calls use the backend container network and forward the authenticated user's bearer token.

## Helm and Terraform

MCP is installed from the independent `helm/kitezh-mcp` chart, in the same namespace as the backend release. Configure its public host and resource audience to match:

```bash
helm upgrade --install kitezh-mcp helm/kitezh-mcp \
  --namespace apps --create-namespace \
  --set ingress.enabled=true \
  --set 'ingress.hosts[0].host=mcp.kitezh.example.com' \
  --set app.security.issuerUri=https://kitezh.example.com \
  --set app.security.audience=https://mcp.kitezh.example.com/mcp \
  --set app.mcp.publicUrl=https://mcp.kitezh.example.com/mcp
```

Local Terraform deploys backend and MCP as separate Helm releases; set the ingress hosts and image tags in `terraform/terraform.tfvars`. The example local service endpoints are documented in [`terraform/README.md`](../terraform/README.md).
