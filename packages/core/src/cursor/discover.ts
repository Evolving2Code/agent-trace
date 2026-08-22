import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { CursorTranscriptFormat, CursorTranscriptInfo } from "./types.js";
import { loadCursorIndexMetadata } from "./parser.js";

const CLOUD_TRANSCRIPT_GLOB = "transcript.json";
const LOCAL_TRANSCRIPT_EXT = ".jsonl";

export function defaultCursorSearchRoots(): string[] {
  const home = homedir();
  return [
    join(home, ".cursor", "projects"),
    "/tmp/cursor/cloud-agent-transcripts",
  ].filter((root) => existsSync(root));
}

export function discoverCursorTranscripts(searchRoots?: string[]): CursorTranscriptInfo[] {
  const roots = searchRoots ?? defaultCursorSearchRoots();
  const found: CursorTranscriptInfo[] = [];

  for (const root of roots) {
    if (!existsSync(root)) continue;

    if (root.includes("cloud-agent-transcripts")) {
      found.push(...discoverCloudTranscripts(root));
    } else {
      found.push(...discoverLocalTranscripts(root));
    }
  }

  return found.sort((a, b) => (b.updatedAt ?? b.startedAt ?? 0) - (a.updatedAt ?? a.startedAt ?? 0));
}

function discoverCloudTranscripts(root: string): CursorTranscriptInfo[] {
  const results: CursorTranscriptInfo[] = [];

  for (const batchDir of safeReadDir(root)) {
    const batchPath = join(root, batchDir);
    if (!statSync(batchPath).isDirectory()) continue;

    const indexPath = join(batchPath, "index.json");
    const indexMeta = existsSync(indexPath)
      ? loadCursorIndexMetadata(indexPath, readFileSync(indexPath, "utf-8"))
      : {};

    for (const entry of safeReadDir(batchPath)) {
      const entryPath = join(batchPath, entry);
      const transcriptPath = join(entryPath, CLOUD_TRANSCRIPT_GLOB);
      if (!existsSync(transcriptPath)) continue;

      const stat = statSync(transcriptPath);
      const preview = readTranscriptPreview(transcriptPath, "cloud-json");

      results.push({
        id: entry,
        path: transcriptPath,
        format: "cloud-json",
        name: indexMeta.name ?? preview.name ?? entry,
        model: indexMeta.model,
        startedAt: indexMeta.startedAt ?? stat.mtimeMs,
        updatedAt: indexMeta.updatedAt ?? stat.mtimeMs,
        messageCount: preview.messageCount,
        sourcePath: transcriptPath,
      });
    }
  }

  return results;
}

function discoverLocalTranscripts(root: string): CursorTranscriptInfo[] {
  const results: CursorTranscriptInfo[] = [];

  for (const projectDir of safeReadDir(root)) {
    const transcriptsDir = join(root, projectDir, "agent-transcripts");
    if (!existsSync(transcriptsDir)) continue;

    walkJsonlFiles(transcriptsDir, (filePath) => {
      const stat = statSync(filePath);
      const preview = readTranscriptPreview(filePath, "local-jsonl");
      const id = basename(filePath).replace(/\.jsonl$/i, "");

      results.push({
        id,
        path: filePath,
        format: "local-jsonl",
        name: preview.name ?? id,
        startedAt: stat.mtimeMs,
        updatedAt: stat.mtimeMs,
        messageCount: preview.messageCount,
        sourcePath: filePath,
      });
    });
  }

  return results;
}

function walkJsonlFiles(dir: string, onFile: (path: string) => void) {
  for (const entry of safeReadDir(dir)) {
    const entryPath = join(dir, entry);
    const stat = statSync(entryPath);
    if (stat.isDirectory()) {
      walkJsonlFiles(entryPath, onFile);
    } else if (entry.endsWith(LOCAL_TRANSCRIPT_EXT)) {
      onFile(entryPath);
    }
  }
}

function readTranscriptPreview(
  filePath: string,
  format: CursorTranscriptFormat
): { name?: string; messageCount?: number } {
  try {
    const content = readFileSync(filePath, "utf-8");
    if (format === "cloud-json") {
      const parsed = JSON.parse(content) as { messages?: Array<{ role?: string; text?: string }> };
      const messages = parsed.messages ?? [];
      const firstUser = messages.find((m) => m.role === "user" && m.text)?.text;
      return {
        name: firstUser ? truncate(firstUser, 72) : undefined,
        messageCount: messages.length,
      };
    }

    const lines = content.split(/\r?\n/).filter(Boolean);
    let firstUser: string | undefined;
    for (const line of lines) {
      const record = JSON.parse(line) as {
        role?: string;
        text?: string;
        message?: { content?: Array<{ type?: string; text?: string }> };
      };
      if (record.role === "user") {
        firstUser =
          record.text ??
          record.message?.content?.find((b) => b.type === "text")?.text;
        if (firstUser) break;
      }
    }

    return {
      name: firstUser ? truncate(firstUser, 72) : undefined,
      messageCount: lines.length,
    };
  } catch {
    return {};
  }
}

function safeReadDir(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

function truncate(value: string, max: number): string {
  const singleLine = value.replace(/\s+/g, " ").trim();
  if (singleLine.length <= max) return singleLine;
  return `${singleLine.slice(0, max)}…`;
}

export function resolveCursorTranscriptInput(inputPath: string): string {
  if (!existsSync(inputPath)) {
    throw new Error(`Path not found: ${inputPath}`);
  }

  const stat = statSync(inputPath);
  if (stat.isFile()) return inputPath;

  const direct = join(inputPath, CLOUD_TRANSCRIPT_GLOB);
  if (existsSync(direct)) return direct;

  const indexPath = join(inputPath, "index.json");
  if (existsSync(indexPath)) {
    const index = JSON.parse(readFileSync(indexPath, "utf-8")) as {
      agents?: Array<{ bcId?: string }>;
    };
    const bcId = index.agents?.[0]?.bcId;
    if (bcId) {
      const nested = join(inputPath, bcId, CLOUD_TRANSCRIPT_GLOB);
      if (existsSync(nested)) return nested;
    }
  }

  const jsonlFiles: string[] = [];
  walkJsonlFiles(inputPath, (file) => jsonlFiles.push(file));
  if (jsonlFiles.length === 1) return jsonlFiles[0];
  if (jsonlFiles.length > 1) {
    throw new Error(
      `Directory contains multiple Cursor transcripts. Pass a specific .jsonl file or use --all. Found ${jsonlFiles.length} files.`
    );
  }

  throw new Error(`No Cursor transcript found at ${inputPath}`);
}

export function listCursorTranscriptsInDirectory(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  const direct = join(dir, CLOUD_TRANSCRIPT_GLOB);
  if (existsSync(direct)) {
    files.push(direct);
    return files;
  }

  walkJsonlFiles(dir, (file) => files.push(file));

  for (const entry of safeReadDir(dir)) {
    const nested = join(dir, entry, CLOUD_TRANSCRIPT_GLOB);
    if (existsSync(nested)) files.push(nested);
  }

  return [...new Set(files)];
}
