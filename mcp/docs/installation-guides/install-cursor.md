# Install Kitezh MCP Server in Cursor

## Prerequisites

1. Cursor with remote Streamable HTTP MCP support.
2. A Kitezh PAT. OAuth is only available if your Cursor version lets you configure a pre-registered public client.

The hosted endpoint is `https://kitezh-mcp.onrender.com/mcp`.

## Remote setup with a PAT

Add the server to `~/.cursor/mcp.json` for all workspaces or `.cursor/mcp.json` for the current workspace:

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

Replace the placeholder locally and keep the token out of version control. Restart Cursor, then check the server in its MCP settings.

Cursor's automatic OAuth registration cannot complete while Kitezh DCR is disabled. If your installed version supports a configured OAuth client ID, register that client in Kitezh with its exact callback URI, PKCE S256, and `mcp.read`.

See the [Cursor MCP guide](https://docs.cursor.com/context/model-context-protocol).

## Troubleshooting

- Confirm the server appears and is enabled in Cursor's MCP settings.
- Check that the PAT is active and is sent as a Bearer token.
- Ensure the current Cursor version supports remote Streamable HTTP.
- See the main README's [Cursor setup details](../../README.md#cursor).
