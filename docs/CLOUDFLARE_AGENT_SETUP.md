# Project-local Cloudflare agent setup

Installed and authenticated on 2026-10-23 using Cloudflare's [official agent setup](https://developers.cloudflare.com/agent-setup/prompt.md), adapted to the owner's project-only requirement.

## Verified status

- Both `.agents` and `.codex` passed create/delete write probes after the owner restored workspace permissions.
- All 19 Cloudflare skills are installed under `.agents/skills`. `skills-lock.json` records the sources and content hashes. The project-only Codex skill listing reports 19 entries.
- The Cloudflare MCP server is registered and enabled in this repo's `.codex/config.toml`, pointing to `https://mcp.cloudflare.com/mcp`. `codex mcp list --json` recognizes the project configuration.
- Browser authorization completed: the CLI reported `Successfully logged in to MCP server 'cloudflare'`; the subsequent MCP listing reports `auth_status: o_auth`.
- Requested OAuth scopes are `offline_access`, `user:read`, `account:read`, `workers-scripts.read`, `workers-scripts.metadata_read`, `workers-tail.read`, and `workers-observability.read`. The MCP connection is for read-only account/Worker diagnostics. Wrangler remains the deployment tool.
- The agent setup installed no global skills/MCP configuration or optional `cf` CLI and made no deployment, DNS, or infrastructure changes. A later, separately owner-authorized Wrangler deployment is recorded in `docs/PHASE_REPORTS.md`. Codex manages OAuth credentials separately; no credentials are stored in the repository.
- MCP tools are active and were verified on 2026-10-23: documentation search, identity, OpenAPI discovery, and read-only retrieval of Worker settings, custom domains, and deployment history all succeeded for `morphi-one`. Wrangler authentication and deployment permissions were also checked separately.

## Installation used

```sh
npx -y skills add cloudflare/skills --skill '*' --agent codex --yes
```

Project-local `.codex/config.toml`:

```toml
[mcp_servers.cloudflare]
url = "https://mcp.cloudflare.com/mcp"
enabled = true
```

Authorization was started with:

```sh
codex mcp login cloudflare --scopes offline_access,user:read,account:read,workers-scripts.read,workers-scripts.metadata_read,workers-tail.read,workers-observability.read
```

The default `codex mcp add` command in Cloudflare's instructions was not used because it writes user configuration. Project MCP settings are supported in trusted projects; see the [official MCP configuration docs](https://learn.chatgpt.com/docs/extend/mcp).

The repo ignores `.agents` and `.codex`, keeping installation and MCP config local. `skills-lock.json` is outside those ignored directories so its non-secret source manifest can be backed up with the project. The existing Wrangler and Cloudflare adapter versions are unchanged. Each production deployment still requires explicit owner permission.
