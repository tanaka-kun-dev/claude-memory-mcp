# claude-memory-mcp

MCP server for Claude Code's auto-memory system. Lets any MCP-compatible client (Claude Code, Claude Desktop, Cursor, etc.) read, search, add, update, and remove memory files in `~/.claude/memory/`.

## Why

Claude Code's auto-memory feature persists facts about the user, project, and feedback as markdown files with YAML frontmatter. Managing these files by hand is tedious — and other MCP clients can't reach them at all. This server exposes the memory directory as MCP **resources** and provides **tools** to manage entries.

## Install

```bash
npm install -g @tanaka-kun-dev/claude-memory-mcp
```

> Note: The unscoped name `claude-memory-mcp` is taken by another package on npm. Install via the scoped name above. The CLI command remains `claude-memory-mcp` after install.

## Configure

### Claude Code

Add to your `.claude/settings.json`:

```json
{
  "mcpServers": {
    "memory": {
      "command": "claude-memory-mcp"
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "memory": {
      "command": "claude-memory-mcp"
    }
  }
}
```

## Custom memory directory

By default, this server reads from `~/.claude/memory/`. Override via environment variable:

```json
{
  "mcpServers": {
    "memory": {
      "command": "claude-memory-mcp",
      "env": {
        "CLAUDE_MEMORY_DIR": "/path/to/your/memory"
      }
    }
  }
}
```

## Memory file format

Each memory is a markdown file with YAML frontmatter:

```markdown
---
name: User role
description: User is a 22yo cafe owner who codes nightly
type: user
---

The user runs an amusement poker house and is learning Claude Code
to automate routine work. Default to direct Japanese explanations.
```

Required frontmatter fields:
- `name` — short title
- `description` — one-line summary (shown in `MEMORY.md` index)
- `type` — one of `user` / `feedback` / `project` / `reference`

## Tools provided

| Tool | Purpose |
|------|---------|
| `list_memory` | List all memories (optionally filter by type) |
| `search_memory` | Keyword search across name/description/body |
| `add_memory` | Create a new memory file |
| `update_memory` | Overwrite an existing memory file |
| `delete_memory` | Delete a memory file |
| `rebuild_index` | Regenerate `MEMORY.md` index |

`MEMORY.md` is auto-rebuilt after every write.

## Resources exposed

Every memory file is exposed as a resource at `memory://<filename>`. Clients can list and read these via standard MCP resource APIs.

## Memory types

| Type | Use for |
|------|---------|
| `user` | Who the user is — role, preferences, knowledge |
| `feedback` | Corrections / validations from past conversations |
| `project` | Active work context — who's doing what, by when |
| `reference` | Pointers to external resources (Slack, Linear, dashboards) |

## Develop

```bash
npm install
npm run build
npm start
```

## License

MIT
