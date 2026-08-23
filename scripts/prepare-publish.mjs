#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const viewerDist = join(root, "packages/viewer/dist");
const cliViewerDist = join(root, "packages/cli/viewer-dist");

console.log("Preparing packages for npm publish...");

execSync("pnpm --filter @evolving2code/agent-trace-core build", { cwd: root, stdio: "inherit" });
execSync("pnpm --filter @agent-trace/viewer build", { cwd: root, stdio: "inherit" });
execSync("pnpm --filter @evolving2code/agent-trace build", { cwd: root, stdio: "inherit" });

if (!existsSync(viewerDist)) {
  throw new Error(`Viewer build output not found at ${viewerDist}`);
}

if (existsSync(cliViewerDist)) {
  rmSync(cliViewerDist, { recursive: true, force: true });
}

mkdirSync(cliViewerDist, { recursive: true });
cpSync(viewerDist, cliViewerDist, { recursive: true });

console.log(`Copied viewer assets to ${cliViewerDist}`);
