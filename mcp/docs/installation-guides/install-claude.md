# Install Kitezh MCP Server in Claude

This guide covers Claude Code, Claude Desktop, and Claude on the web. The hosted endpoint is `https://kitezh-mcp.onrender.com/mcp` and uses Streamable HTTP.

## Claude Code

### OAuth setup

Register a public Kitezh client with Authorization Code, PKCE S256, `mcp.read`, and the callback URI `http://localhost:8765/callback`, then add the remote server:

```bash
claude mcp add --transport http \
  --client-id '<claude-code-oauth-client-id>' \
  --callback-port 8765 \
  kitezh https://kitezh-mcp.onrender.com/mcp
```

Run `/mcp` in Claude Code and complete Kitezh sign-in in the browser. Check the connection with `claude mcp get kitezh` or `claude mcp list`. The callback URI registered in Kitezh must match exactly.

### PAT setup

Export the token before launching Claude Code:

```bash
export KITEZH_MCP_TOKEN='<kitezh-pat>'
```

Add a local `.mcp.json`:

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

Keep the resolved PAT and this configuration out of version control. See Anthropic's [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).

## Claude Desktop and Claude on the web

Add the remote connector from **Settings → Connectors → Add custom connector**, then enter the hosted endpoint and follow the sign-in flow. See Anthropic's [remote MCP connector guide](https://support.anthropic.com/en/articles/11503834-building-custom-integrations-via-remote-mcp).

Kitezh currently requires a pre-registered OAuth client, while this connector flow does not provide a field for Kitezh's static client ID. OAuth sign-in is therefore not currently compatible with this flow. Do not put a PAT in a shared connector. Use Claude Code with a registered client or PAT instead.

## Troubleshooting

- Claude Code OAuth requires the registered callback URI to match exactly.
- Confirm `mcp.read` is included in the client registration and requested by the host.
- Claude Desktop/web cannot complete OAuth until the connector supports a compatible client-registration method.
- See the main README's [Claude setup details](../../README.md#claude-desktop-and-claude-on-the-web).
