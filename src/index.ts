import path from "node:path";
import { type Plugin, tool } from "@opencode-ai/plugin";

export const MnemosynePlugin: Plugin = async (ctx) => {
  const { directory, worktree, client } = ctx;
  const targetDir = directory || worktree || process.cwd();

  const log = {
    debug: (msg: string) =>
      client.app
        .log({ body: { service: "mnemosyne", level: "debug", message: msg } })
        .catch(() => {}),
    info: (msg: string) =>
      client.app
        .log({ body: { service: "mnemosyne", level: "info", message: msg } })
        .catch(() => {}),
    warn: (msg: string) =>
      client.app
        .log({ body: { service: "mnemosyne", level: "warn", message: msg } })
        .catch(() => {}),
    error: (msg: string) =>
      client.app
        .log({ body: { service: "mnemosyne", level: "error", message: msg } })
        .catch(() => {}),
  };

  // Strip trailing slashes but keep the root slash if it's just "/".
  let projectDir = targetDir.replace(/(.+?)\/+$/, "$1");
  const projectRaw = path.basename(projectDir);
  const project = projectRaw === "global" ? "default" : (projectRaw || "default");
  const projectSource = `opencode:${project}`;
  const globalSource = "opencode:global";
  const defaultRecallCount = "10";
  const coreImportance = "1";

  type StringRecord = Record<string, string | number | boolean | undefined>;

  await log.debug(`Plugin loaded for project: ${project} (dir: ${targetDir})`);

  /**
   * Run the mnemosyne CLI binary gracefully using Bun.spawn.
   * Avoids shell interpolation entirely by passing args as array.
   */
  async function mnemosyne(...args: string[]): Promise<string> {
    await log.debug(`Executing: mnemosyne ${args.join(" ")}`);
    try {
      // @ts-ignore - Bun is globally available in opencode environment
      const proc = Bun.spawn(["mnemosyne", ...args], {
        cwd: targetDir,
        stdout: "pipe",
        stderr: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      if (exitCode !== 0) {
        await log.error(`Execution failed (code ${exitCode}): ${stderr}`);
        throw new Error(stderr.trim() || `mnemosyne ${args[0]} failed`);
      }

      // mnemosyne may write output to stderr (older versions), use whichever has content
      const output = stdout || stderr;
      await log.debug(`Execution successful. Output size: ${output.length}`);
      return output;
    }
    catch (e: unknown) {
      await log.error(`Execution error: ${e instanceof Error ? e.stack : String(e)}`);
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes("not found") ||
        msg.includes("ENOENT") ||
        msg.includes("No such file")
      ) {
        return "Error: mnemosyne binary not found. Install it: https://github.com/mnemosyne-oss/mnemosyne#quick-start";
      }
      throw e;
    }
  }

  function output(text: string, fallback: string): string {
    return text.trim() || fallback;
  }

  function pushOptional(args: string[], value: string | number | undefined) {
    if (value !== undefined && String(value).length > 0) {
      args.push(String(value));
    }
  }

  function pushFlag(args: string[], flag: string, enabled: boolean | undefined) {
    if (enabled) {
      args.push(flag);
    }
  }

  function formatAgenticCommand(toolName: string, cliArgs: string[], notes?: StringRecord) {
    const lines = [
      `Tool: ${toolName}`,
      `CLI: mnemosyne ${cliArgs.join(" ")}`,
    ];
    if (notes) {
      for (const [key, value] of Object.entries(notes)) {
        if (value !== undefined) {
          lines.push(`${key}: ${value}`);
        }
      }
    }
    return lines.join("\n");
  }

  return {
    // ── Tools ──────────────────────────────────────────────

    tool: {
      memory_recall: tool({
        description:
          "Search project memory for relevant context, past decisions, and preferences. Use this at the start of conversations and whenever past context would help.",
        args: {
          query: tool.schema.string().describe("Semantic search query"),
          top_k: tool.schema.number().optional().describe("Maximum results to return. Defaults to 10."),
        },
        async execute(args) {
          await log.info(`Searching project memory for: ${args.query}`);
          const topK = args.top_k ?? defaultRecallCount;
          const result = await mnemosyne("recall", args.query, String(topK));
          return output(result, "No memories found.");
        },
      }),

      memory_recall_global: tool({
        description:
          "Search global memory for cross-project preferences, decisions and patterns.",
        args: {
          query: tool.schema.string().describe("Semantic search query"),
          top_k: tool.schema.number().optional().describe("Maximum results to return. Defaults to 10."),
        },
        async execute(args) {
          await log.info(`Searching global memory for: ${args.query}`);
          const topK = args.top_k ?? defaultRecallCount;
          const result = await mnemosyne("recall", args.query, String(topK));
          return output(result, "No global memories found.");
        },
      }),

      memory_store: tool({
        description:
          "Store a project memory: a decision, preference, or important context. One concise concept per memory. Set core=true for critical context that should always be available in every session (use sparingly).",
        args: {
          content: tool.schema.string().describe("Concise memory to store"),
          core: tool.schema.boolean().optional().describe(
            "If true, this memory is always injected into context (like AGENTS.md). Use sparingly."
          ),
          importance: tool.schema.number().optional().describe(
            "Optional Mnemosyne importance score, usually 0 to 1. core=true defaults to 1."
          ),
        },
        async execute(args) {
          await log.info(`Storing project memory: ${args.content}`);
          const cmdArgs = ["store", args.content, projectSource];
          pushOptional(cmdArgs, args.importance ?? (args.core ? coreImportance : undefined));
          return output(await mnemosyne(...cmdArgs), "Memory stored.");
        },
      }),

      memory_store_global: tool({
        description:
          "Store a cross-project memory: personal preferences, coding style, tool choices. Set core=true for critical cross-project context that should always be available.",
        args: {
          content: tool.schema.string().describe("Global memory to store"),
          core: tool.schema.boolean().optional().describe(
            "If true, this memory is always injected into context. Use sparingly."
          ),
          importance: tool.schema.number().optional().describe(
            "Optional Mnemosyne importance score, usually 0 to 1. core=true defaults to 1."
          ),
        },
        async execute(args) {
          await log.info(`Storing global memory: ${args.content}`);
          const cmdArgs = ["store", args.content, globalSource];
          pushOptional(cmdArgs, args.importance ?? (args.core ? coreImportance : undefined));
          return output(await mnemosyne(...cmdArgs), "Global memory stored.");
        },
      }),

      memory_update: tool({
        description:
          "Update an existing memory by ID. Use when a past decision changed but the original memory should stay as the same record.",
        args: {
          id: tool.schema.string().describe("Mnemosyne memory ID from recall output"),
          content: tool.schema.string().describe("Replacement memory content"),
          importance: tool.schema.number().optional().describe("Optional updated importance score, usually 0 to 1."),
        },
        async execute(args) {
          await log.info(`Updating memory ID: ${args.id}`);
          const cmdArgs = ["update", args.id, args.content];
          pushOptional(cmdArgs, args.importance);
          return output(await mnemosyne(...cmdArgs), "Memory updated.");
        },
      }),

      memory_delete: tool({
        description:
          "Delete an outdated or incorrect memory by its document ID (shown in [brackets] in recall/list results).",
        args: {
          id: tool.schema.string().describe("Mnemosyne memory ID to delete"),
        },
        async execute(args) {
          await log.info(`Deleting memory document ID: ${args.id}`);
          return output(await mnemosyne("delete", String(args.id)), "Memory deleted.");
        },
      }),

      memory_stats: tool({
        description:
          "Show Mnemosyne database statistics: total memories, working memory, episodic memory, triples, banks, and DB path.",
        args: {},
        async execute() {
          await log.info("Reading Mnemosyne stats");
          return output(await mnemosyne("stats"), "No stats returned.");
        },
      }),

      memory_sleep: tool({
        description:
          "Run Mnemosyne consolidation. Use at handoff or after storing many memories so working memory can be compressed into longer-term episodic memory.",
        args: {},
        async execute() {
          await log.info("Running Mnemosyne sleep/consolidation");
          return output(await mnemosyne("sleep"), "Consolidation completed.");
        },
      }),

      memory_diagnose: tool({
        description:
          "Run Mnemosyne diagnostics. Use before risky memory operations or when recall/store behavior looks broken.",
        args: {
          fix: tool.schema.boolean().optional().describe("Apply safe fixes reported by diagnostics."),
          dry_run: tool.schema.boolean().optional().describe("Preview repairs without changing the database."),
          repair_vec_working: tool.schema.boolean().optional().describe("Repair working-memory vector data when needed."),
        },
        async execute(args) {
          const cmdArgs = ["diagnose"];
          pushFlag(cmdArgs, "--fix", args.fix);
          pushFlag(cmdArgs, "--dry-run", args.dry_run);
          pushFlag(cmdArgs, "--repair-vec-working", args.repair_vec_working);
          await log.info("Running Mnemosyne diagnostics");
          return output(await mnemosyne(...cmdArgs), "Diagnostics completed.");
        },
      }),

      memory_export: tool({
        description:
          "Export Mnemosyne memories to JSON for backup, migration, or agent handoff artifacts.",
        args: {
          file: tool.schema.string().optional().describe("Optional output JSON path."),
          include_sync_events: tool.schema.boolean().optional().describe("Include sync event metadata in the export."),
        },
        async execute(args) {
          const cmdArgs = ["export"];
          pushFlag(cmdArgs, "--include-sync-events", args.include_sync_events);
          pushOptional(cmdArgs, args.file);
          await log.info("Exporting Mnemosyne memories");
          return output(await mnemosyne(...cmdArgs), formatAgenticCommand("memory_export", cmdArgs));
        },
      }),

      memory_import: tool({
        description:
          "Import Mnemosyne memories from a JSON export. Use for restoring or moving memory between machines.",
        args: {
          file: tool.schema.string().describe("Input JSON path to import."),
        },
        async execute(args) {
          const cmdArgs = ["import", args.file];
          await log.info(`Importing Mnemosyne memories from: ${args.file}`);
          return output(await mnemosyne(...cmdArgs), "Import completed.");
        },
      }),

      memory_import_hindsight: tool({
        description:
          "Import Hindsight-format memories from a file or URL, optionally into a named bank.",
        args: {
          source: tool.schema.string().describe("Hindsight file path or URL."),
          bank: tool.schema.string().optional().describe("Optional target memory bank."),
        },
        async execute(args) {
          const cmdArgs = ["import-hindsight", args.source];
          pushOptional(cmdArgs, args.bank);
          await log.info(`Importing Hindsight memories from: ${args.source}`);
          return output(await mnemosyne(...cmdArgs), "Hindsight import completed.");
        },
      }),

      memory_bank: tool({
        description:
          "Manage Mnemosyne memory banks for domain isolation. Use list before create/delete.",
        args: {
          action: tool.schema.enum(["list", "create", "delete"]).describe("Bank operation."),
          name: tool.schema.string().optional().describe("Bank name for create/delete."),
        },
        async execute(args) {
          const cmdArgs = ["bank", args.action];
          pushOptional(cmdArgs, args.name);
          await log.info(`Running Mnemosyne bank ${args.action}`);
          return output(await mnemosyne(...cmdArgs), "Bank command completed.");
        },
      }),

      memory_reindex: tool({
        description:
          "Rebuild Mnemosyne vector indexes with the active or selected embedding model. Use after changing embedding model configuration.",
        args: {
          model: tool.schema.string().optional().describe("Optional embedding model name."),
          dry_run: tool.schema.boolean().optional().describe("Preview the reindex without changing data."),
          yes: tool.schema.boolean().optional().describe("Confirm prompts non-interactively."),
          no_backup: tool.schema.boolean().optional().describe("Skip backup before reindexing."),
        },
        async execute(args) {
          const cmdArgs = ["reindex"];
          if (args.model) {
            cmdArgs.push("--model", args.model);
          }
          pushFlag(cmdArgs, "--dry-run", args.dry_run);
          pushFlag(cmdArgs, "--yes", args.yes);
          pushFlag(cmdArgs, "--no-backup", args.no_backup);
          await log.info("Running Mnemosyne reindex");
          return output(await mnemosyne(...cmdArgs), "Reindex completed.");
        },
      }),

      memory_backup: tool({
        description:
          "Create a compressed Mnemosyne database backup, optionally under an output directory.",
        args: {
          output_dir: tool.schema.string().optional().describe("Optional backup output directory."),
        },
        async execute(args) {
          const cmdArgs = ["backup"];
          pushOptional(cmdArgs, args.output_dir);
          await log.info("Creating Mnemosyne backup");
          return output(await mnemosyne(...cmdArgs), "Backup completed.");
        },
      }),

      memory_restore: tool({
        description:
          "Restore Mnemosyne from a backup database archive. This can replace current memory data; use only when explicitly requested.",
        args: {
          backup: tool.schema.string().describe("Path to backup .db.gz file."),
        },
        async execute(args) {
          await log.warn(`Restoring Mnemosyne backup: ${args.backup}`);
          return output(await mnemosyne("restore", args.backup), "Restore completed.");
        },
      }),

      memory_verify: tool({
        description:
          "Verify Mnemosyne database integrity. Use --quick for faster checks during coding sessions.",
        args: {
          db_path: tool.schema.string().optional().describe("Optional database path to verify."),
          quick: tool.schema.boolean().optional().describe("Run a quick verification."),
        },
        async execute(args) {
          const cmdArgs = ["verify"];
          pushOptional(cmdArgs, args.db_path);
          pushFlag(cmdArgs, "--quick", args.quick);
          await log.info("Verifying Mnemosyne database");
          return output(await mnemosyne(...cmdArgs), "Verification completed.");
        },
      }),

      memory_backups: tool({
        description:
          "List available Mnemosyne backups, optionally from a backup directory.",
        args: {
          backup_dir: tool.schema.string().optional().describe("Optional backup directory."),
        },
        async execute(args) {
          const cmdArgs = ["backups"];
          pushOptional(cmdArgs, args.backup_dir);
          await log.info("Listing Mnemosyne backups");
          return output(await mnemosyne(...cmdArgs), "No backups listed.");
        },
      }),

      memory_sync: tool({
        description:
          "Run one Mnemosyne sync against a remote server. Use for agent handoff across machines or team memory sync.",
        args: {
          remote: tool.schema.string().describe("Remote sync server URL."),
          mode: tool.schema.enum(["push", "pull", "bidirectional"]).optional().describe("Sync mode. Defaults to Mnemosyne's bidirectional behavior."),
          encrypt: tool.schema.boolean().optional().describe("Enable client-side encrypted sync when configured."),
        },
        async execute(args) {
          const cmdArgs = ["sync", "--remote", args.remote];
          if (args.mode) {
            cmdArgs.push("--mode", args.mode);
          }
          pushFlag(cmdArgs, "--encrypt", args.encrypt);
          await log.info(`Running Mnemosyne sync with: ${args.remote}`);
          return output(await mnemosyne(...cmdArgs), "Sync completed.");
        },
      }),

      memory_sync_status: tool({
        description:
          "Show Mnemosyne sync status for local memory or a remote sync server.",
        args: {
          remote: tool.schema.string().optional().describe("Optional remote sync server URL."),
          json: tool.schema.boolean().optional().describe("Return JSON output when supported."),
        },
        async execute(args) {
          const cmdArgs = ["sync-status"];
          if (args.remote) {
            cmdArgs.push("--remote", args.remote);
          }
          pushFlag(cmdArgs, "--json", args.json);
          await log.info("Reading Mnemosyne sync status");
          return output(await mnemosyne(...cmdArgs), "No sync status returned.");
        },
      }),

      memory_sync_generate_key: tool({
        description:
          "Generate a Mnemosyne sync encryption key. Store the returned key securely; do not commit it.",
        args: {},
        async execute() {
          await log.info("Generating Mnemosyne sync key");
          return output(await mnemosyne("sync-generate-key"), "No key returned.");
        },
      }),
    },

    // ── Hooks ──────────────────────────────────────────────

    // Inject memory instructions into compaction so they survive
    // context window resets.
    "experimental.session.compacting": async (_input, output) => {
      output.context.push(`## Persistent Memory (mnemosyne)

You have persistent memory tools for recall/store/update/delete, stats,
consolidation, diagnostics, import/export, banks, backup/restore, verify,
reindex, and sync.

When to use memory:
- Search memory when past context would help answer the user's request.
- Store concise summaries of important decisions, preferences, and patterns.
- Use memory_update when a memory should be corrected in place.
- Delete outdated memories when new decisions contradict them.
- Use **core** for facts that should always be in context (project architecture, key conventions, user preferences).
- Use **global** variants for cross-project preferences (coding style, tool choices).
- Use memory_sleep at handoff or after storing many memories.
- Use backup/export before risky memory maintenance.
- At the end of a session, store any relevant memories for future sessions.`);
    },
  };
};
