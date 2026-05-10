# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-07

### Note
- npm package name changed from `claude-memory-mcp` to `@tanaka-kun-dev/claude-memory-mcp` (scoped) due to name collision with existing package by `arman-tech`
- Install with: `npm install -g @tanaka-kun-dev/claude-memory-mcp`
- Publish with: `npm publish --access public`

### Added
- Initial release
- MCP tools:
  - `list_memory` — list all memory files (filterable by type)
  - `search_memory` — keyword search across name/description/body
  - `add_memory` — create a new memory file
  - `update_memory` — overwrite an existing memory file
  - `delete_memory` — delete a memory file
  - `rebuild_index` — regenerate `MEMORY.md` index
- MCP resources: every memory file is exposed at `memory://<filename>`
- YAML frontmatter parsing via `gray-matter`
- Auto-rebuild of `MEMORY.md` index after every write
- Configurable memory directory via `CLAUDE_MEMORY_DIR` env var
- Default memory dir: `~/.claude/memory/`
