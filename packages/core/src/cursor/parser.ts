import { basename } from "node:path";
import type { EventType, RunStatus, TraceEvent } from "../types.js";
import type {
  CloudTranscript,
  CloudTranscriptMessage,
  CursorImportOptions,
  LocalTranscriptLine,
  ParsedCursorTranscript,
} from "./types.js";

const FILE_EDIT_TOOLS = new Set([
  "search_replace",
  "write",
  "edit_file",
  "apply_patch",
  "delete_file",
]);

const SHELL_TOOLS = new Set(["run_terminal_cmd", "shell", "run_terminal_command"]);

type PendingEvent = Omit<TraceEvent, "id" | "runId">;

export function parseCursorCloudTranscript(
  input: CloudTranscript | string,
  options: CursorImportOptions = {}
): ParsedCursorTranscript {
  const transcript: CloudTranscript =
    typeof input === "string" ? (JSON.parse(input) as CloudTranscript) : input;

  if (!Array.isArray(transcript.messages)) {
    throw new Error("Invalid Cursor cloud transcript: expected { messages: [] }");
  }

  const events: PendingEvent[] = [];
  let sequence = 0;
  let startedAt = Date.now();
  let completedAt: number | undefined;
  let totalLatencyMs = 0;
  let failed = false;
  let firstUserMessage: string | undefined;
  let runStarted = false;

  const addEvent = (
    type: EventType,
    data: Record<string, unknown>,
    extras: {
      timestamp?: number;
      label?: string;
      latencyMs?: number;
      status?: "ok" | "error" | "pending";
    } = {}
  ) => {
    const timestamp = extras.timestamp ?? startedAt + sequence * 1000;
    if (!runStarted) {
      startedAt = timestamp;
      runStarted = true;
      events.push({
        sequence: sequence++,
        timestamp: startedAt,
        type: "run.started",
        data: {
          prompt: typeof data.content === "string" ? data.content : firstUserMessage,
          source: "cursor",
        },
      });
    }

    completedAt = timestamp;
    if (extras.latencyMs) totalLatencyMs += extras.latencyMs;

    events.push({
      sequence: sequence++,
      timestamp,
      type,
      label: extras.label,
      data,
      latencyMs: extras.latencyMs,
      status: extras.status,
    });
  };

  for (const message of transcript.messages) {
    switch (message.role) {
      case "user":
        if (message.text) {
          if (!firstUserMessage) firstUserMessage = message.text;
          addEvent("user.message", { content: message.text }, { label: "User Message" });
        }
        break;

      case "assistant":
        if (message.thinking) {
          addEvent("agent.thought", { content: message.thinking });
        }
        if (message.text) {
          addEvent("llm.response", { content: message.text });
        }
        if (message.tool_calls) {
          for (const call of message.tool_calls) {
            addEvent(
              mapToolCallType(call.tool_name),
              buildToolCallData(call.tool_name, undefined, call),
              {
                label: formatToolLabel(call.tool_name),
                timestamp: call.started_at_ms,
                latencyMs: call.duration_ms,
              }
            );
          }
        }
        break;

      case "tool":
        handleToolMessage(message, addEvent);
        if (isToolError(message)) failed = true;
        break;
    }
  }

  if (events.length === 0) {
    throw new Error("Cursor transcript contains no importable events");
  }

  if (!runStarted) {
    events.unshift({
      sequence: 0,
      timestamp: startedAt,
      type: "run.started",
      data: { source: "cursor" },
    });
    sequence = 1;
    for (let i = 1; i < events.length; i++) {
      events[i] = { ...events[i], sequence: i };
    }
  }

  events.push({
    sequence: events.length,
    timestamp: (completedAt ?? startedAt) + 1,
    type: failed ? "run.failed" : "run.completed",
    data: {
      summary: failed
        ? "Imported Cursor run ended with tool errors"
        : `Imported Cursor run with ${events.length} events`,
    },
  });

  const name = options.name ?? deriveRunName(firstUserMessage, options.metadata?.sourcePath as string);

  return {
    run: {
      name,
      status: (failed ? "failed" : "completed") as RunStatus,
      source: "cursor",
      model: options.model,
      startedAt,
      completedAt,
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalCostUsd: 0,
      totalLatencyMs,
      metadata: {
        importer: "agent-trace",
        cursorFormat: "cloud-json",
        ...options.metadata,
      },
    },
    events,
  };
}

