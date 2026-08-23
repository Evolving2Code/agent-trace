#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEMO_SCENARIOS,
  TraceStore,
  discoverCursorTranscripts,
  formatCost,
  formatDuration,
  formatTokens,
  importAllCursorTranscriptsInDirectory,
  importCursorTranscript,
  importLatestCursorTranscript,
  resolveDbPath,
  seedAllDemos,
  seedDemoRun,
} from "@evolving2code/agent-trace-core";
import chalk from "chalk";
import { Command } from "commander";
import open from "open";
import ora from "ora";
import { resolveViewerDist } from "./paths.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIEWER_DIST = resolveViewerDist(import.meta.url);

function handleError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red("✗"), message);
  process.exit(1);
}

const program = new Command();

program
  .name("agent-trace")
  .description("Browser DevTools for AI agents — record, replay, and fork agent runs")
  .version("0.1.1");

program
  .command("init")
  .description("Initialize the local trace database")
  .option("-d, --db <path>", "Database path")
  .action((opts: { db?: string }) => {
    const dbPath = resolveDbPath(opts.db);
    mkdirSync(dirname(dbPath), { recursive: true });
    const store = new TraceStore(dbPath);
    store.close();
    console.log(chalk.green("✓"), `Trace database ready at ${chalk.cyan(dbPath)}`);
  });

program
  .command("demo")
  .description("Seed demo traces for exploration")
  .option("-d, --db <path>", "Database path")
  .option("-s, --scenario <id>", "Specific scenario (fix-auth-bug, infinite-loop, refactor-api)")
  .action((opts: { db?: string; scenario?: string }) => {
    const dbPath = resolveDbPath(opts.db);
    const store = new TraceStore(dbPath);
    const spinner = ora("Seeding demo traces...").start();

    try {
      const ids = opts.scenario
        ? [seedDemoRun(store, opts.scenario)]
        : seedAllDemos(store);

      spinner.succeed(`Seeded ${ids.length} demo run(s)`);
      for (const id of ids) {
        const run = store.getRun(id)!;
        console.log(`  ${chalk.cyan(id)}  ${run.name}  ${chalk.dim(run.source)}`);
      }
      console.log(chalk.dim(`\nRun ${chalk.white("agent-trace play")} to open the replay studio.`));
    } catch (error) {
      spinner.fail("Failed to seed demo traces");
      handleError(error);
    } finally {
      store.close();
    }
  });

program
  .command("list")
  .description("List recorded agent runs")
  .option("-d, --db <path>", "Database path")
  .option("-n, --limit <n>", "Max runs to show", "20")
  .action((opts: { db?: string; limit: string }) => {
    const dbPath = resolveDbPath(opts.db);
    if (!existsSync(dbPath)) {
      console.log(chalk.yellow("No traces yet. Run:"), chalk.white("agent-trace demo"));
      return;
    }

    const store = new TraceStore(dbPath);
    try {
      const runs = store.listRuns(parseInt(opts.limit, 10));
      if (runs.length === 0) {
        console.log(chalk.yellow("No traces yet. Run:"), chalk.white("agent-trace demo"));
        return;
      }

      console.log(chalk.bold("\n  Agent Runs\n"));
      for (const run of runs) {
        const statusColor =
          run.status === "completed" ? chalk.green : run.status === "failed" ? chalk.red : chalk.yellow;
        console.log(
          `  ${chalk.cyan(run.id)}  ${statusColor(run.status.padEnd(9))}  ${run.name}`
        );
        console.log(
          chalk.dim(
            `    ${run.eventCount} events · ${formatTokens(run.totalTokensIn + run.totalTokensOut)} tokens · ${formatCost(run.totalCostUsd)} · ${formatDuration(run.totalLatencyMs)}`
          )
        );
      }
      console.log();
    } finally {
      store.close();
    }
  });

