# Install Kitezh MCP Server in GitHub Copilot CLI

## Prerequisites

1. GitHub Copilot CLI with remote MCP support.
2. A Kitezh PAT.

Kitezh's hosted Streamable HTTP endpoint is `https://kitezh-mcp.onrender.com/mcp`.

## Add the remote server

Add Kitezh with the PAT as an HTTP Authorization header:

```bash
copilot mcp add --transport http \
  --header "Authorization: Bearer <kitezh-pat>" \
  kitezh https://kitezh-mcp.onrender.com/mcp
```

Check the configuration and connection:

```bash
copilot mcp list
```

In the interactive CLI, run `/mcp` to inspect available servers and tools. The CLI may store the header in local configuration and shell history; use its configuration editor or secret/environment support if available in your version. Do not commit the token.

See GitHub's [Copilot CLI MCP setup guide](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers).

## Troubleshooting

- Check that the PAT is active and belongs to the Kitezh user whose permissions should apply.
- Confirm the endpoint ends in `/mcp` and uses HTTPS.
- Re-add the server after rotating or revoking its PAT.
- See the main README's [Copilot CLI setup details](../../README.md#github-copilot-cli).
