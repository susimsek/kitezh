# Install Kitezh MCP Server in Windsurf

## Prerequisites

1. Windsurf Cascade with remote MCP support.
2. A Kitezh PAT, or a Windsurf version that supports a pre-registered OAuth client.

The hosted endpoint is `https://kitezh-mcp.onrender.com/mcp`.

## Remote setup with a PAT

Store the PAT in the environment used to launch Windsurf:

```bash
export KITEZH_MCP_TOKEN='<kitezh-pat>'
```

Open **Cascade → MCPs → Configure** and add this entry to `mcp_config.json` (typically `~/.codeium/windsurf/mcp_config.json` on macOS/Linux):

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

Reload Cascade and confirm Kitezh is connected. Keep the token out of the configuration file and source control. See the [Windsurf Cascade MCP guide](https://docs.devin.ai/desktop/cascade/mcp).

Windsurf's OAuth path requires support for a pre-registered client; Kitezh DCR is disabled. If your version supports a static client ID, register its exact callback URI in Kitezh with PKCE S256 and `mcp.read`.

## Troubleshooting

- Confirm the environment variable is available to the Windsurf process.
- Confirm the server configuration uses the supported remote HTTP key for your Windsurf version.
- See the main README's [Windsurf setup details](../../README.md#windsurf-cascade).