export function parseCursorLocalTranscript(
  input: string,
  options: CursorImportOptions = {}
): ParsedCursorTranscript {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const events: PendingEvent[] = [];
  let sequence = 0;
  let startedAt = Date.now();
  let completedAt: number | undefined;
  let failed = false;
  let firstUserMessage: string | undefined;
  let runStarted = false;

  const addEvent = (
    type: EventType,
    data: Record<string, unknown>,
    extras: { label?: string; status?: "ok" | "error" | "pending" } = {}
  ) => {
    const timestamp = startedAt + sequence * 1000;
    if (!runStarted) {
      startedAt = timestamp;
      runStarted = true;
      events.push({
        sequence: sequence++,
        timestamp: startedAt,
        type: "run.started",
        data: {
          prompt: typeof data.content === "string" ? data.content : firstUserMessage,
          source: "cursor",
        },
      });
    }

    completedAt = timestamp;
    events.push({
      sequence: sequence++,
      timestamp,
      type,
      label: extras.label,
      data,
      status: extras.status,
    });
  };

  for (const line of lines) {
    const record = JSON.parse(line) as LocalTranscriptLine;

    if (record.type === "turn_ended") {
      if (record.status === "error" || record.status === "failed") failed = true;
      continue;
    }

    if (record.role === "user") {
      const text = extractTextFromLocalContent(record) ?? record.text;
      if (text) {
        if (!firstUserMessage) firstUserMessage = text;
        addEvent("user.message", { content: text }, { label: "User Message" });
      }
      continue;
    }

    if (record.role === "assistant") {
      for (const block of record.message?.content ?? []) {
        const type = block.type ?? "";
        if (type === "thinking" && block.thinking) {
          addEvent("agent.thought", { content: block.thinking });
        } else if (type === "text" && block.text) {
          addEvent("llm.response", { content: block.text });
        } else if (isToolUseBlock(type) && block.name) {
          addEvent(
            mapToolCallType(block.name),
            buildToolCallData(block.name, block.input),
            { label: formatToolLabel(block.name) }
          );
        }
      }
    }
  }

  if (events.length === 0) {
    throw new Error("Cursor local transcript contains no importable events");
  }

  events.push({
    sequence: events.length,
    timestamp: (completedAt ?? startedAt) + 1,
    type: failed ? "run.failed" : "run.completed",
    data: {
      summary: failed
        ? "Imported Cursor run ended with errors"
        : `Imported Cursor run with ${events.length} events`,
    },
  });

  const name = options.name ?? deriveRunName(firstUserMessage, options.metadata?.sourcePath as string);

  return {
    run: {
      name,
      status: (failed ? "failed" : "completed") as RunStatus,
      source: "cursor",
      model: options.model,
      startedAt,
      completedAt,
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalCostUsd: 0,
      totalLatencyMs: 0,
      metadata: {
        importer: "agent-trace",
        cursorFormat: "local-jsonl",
        ...options.metadata,
      },
    },
    events,
  };
}

export function parseCursorTranscriptFile(
  content: string,
  filePath: string,
  options: CursorImportOptions = {}
): ParsedCursorTranscript {
  const metadata = { ...options.metadata, sourcePath: filePath };

  if (filePath.endsWith(".jsonl")) {
    return parseCursorLocalTranscript(content, { ...options, metadata });
  }

  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as CloudTranscript;
    if (Array.isArray(parsed.messages)) {
      return parseCursorCloudTranscript(parsed, { ...options, metadata });
    }
  }

  if (trimmed.startsWith("[")) {
    return parseCursorCloudTranscript({ messages: JSON.parse(trimmed) }, { ...options, metadata });
  }

  throw new Error(`Unsupported Cursor transcript format: ${filePath}`);
}

function handleToolMessage(
  message: CloudTranscriptMessage,
  addEvent: (
    type: EventType,
    data: Record<string, unknown>,
    extras?: {
      timestamp?: number;
      label?: string;
      latencyMs?: number;
      status?: "ok" | "error" | "pending";
    }
  ) => void
) {
  const toolName = message.tool_name ?? "unknown";
  const eventType = mapToolResultType(toolName);
  const data = buildToolResultData(toolName, message.tool_args, message.tool_result);
  const status = isToolError(message) ? "error" : "ok";

  addEvent(eventType, data, {
    label: formatToolLabel(toolName),
    timestamp: message.started_at_ms,
    latencyMs: message.duration_ms,
    status,
  });
}

function mapToolCallType(toolName: string): EventType {
  if (FILE_EDIT_TOOLS.has(toolName)) return "file.edit";
  if (SHELL_TOOLS.has(toolName)) return "shell.command";
  return "tool.call";
}

function mapToolResultType(toolName: string): EventType {
  if (FILE_EDIT_TOOLS.has(toolName)) return "file.edit";
  if (SHELL_TOOLS.has(toolName)) return "tool.result";
  return "tool.result";
}

function buildToolCallData(
  toolName: string,
  toolArgs: Record<string, unknown> | undefined,
  call?: { tool_call_id?: string }
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    tool: toolName,
    toolCallId: call?.tool_call_id,
  };

  if (toolArgs) Object.assign(data, summarizeToolArgs(toolName, toolArgs));
  return data;
}

function buildToolResultData(
  toolName: string,
  toolArgs: Record<string, unknown> | undefined,
  toolResult: CloudTranscriptMessage["tool_result"]
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    tool: toolName,
    ...summarizeToolArgs(toolName, toolArgs),
    ...summarizeToolResult(toolName, toolResult),
  };

  if (FILE_EDIT_TOOLS.has(toolName)) {
    const diff = extractDiff(toolResult);
    if (diff) data.diff = diff;
  }

  if (SHELL_TOOLS.has(toolName)) {
    data.command = toolArgs?.command;
  }

  return data;
}

