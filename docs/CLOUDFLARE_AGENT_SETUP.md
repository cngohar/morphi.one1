# Project-local Cloudflare agent setup

The owner requested Cloudflare's [official agent setup](https://developers.cloudflare.com/agent-setup/prompt.md) on 2026-10-23, scoped to this repository. Do not install skills, MCP settings, or the optional `cf` CLI globally for this task.

## Current status

- The project already has Wrangler 4.151.3, `wrangler.jsonc`, and the Cloudflare SvelteKit adapter. Continue using Wrangler; no CLI migration or dependency upgrade is needed.
- Nineteen pre-existing Cloudflare skills are available to this session from `/home/ali-gohar/.agents/skills`. These were not installed by this task and do not constitute a project-local installation.
- `codex mcp list --json` reports no registered MCP servers. Cloudflare's MCP tools are not available in this session.
- The workspace mounts this repo's `.agents` and `.codex` directories read-only. Standard project-local installation and MCP activation are blocked. No global settings were changed, no OAuth login was attempted, and setup is not complete.

## Setup to apply when the project directories are writable

Cloudflare's skills command, with its global flag omitted, is:

```sh
npx -y skills add cloudflare/skills --skill '*' --yes
```

The project-local Codex MCP configuration belongs in `.codex/config.toml`:

```toml
[mcp_servers.cloudflare]
url = "https://mcp.cloudflare.com/mcp"
enabled = true
```

Preserve any existing config and merge this table rather than replacing the file. Codex reads project MCP settings in trusted projects; see the [official MCP configuration docs](https://learn.chatgpt.com/docs/extend/mcp). The default `codex mcp add` command in Cloudflare's instructions writes user configuration, so it is not appropriate for this project's scope. OAuth authentication still requires the owner's browser authorization after registration. Authentication has not been verified.

The current `.gitignore` excludes `.agents` and `.codex`. Decide explicitly whether to version a non-secret project MCP config; never commit credentials. Reopen the project after setup to load the tools. Setup does not authorize deployments, DNS changes, or new Cloudflare resources.
