# Install Kitezh MCP Server in Visual Studio Code

This guide covers VS Code and GitHub Copilot Chat. The hosted MCP endpoint is `https://kitezh-mcp.onrender.com/mcp` and uses Streamable HTTP.

## PAT setup

Create `.vscode/mcp.json`. VS Code prompts for the token as a password input rather than storing it in the JSON:

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

Open Copilot Chat in Agent mode and enable Kitezh in the tools picker. For user-wide setup, add the same server under `servers` in your VS Code user MCP configuration. See [VS Code's MCP server guide](https://code.visualstudio.com/docs/agent-customization/mcp-servers).

## OAuth setup

VS Code's OAuth **Auth** action depends on support for a pre-registered client in your installed version. Kitezh DCR is disabled. If the host lets you configure a static client ID, register its exact callback URI in Kitezh and enable Authorization Code with PKCE S256 and `mcp.read`.

## Troubleshooting

- Confirm the server is enabled in the MCP tools list and restart/reload VS Code after configuration changes.
- Verify the token prompt value is a Kitezh PAT, not an OAuth client secret.
- See the main README's [VS Code setup details](../../README.md#visual-studio-code-and-github-copilot-chat).