program
  .command("play [runId]")
  .description("Open the replay studio for a run")
  .option("-d, --db <path>", "Database path")
  .option("-p, --port <port>", "Viewer port", "4173")
  .option("--no-open", "Don't open browser automatically")
  .action(async (runId: string | undefined, opts: { db?: string; port: string; open: boolean }) => {
    const dbPath = resolveDbPath(opts.db);
    if (!existsSync(dbPath)) {
      console.log(chalk.yellow("No traces yet. Run:"), chalk.white("agent-trace demo"));
      process.exit(1);
    }

    const store = new TraceStore(dbPath);
    let selectedRunId = runId;
    try {
      if (!selectedRunId) {
        const runs = store.listRuns(1);
        if (runs.length === 0) {
          console.log(chalk.yellow("No traces yet. Run:"), chalk.white("agent-trace demo"));
          process.exit(1);
        }
        selectedRunId = runs[0].id;
      }

      const run = store.getRun(selectedRunId);
      if (!run) {
        console.error(chalk.red(`Run not found: ${selectedRunId}`));
        process.exit(1);
      }

      const exportData = store.exportRun(selectedRunId);
      const exportPath = join(dirname(dbPath), "latest-run.json");
      writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

      console.log(chalk.green("▶"), `Replaying ${chalk.bold(run.name)} ${chalk.dim(`(${selectedRunId})`)}`);

      if (!existsSync(VIEWER_DIST)) {
        console.error(chalk.red("Replay studio assets not found."));
        console.error(chalk.dim("Rebuild the package or reinstall @evolving2code/agent-trace."));
        process.exit(1);
      } else {
        await serveViewer(parseInt(opts.port, 10), exportPath, opts.open);
      }
    } finally {
      store.close();
    }
  });

program
  .command("export <runId>")
  .description("Export a run as shareable JSON")
  .option("-d, --db <path>", "Database path")
  .option("-o, --output <path>", "Output file path")
  .action((runId: string, opts: { db?: string; output?: string }) => {
    const dbPath = resolveDbPath(opts.db);
    const store = new TraceStore(dbPath);
    try {
      const data = store.exportRun(runId);
      const output = opts.output ?? `${runId}.trace.json`;
      writeFileSync(output, JSON.stringify(data, null, 2));
      console.log(chalk.green("✓"), `Exported to ${chalk.cyan(output)}`);
    } catch (error) {
      handleError(error);
    } finally {
      store.close();
    }
  });

program
  .command("import-cursor [path]")
  .description("Import a Cursor agent transcript (cloud JSON or local JSONL)")
  .option("-d, --db <path>", "Database path")
  .option("-n, --name <name>", "Override run name")
  .option("--latest", "Import the most recently discovered Cursor transcript")
  .option("--all", "Import all transcripts in a directory")
  .option("--play", "Open replay studio after import")
  .action(async (inputPath: string | undefined, opts: {
    db?: string;
    name?: string;
    latest?: boolean;
    all?: boolean;
    play?: boolean;
  }) => {
    const dbPath = resolveDbPath(opts.db);
    const store = new TraceStore(dbPath);
    const spinner = ora("Importing Cursor transcript...").start();

    try {
      let run;
      if (opts.latest || !inputPath) {
        const result = importLatestCursorTranscript(store, undefined, { name: opts.name });
        run = result.run;
        spinner.succeed(`Imported latest Cursor run from ${result.info.path}`);
      } else if (opts.all) {
        const runs = importAllCursorTranscriptsInDirectory(store, inputPath, { name: opts.name });
        spinner.succeed(`Imported ${runs.length} Cursor run(s)`);
        for (const imported of runs) {
          console.log(`  ${chalk.cyan(imported.id)}  ${imported.name}`);
        }
        store.close();
        return;
      } else {
        run = importCursorTranscript(store, inputPath, { name: opts.name });
        spinner.succeed(`Imported Cursor transcript`);
      }

      const events = store.getEvents(run.id);
      console.log(`  ${chalk.cyan(run.id)}  ${run.name}`);
      console.log(
        chalk.dim(
          `  ${events.length} events · ${run.model ?? "cursor"} · ${formatDuration(run.totalLatencyMs)}`
        )
      );
      console.log(chalk.dim(`\nRun ${chalk.white(`agent-trace play ${run.id}`)} to replay.`));

      store.close();

      if (opts.play) {
        const { spawn } = await import("node:child_process");
        const cliPath = fileURLToPath(import.meta.url);
        spawn(process.execPath, [cliPath, "play", run.id, "--db", dbPath], {
          stdio: "inherit",
        });
      }
    } catch (error) {
      spinner.fail("Failed to import Cursor transcript");
      store.close();
      handleError(error);
    }
  });