function summarizeToolArgs(toolName: string, toolArgs?: Record<string, unknown>) {
  if (!toolArgs) return {};

  const path =
    toolArgs.target_file ??
    toolArgs.file_path ??
    toolArgs.path ??
    toolArgs.relative_workspace_path;

  if (path) return { path: String(path) };
  if (toolName === "run_terminal_cmd" && toolArgs.command) {
    return { command: String(toolArgs.command) };
  }
  if (toolArgs.glob_pattern) return { pattern: String(toolArgs.glob_pattern) };
  if (toolArgs.query) return { query: String(toolArgs.query) };

  return { args: toolArgs };
}

function summarizeToolResult(
  toolName: string,
  toolResult?: CloudTranscriptMessage["tool_result"]
): Record<string, unknown> {
  if (!toolResult) return {};

  if (toolResult.error) {
    return { message: stringify(toolResult.error), error: toolResult.error };
  }

  const value = toolResult.value as Record<string, unknown> | undefined;
  if (!value) return { resultType: toolResult.resultType };

  switch (toolResult.resultType) {
    case "readFileResult":
      return {
        content: truncate(String(value.contents ?? ""), 4000),
        totalLines: value.totalLines,
      };
    case "runTerminalCommandV2Result":
      return {
        stdout: truncate(String(value.output ?? ""), 4000),
        exitCode: value.exitCode,
      };
    case "globFileSearchResult": {
      const directories = value.directories as Array<{ totalFiles?: number; files?: unknown[] }> | undefined;
      const totalFiles = directories?.[0]?.totalFiles ?? directories?.[0]?.files?.length;
      return { matches: totalFiles, resultType: toolResult.resultType };
    }
    case "webSearchResult": {
      const references = value.references as Array<{ title?: string }> | undefined;
      return {
        title: references?.[0]?.title ?? "Web search results",
        resultType: toolResult.resultType,
      };
    }
    case "editFileResult":
      return {
        path: extractPathFromEditResult(value),
        description: value.isApplied ? "Applied edit" : "Edit result",
        isApplied: value.isApplied,
      };
    default:
      return {
        resultType: toolResult.resultType,
        summary: truncate(stringify(value), 1000),
      };
  }
}

function extractDiff(toolResult?: CloudTranscriptMessage["tool_result"]): string | undefined {
  const value = toolResult?.value as Record<string, unknown> | undefined;
  const diff = value?.diff as { chunks?: Array<{ diffString?: string }> } | undefined;
  const chunk = diff?.chunks?.[0]?.diffString;
  return chunk ? truncate(chunk, 8000) : undefined;
}

function extractPathFromEditResult(value: Record<string, unknown>): string | undefined {
  const diff = value.diff as { chunks?: Array<{ diffString?: string }> } | undefined;
  const diffString = diff?.chunks?.[0]?.diffString;
  if (!diffString) return undefined;
  const match = diffString.match(/\+\+\+ b\/(.+)/);
  return match?.[1];
}

function extractTextFromLocalContent(record: LocalTranscriptLine): string | undefined {
  for (const block of record.message?.content ?? []) {
    if (block.type === "text" && block.text) return block.text;
  }
  return undefined;
}

function isToolUseBlock(type: string): boolean {
  return ["tool_use", "tool-use", "tool_call", "tool-call"].includes(type);
}

function isToolError(message: CloudTranscriptMessage): boolean {
  if (message.tool_result?.error) return true;
  const value = message.tool_result?.value as { exitCode?: number; applyFailed?: boolean } | undefined;
  if (value?.exitCode != null && value.exitCode !== 0) return true;
  if (value?.applyFailed) return true;
  return false;
}

function deriveRunName(firstUserMessage?: string, sourcePath?: string): string {
  if (firstUserMessage) {
    const singleLine = firstUserMessage.replace(/\s+/g, " ").trim();
    return truncate(singleLine, 72);
  }
  if (sourcePath) {
    return basename(sourcePath).replace(/\.(jsonl|json)$/i, "");
  }
  return "Cursor Agent Run";
}

function formatToolLabel(toolName: string): string {
  return toolName.replace(/_/g, " ");
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function loadCursorIndexMetadata(_indexPath: string, content: string): {
  name?: string;
  model?: string;
  startedAt?: number;
  updatedAt?: number;
  id?: string;
} {
  try {
    const index = JSON.parse(content) as {
      agents?: Array<{
        bcId?: string;
        name?: string;
        originalModelName?: string;
        createdAtMs?: number;
        updatedAtMs?: number;
      }>;
    };

    const agent = index.agents?.[0];
    if (!agent) return {};

    return {
      id: agent.bcId,
      name: agent.name,
      model: agent.originalModelName,
      startedAt: agent.createdAtMs,
      updatedAt: agent.updatedAtMs,
    };
  } catch {
    return {};
  }
}
