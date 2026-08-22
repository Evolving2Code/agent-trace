import type { EventType, Run, RunStatus, TraceEvent } from "../types.js";

export type CursorTranscriptFormat = "cloud-json" | "local-jsonl";

export interface CursorTranscriptInfo {
  id: string;
  path: string;
  format: CursorTranscriptFormat;
  name: string;
  model?: string;
  startedAt?: number;
  updatedAt?: number;
  messageCount?: number;
  sourcePath: string;
}

export interface CursorImportOptions {
  name?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface ParsedCursorTranscript {
  run: Omit<Run, "id"> & { externalId?: string };
  events: Array<Omit<TraceEvent, "id" | "runId">>;
}

export interface CloudTranscriptMessage {
  role: "user" | "assistant" | "tool";
  text?: string;
  thinking?: string;
  tool_calls?: Array<{
    tool_call_id: string;
    tool_name: string;
    started_at_ms?: number;
    completed_at_ms?: number;
    duration_ms?: number;
  }>;
  tool_call_id?: string;
  tool_name?: string;
  tool_args?: Record<string, unknown>;
  tool_result?: {
    resultType?: string;
    value?: unknown;
    error?: unknown;
  };
  started_at_ms?: number;
  completed_at_ms?: number;
  duration_ms?: number;
}

export interface CloudTranscript {
  messages: CloudTranscriptMessage[];
}

export interface LocalTranscriptLine {
  role?: string;
  type?: string;
  status?: string;
  message?: {
    content?: Array<{
      type?: string;
      text?: string;
      thinking?: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
  };
  text?: string;
}
