# Kitezh MCP Server Installation Guides

This directory contains host-specific instructions for connecting MCP clients to the hosted Kitezh MCP Server. Choose the guide for your client, then use the main [Kitezh MCP Server README](../../README.md) for the full authentication flow, tool catalog, deployment options, and troubleshooting details.

## Installation Guides by Host Application

- [OpenAI Codex](install-codex.md) — Codex CLI and IDE extension
- [Claude](install-claude.md) — Claude Code, Claude Desktop, and Claude on the web
- [Cursor](install-cursor.md) — Cursor IDE
- [Visual Studio Code](install-vscode.md) — VS Code and GitHub Copilot Chat
- [GitHub Copilot CLI](install-copilot-cli.md) — Copilot CLI
- [Windsurf](install-windsurf.md) — Windsurf Cascade

## Support by Host Application

| Host application | Hosted Streamable HTTP | OAuth with a registered client | PAT | Setup guide |
| --- | --- | --- | --- | --- |
| Codex CLI and IDE extension | Yes | Yes | Yes | [Codex](install-codex.md) |
| Claude Code | Yes | Yes | Yes | [Claude](install-claude.md) |
| Claude Desktop and Claude on the web | Yes | Not currently compatible with Kitezh's pre-registered-client-only setup | No shared-connector PAT recommended | [Claude](install-claude.md) |
| Cursor | Yes | Depends on the installed version's static-client support | Yes | [Cursor](install-cursor.md) |
| VS Code and GitHub Copilot Chat | Yes | Depends on the installed version's pre-registered-client support | Yes | [Visual Studio Code](install-vscode.md) |
| GitHub Copilot CLI | Yes | Not documented here | Yes | [Copilot CLI](install-copilot-cli.md) |
| Windsurf Cascade | Yes | Depends on the installed version's pre-registered-client support | Yes | [Windsurf](install-windsurf.md) |
| MCP Inspector | Yes | Yes, using the seeded local inspector client | Not needed for the OAuth test flow | [Main README](../../README.md#mcp-inspector) |

OAuth client support can vary by host version and account policy. Kitezh does not enable Dynamic Client Registration (DCR); the host must allow a pre-registered public client ID and an exact redirect URI. The main README explains the OAuth flow and currently known host limitations.

## Connection Method

Kitezh is a hosted remote MCP server. Connect over Streamable HTTP using:

```text
https://kitezh-mcp.onrender.com/mcp
```

There is no local stdio process to install or start for these hosted guides. Local development and self-hosted deployment instructions are in the main README.

## General Prerequisites

- An MCP host with remote Streamable HTTP support.
- A Kitezh account authorized to use the requested Administration API tools.
- Either a public OAuth client registered with the host's exact redirect URI, or a Kitezh personal access token accepted by that host.
- For OAuth, the `mcp.read` scope and Authorization Code with PKCE (S256). Add `mcp.write` only if the server operator has enabled a write toolset and the user has its Kitezh role.

PATs are created in the Kitezh Account Console under **Security → Personal access tokens**. Select a name, description, and expiration (7, 30, 60, or 90 days, a custom date, or no expiration). Copy the value at creation time and store it in the host's secret store or an environment variable. The full token cannot be viewed again; revoke it in the Account Console when it is no longer needed.

## Authentication Choices

### OAuth 2.0 Authorization Code with PKCE

Use OAuth when the host supports a configured public client ID and browser sign-in. Register the exact callback URI shown by the host, enable PKCE S256, and allow `mcp.read`. Add `mcp.write` only for explicitly enabled write toolsets; it still requires a matching Kitezh role and server-side allowlist. Never configure a client secret for a public client. Each host should have its own client registration and redirect URI.

### Personal access token

Use a PAT when the host supports custom HTTP headers. Configure it as `Authorization: Bearer <token>` and keep the value out of source control, shared example files, command history, and shared workspace connectors. Prefer a separate PAT for each host so each can be revoked independently.

## Security Best Practices

1. Never commit a PAT or OAuth secret to version control.
2. Use OAuth PKCE or the host's secret/environment input mechanism instead of hardcoding credentials.
3. Create one PAT per client and grant only the account permissions needed for the tasks.
4. Prefer an expiration date; revoke credentials that are no longer in use.
5. Do not paste a PAT into a shared ChatGPT or team connector configuration.
6. Remember that Kitezh forwards the authenticated user's token to the Admin API, where scope, user roles, and explicit read/write route rules are enforced.

## References

- [Main Kitezh MCP Server README](../../README.md)
- [GitHub MCP Server installation guides](https://github.com/github/github-mcp-server/tree/main/docs/installation-guides)
- [GitHub MCP Server installation guide index](https://github.com/github/github-mcp-server/blob/main/docs/installation-guides/README.md)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
