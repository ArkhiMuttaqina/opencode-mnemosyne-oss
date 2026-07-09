# Project Skills

## Mnemosyne Alignment

- Treat the official Mnemosyne repository as the CLI source of truth: https://github.com/mnemosyne-oss/mnemosyne
- Keep this fork credited as derived from https://github.com/gandazgul/opencode-mnemosyne.
- Preserve contributor metadata for Arkhi Muttaqina: https://github.com/ArkhiMuttaqina, arkhi07@gmail.com.
- This plugin must remain local-first/offline by default; do not add cloud memory services or network sync unless the user explicitly configures Mnemosyne sync.

## Agentic Coding Tools

- Expose Mnemosyne capabilities as native OpenCode tools instead of requiring agents to shell out manually.
- Keep tool names stable unless making a major release: `memory_recall`, `memory_recall_global`, `memory_store`, `memory_store_global`, `memory_update`, `memory_delete`, `memory_stats`, `memory_sleep`, `memory_diagnose`, `memory_export`, `memory_import`, `memory_import_hindsight`, `memory_bank`, `memory_reindex`, `memory_backup`, `memory_restore`, `memory_verify`, `memory_backups`, `memory_sync`, `memory_sync_status`, and `memory_sync_generate_key`.
- Tool schemas should mirror the official Mnemosyne CLI arguments closely and describe when an agent should use each tool.
- Prefer safe defaults: recall defaults to 10 results, `core=true` maps to importance `1`, restore requires an explicit backup path, and sync keys must never be committed.
- Preserve the `experimental.session.compacting` hook so memory instructions survive context compaction.

## Memory Scoping

- Project memories use source `opencode:<directory-name>`.
- Global memories use source `opencode:global` and are for cross-project preferences, coding style, tool choices, or personal workflow rules.
- Recall tools currently call `mnemosyne recall <query> <top_k>` for both project and global memory because the current CLI searches the active bank directly.
- Store tools must continue writing the source field so recalled entries reveal whether they came from project or global OpenCode memory.

## Global OpenCode Instructions

- OpenCode supports personal global rules at `~/.config/opencode/AGENTS.md`; they apply across OpenCode sessions and are not committed or shared with the team.
- On plugin load, automatically upsert a marked Mnemosyne instruction block into `${XDG_CONFIG_HOME:-~/.config}/opencode/AGENTS.md`; document that it may apply from the next OpenCode session or restart if global rule discovery already happened.
- The generated global block must tell agents to recall memory at session start, store durable decisions, update/delete stale memories, use global variants only for cross-project preferences, run `memory_sleep` at handoff, back up before risky maintenance, never store secrets, and ask before storing context whose sensitivity is unclear.
- Write the global block only under an absolute config root, avoid following symlinks, and use a lock plus atomic rename so concurrent OpenCode sessions do not clobber user rules.
- Keep the block bounded by `<!-- opencode-mnemosyne-oss:start -->` and `<!-- opencode-mnemosyne-oss:end -->` so future plugin versions can update it without overwriting the user's personal rules.
- Respect `MNEMOSYNE_SKIP_GLOBAL_AGENTS=1` as an opt-out for users who do not want the plugin to write global OpenCode instructions.

## Development Rules

- Use `npm run typecheck` for focused validation and `npm run ci` before release.
- Smoke-test key official CLI mappings before release: `store`, `recall`, `update`, `delete`, `stats`, `sleep`, `diagnose`, `export`, `bank`, `backup`, `verify`, and `sync-status`.
- Do not commit generated `dist` output unless the release process explicitly requires it.

## Versioning Rules

- Use patch versions (`0.2.x`) for docs, metadata, and bug fixes that do not change plugin tool behavior.
- Use minor versions (`0.x.0`) when official Mnemosyne changes command names, arguments, output formats, or memory-bank behavior.
- Use major versions (`x.0.0`) for breaking changes to OpenCode tool names, tool schemas, memory scope behavior, or supported Mnemosyne versions.