const cursor = program.command("cursor").description("Cursor transcript utilities");

cursor
  .command("list")
  .description("List discovered Cursor transcripts on this machine")
  .option("--json", "Output as JSON")
  .action((opts: { json?: boolean }) => {
    const transcripts = discoverCursorTranscripts();

    if (opts.json) {
      console.log(JSON.stringify(transcripts, null, 2));
      return;
    }

    if (transcripts.length === 0) {
      console.log(chalk.yellow("No Cursor transcripts found."));
      console.log(chalk.dim("Looked in ~/.cursor/projects and /tmp/cursor/cloud-agent-transcripts"));
      return;
    }

    console.log(chalk.bold("\n  Cursor Transcripts\n"));
    for (const transcript of transcripts) {
      console.log(`  ${chalk.cyan(transcript.id)}  ${transcript.format}`);
      console.log(`    ${transcript.name}`);
      console.log(
        chalk.dim(
          `    ${transcript.path}${transcript.messageCount ? ` · ${transcript.messageCount} messages` : ""}`
        )
      );
    }
    console.log(chalk.dim(`\nImport with ${chalk.white("agent-trace import-cursor --latest")} or a file path.`));
    console.log();
  });

program
  .command("import <file>")
  .description("Import a run from JSON")
  .option("-d, --db <path>", "Database path")
  .action((file: string, opts: { db?: string }) => {
    const dbPath = resolveDbPath(opts.db);
    const store = new TraceStore(dbPath);
    try {
      const data = JSON.parse(readFileSync(file, "utf-8"));
      const run = store.importRun(data);
      console.log(chalk.green("✓"), `Imported as ${chalk.cyan(run.id)} — ${run.name}`);
    } catch (error) {
      handleError(error);
    } finally {
      store.close();
    }
  });

program
  .command("fork <runId> <eventId>")
  .description("Fork a run from a specific event")
  .option("-d, --db <path>", "Database path")
  .option("-n, --name <name>", "Name for the forked run")
  .action((runId: string, eventId: string, opts: { db?: string; name?: string }) => {
    const dbPath = resolveDbPath(opts.db);
    const store = new TraceStore(dbPath);
    try {
      const forked = store.forkRun(runId, { fromEventId: eventId, name: opts.name });
      console.log(chalk.green("✓"), `Forked run ${chalk.cyan(forked.id)} from step ${forked.forkFromSequence! + 1}`);
      console.log(chalk.dim(`  Run ${chalk.white(`agent-trace play ${forked.id}`)} to replay`));
    } catch (error) {
      handleError(error);
    } finally {
      store.close();
    }
  });

program
  .command("scenarios")
  .description("List available demo scenarios")
  .action(() => {
    console.log(chalk.bold("\n  Demo Scenarios\n"));
    for (const [id, scenario] of Object.entries(DEMO_SCENARIOS)) {
      console.log(`  ${chalk.cyan(id)}`);
      console.log(`    ${scenario.name} — ${scenario.description}`);
      console.log(chalk.dim(`    source: ${scenario.source} · model: ${scenario.model}`));
    }
    console.log();
  });

async function serveViewer(port: number, exportPath: string, shouldOpen: boolean): Promise<void> {
  const { createServer } = await import("node:http");
  const { createReadStream, statSync } = await import("node:fs");

  const server = createServer((req, res) => {
    if (req.url === "/api/run") {
      res.setHeader("Content-Type", "application/json");
      res.end(readFileSync(exportPath, "utf-8"));
      return;
    }

    let filePath = join(VIEWER_DIST, req.url === "/" ? "index.html" : req.url!.replace(/^\//, ""));
    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      filePath = join(VIEWER_DIST, "index.html");
    }

    const ext = filePath.split(".").pop();
    const types: Record<string, string> = {
      html: "text/html",
      js: "application/javascript",
      css: "text/css",
      json: "application/json",
      svg: "image/svg+xml",
    };
    res.setHeader("Content-Type", types[ext ?? ""] ?? "application/octet-stream");
    createReadStream(filePath).pipe(res);
  });

  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(chalk.dim(`  Studio running at ${chalk.cyan(url)}`));
      if (shouldOpen) open(url);
      resolve();
    });
  });

  process.on("SIGINT", () => {
    server.close();
    process.exit(0);
  });
}

program.parse();
