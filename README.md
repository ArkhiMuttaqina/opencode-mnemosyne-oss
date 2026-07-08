# opencode-mnemosyne

OpenCode plugin for **local persistent memory** using the official [Mnemosyne](https://github.com/mnemosyne-oss/mnemosyne). Gives your AI coding agent memory that persists across sessions -- entirely offline, no cloud APIs.

This is the local/offline alternative to cloud-based memory plugins like opencode-supermemory.

## Prerequisites

Install the mnemosyne binary first:

```bash
# From source (requires Go 1.21+, GCC, Task)
git clone https://github.com/mnemosyne-oss/mnemosyne.git
cd mnemosyne
task install
```

See the [official mnemosyne README](https://github.com/mnemosyne-oss/mnemosyne#quick-start) for detailed setup instructions. On first use, mnemosyne will automatically download its ML models (~500 MB one-time).

## Install

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-mnemosyne"]
}
```

That's it. OpenCode will install the plugin automatically.

## What it does

### Tools

The plugin registers five tools available to the AI agent:

| Tool | Description |
|------|-------------|
| `memory_recall` | Search project memory for relevant context and past decisions |
| `memory_recall_global` | Search global memory for cross-project preferences |
| `memory_store` | Store a project-scoped memory (optionally as `core`) |
| `memory_store_global` | Store a cross-project memory (optionally as `core`) |
| `memory_delete` | Delete an outdated memory by its document ID |

### Hooks

- **`experimental.session.compacting`** -- Injects memory tool instructions into the compaction prompt so the agent retains awareness of its memory capabilities across context window resets.

### Memory scoping

The current Mnemosyne CLI stores memories with a `source` field instead of named collections. This plugin writes project memories with `opencode:<directory-name>` and global memories with `opencode:global`.

| Scope | Mnemosyne source | Persists across |
|-------|------------------|-----------------|
| Project | `opencode:<directory-name>` | Sessions in the same project |
| Global | `opencode:global` | All projects |
| Core (project) | `opencode:<directory-name>` with importance `1` | Sessions + survives compaction |
| Core (global) | `opencode:global` with importance `1` | All projects + survives compaction |

Recall uses `mnemosyne recall <query> 10` for both project and global tools because the latest CLI searches the active memory bank directly.

## AGENTS.md (recommended)

For best results, add this to your project or global `AGENTS.md` so the agent uses memory proactively from the start of each session:

```markdown
## Memory (mnemosyne)

- At the start of a session, use memory_recall and memory_recall_global to search for context
  relevant to the user's first message.
- After significant decisions, use memory_store to save a concise summary.
- Delete contradicted memories with memory_delete before storing updated ones.
- Use memory_recall_global / memory_store_global for cross-project preferences.
- Mark critical, always-relevant context as core (core=true) — but use sparingly.
- When you are done with a session, store any memories that you think are relevant
  to the user and the project. This will help you recall important information in
  future sessions.
```

## How it works

Mnemosyne is a local document store with hybrid search:
- **Full-text search** (SQLite FTS5, BM25 ranking)
- **Vector search** (sqlite-vec, cosine similarity with snowflake-arctic-embed-m-v1.5)
- **Reciprocal Rank Fusion** combines both for best results

All ML inference runs locally via ONNX Runtime. Your memories never leave your machine.

## Development

This project uses standard Node.js tools: `npm` for package management and `tsc` (TypeScript compiler) for building.

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the compiler in watch mode for development
npm run dev

# Run TypeScript checks
npm run typecheck
```

## Versioning

This fork follows the official [mnemosyne-oss/mnemosyne](https://github.com/mnemosyne-oss/mnemosyne) CLI contract.

- Patch releases (`0.2.x`) are for docs, metadata, and bug fixes that do not change plugin tool behavior.
- Minor releases (`0.x.0`) are for compatibility updates when the official Mnemosyne CLI changes commands, arguments, or output shape.
- Major releases (`x.0.0`) are for breaking changes to OpenCode tool names, tool schemas, memory scope behavior, or supported Mnemosyne versions.
- Before publishing, run `npm run ci` and verify `mnemosyne store`, `mnemosyne recall`, and `mnemosyne delete` against the official CLI.

## Credits

This project is forked from [gandazgul/opencode-mnemosyne](https://github.com/gandazgul/opencode-mnemosyne) and aligned with the official [mnemosyne-oss/mnemosyne](https://github.com/mnemosyne-oss/mnemosyne) project.

Contributors:

- [Arkhi Muttaqina](https://github.com/ArkhiMuttaqina) <arkhi07@hotmail.co.id>
- [gandazgul](https://github.com/gandazgul) - original opencode-mnemosyne author

## License

MIT
