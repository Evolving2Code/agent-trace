import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { TraceStore } from "../store.js";
import type { Run } from "../types.js";
import {
  discoverCursorTranscripts,
  listCursorTranscriptsInDirectory,
  resolveCursorTranscriptInput,
} from "./discover.js";
import {
  loadCursorIndexMetadata,
  parseCursorTranscriptFile,
} from "./parser.js";
import type { CursorImportOptions, CursorTranscriptInfo, ParsedCursorTranscript } from "./types.js";

export function parseCursorTranscriptFromPath(
  filePath: string,
  options: CursorImportOptions = {}
): ParsedCursorTranscript {
  const content = readFileSync(filePath, "utf-8");
  const importOptions = enrichOptionsFromIndex(filePath, options);
  return parseCursorTranscriptFile(content, filePath, importOptions);
}

function enrichOptionsFromIndex(filePath: string, options: CursorImportOptions): CursorImportOptions {
  const indexCandidates = [
    join(dirname(filePath), "index.json"),
    join(dirname(dirname(filePath)), "index.json"),
  ];

  for (const indexPath of indexCandidates) {
    try {
      const meta = loadCursorIndexMetadata(indexPath, readFileSync(indexPath, "utf-8"));
      if (meta.name || meta.model) {
        return {
          ...options,
          name: options.name ?? meta.name,
          model: options.model ?? meta.model,
          metadata: {
            ...options.metadata,
            cursorBcId: meta.id,
            cursorStartedAt: meta.startedAt,
            cursorUpdatedAt: meta.updatedAt,
          },
        };
      }
    } catch {
      // ignore missing index
    }
  }

  return options;
}

export function importCursorTranscript(
  store: TraceStore,
  inputPath: string,
  options: CursorImportOptions = {}
): Run {
  const resolvedPath = resolveCursorTranscriptInput(inputPath);
  const parsed = parseCursorTranscriptFromPath(resolvedPath, options);
  return store.importParsedRun(parsed);
}

export function importAllCursorTranscriptsInDirectory(
  store: TraceStore,
  dir: string,
  options: CursorImportOptions = {}
): Run[] {
  const files = listCursorTranscriptsInDirectory(dir);
  if (files.length === 0) {
    throw new Error(`No Cursor transcripts found in ${dir}`);
  }

  return files.map((file, index) => {
    const name =
      options.name && files.length > 1
        ? `${options.name} (${index + 1}/${files.length})`
        : options.name;
    return importCursorTranscript(store, file, { ...options, name });
  });
}

export function importLatestCursorTranscript(
  store: TraceStore,
  searchRoots?: string[],
  options: CursorImportOptions = {}
): { run: Run; info: CursorTranscriptInfo } {
  const transcripts = discoverCursorTranscripts(searchRoots);
  if (transcripts.length === 0) {
    throw new Error(
      "No Cursor transcripts found. Pass a transcript path or fetch one into /tmp/cursor/cloud-agent-transcripts."
    );
  }

  const latest = transcripts[0];
  const run = importCursorTranscript(store, latest.path, {
    ...options,
    name: options.name ?? latest.name,
    model: options.model ?? latest.model,
  });

  return { run, info: latest };
}

export function importCursorTranscriptToExport(
  inputPath: string,
  options: CursorImportOptions = {}
): { run: Run; events: import("../types.js").TraceEvent[] } {
  const resolvedPath = resolveCursorTranscriptInput(inputPath);
  const parsed = parseCursorTranscriptFromPath(resolvedPath, options);

  return {
    run: {
      id: "preview",
      ...parsed.run,
      totalTokensIn: parsed.run.totalTokensIn ?? 0,
      totalTokensOut: parsed.run.totalTokensOut ?? 0,
      totalCostUsd: parsed.run.totalCostUsd ?? 0,
      totalLatencyMs: parsed.run.totalLatencyMs ?? 0,
      metadata: parsed.run.metadata ?? {},
    },
    events: parsed.events.map((event, index) => ({
      id: `evt-${index}`,
      runId: "preview",
      ...event,
    })),
  };
}

export { discoverCursorTranscripts };
