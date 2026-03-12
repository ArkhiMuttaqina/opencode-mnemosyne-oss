import { type Plugin, tool } from "@opencode-ai/plugin"
import path from "path"

export const MnemosynePlugin: Plugin = async ({ $, directory, worktree }) => {
  const project = path.basename(worktree || directory)

  /**
   * Run the mnemosyne CLI binary gracefully.
   * If the binary is not found, return a helpful install message
   * instead of throwing.
   */
  async function mnemosyne(...args: string[]): Promise<string> {
    try {
      return await $`mnemosyne ${args}`.text()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (
        msg.includes("not found") ||
        msg.includes("ENOENT") ||
        msg.includes("No such file")
      ) {
        return "Error: mnemosyne binary not found. Install it: https://github.com/gandazgul/mnemosyne#install"
      }
      throw e
    }
  }

  // Auto-init the project collection (idempotent).
  await $`mnemosyne init --name ${project}`.quiet().nothrow()

  return {
    // ── Tools ──────────────────────────────────────────────

    tool: {
      memory_recall: tool({
        description:
          "Search project memory for relevant context, past decisions, and preferences. Use this at the start of conversations and whenever past context would help.",
        args: {
          query: tool.schema.string().describe("Semantic search query"),
        },
        async execute(args) {
          const result = await mnemosyne(
            "search",
            "--name",
            project,
            "--format",
            "plain",
            args.query,
          )
          return result.trim() || "No memories found."
        },
      }),

      memory_recall_global: tool({
        description:
          "Search global memory for cross-project preferences and patterns.",
        args: {
          query: tool.schema.string().describe("Semantic search query"),
        },
        async execute(args) {
          const result = await mnemosyne(
            "search",
            "--global",
            "--format",
            "plain",
            args.query,
          )
          return result.trim() || "No global memories found."
        },
      }),

      memory_store: tool({
        description:
          "Store a project memory: a decision, preference, or important context. One concise concept per memory.",
        args: {
          content: tool.schema.string().describe("Concise memory to store"),
        },
        async execute(args) {
          return (
            await mnemosyne("add", "--name", project, args.content)
          ).trim()
        },
      }),

      memory_store_global: tool({
        description:
          "Store a cross-project memory: personal preferences, coding style, tool choices.",
        args: {
          content: tool.schema.string().describe("Global memory to store"),
        },
        async execute(args) {
          // Ensure the global collection exists.
          await $`mnemosyne init --global`.quiet().nothrow()
          return (
            await mnemosyne("add", "--global", args.content)
          ).trim()
        },
      }),

      memory_delete: tool({
        description:
          "Delete an outdated or incorrect memory by its document ID (shown in [brackets] in recall results).",
        args: {
          id: tool.schema.number().describe("Document ID to delete"),
        },
        async execute(args) {
          return (await mnemosyne("delete", String(args.id))).trim()
        },
      }),
    },

    // ── Hooks ──────────────────────────────────────────────

    // Inject memory instructions into compaction so they survive
    // context window resets.
    "experimental.session.compacting": async (_input, output) => {
      output.context.push(`## Persistent Memory (mnemosyne)

You have persistent memory tools: memory_recall, memory_store, memory_delete,
memory_recall_global, memory_store_global.

- Search memory when past context would help.
- Store concise summaries of decisions, preferences, and patterns.
- Delete outdated memories when new decisions contradict them.
- Use global variants for cross-project preferences.`)
    },
  }
}
