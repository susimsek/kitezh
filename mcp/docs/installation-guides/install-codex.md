# Install Kitezh MCP Server in OpenAI Codex

## Prerequisites

1. Codex CLI or the Codex IDE extension with remote MCP support.
2. Either a Kitezh public OAuth client registered for Codex, or a Kitezh PAT.

The hosted MCP endpoint is `https://kitezh-mcp.onrender.com/mcp` and uses Streamable HTTP.

## OAuth setup

Register a public client in Kitezh with Authorization Code, PKCE S256, the `mcp.read` scope, and the exact callback URI printed by Codex. Add the server:

```bash
codex mcp add kitezh \
  --url https://kitezh-mcp.onrender.com/mcp \
  --oauth-client-id '<codex-oauth-client-id>'
```

Complete sign-in and verify the connection:

```bash
codex mcp login kitezh
codex mcp list
```

The Codex CLI and IDE extension share the MCP configuration. See [Codex MCP documentation](https://developers.openai.com/codex/mcp).

## PAT setup

Store the PAT in the environment used to launch Codex:

```bash
export KITEZH_MCP_TOKEN='<kitezh-pat>'
```

Add this server to `~/.codex/config.toml`:

```toml
[mcp_servers.kitezh]
url = "https://kitezh-mcp.onrender.com/mcp"
bearer_token_env_var = "KITEZH_MCP_TOKEN"
```

Use `/mcp` in the Codex TUI to confirm the server and tools are available. Never put the literal token in a checked-in `config.toml`.

## Troubleshooting

- Confirm the callback URI in Kitezh exactly matches the one shown by Codex.
- Confirm the client has PKCE S256 and the `mcp.read` scope.
- For PAT, confirm `KITEZH_MCP_TOKEN` is set in the Codex process environment and the PAT is active.
- See [Authentication and authorization](../../README.md#authentication-and-authorization) in the main README.
