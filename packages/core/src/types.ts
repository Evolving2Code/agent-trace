import { z } from "zod";

export const EventTypeSchema = z.enum([
  "run.started",
  "run.completed",
  "run.failed",
  "agent.thought",
  "llm.request",
  "llm.response",
  "tool.call",
  "tool.result",
  "file.edit",
  "shell.command",
  "checkpoint",
  "fork.created",
  "user.message",
  "error",
]);

export type EventType = z.infer<typeof EventTypeSchema>;

export const RunStatusSchema = z.enum(["running", "completed", "failed", "forked"]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const TraceEventSchema = z.object({
  id: z.string(),
  runId: z.string(),
  sequence: z.number().int().nonnegative(),
  timestamp: z.number(),
  type: EventTypeSchema,
  agentId: z.string().optional(),
  parentEventId: z.string().optional(),
  label: z.string().optional(),
  data: z.record(z.unknown()),
  tokensIn: z.number().optional(),
  tokensOut: z.number().optional(),
  costUsd: z.number().optional(),
  latencyMs: z.number().optional(),
  status: z.enum(["ok", "error", "pending"]).optional(),
});

export type TraceEvent = z.infer<typeof TraceEventSchema>;

export const RunSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: RunStatusSchema,
  source: z.string().optional(),
  model: z.string().optional(),
  parentRunId: z.string().optional(),
  forkFromEventId: z.string().optional(),
  forkFromSequence: z.number().optional(),
  startedAt: z.number(),
  completedAt: z.number().optional(),
  totalTokensIn: z.number().default(0),
  totalTokensOut: z.number().default(0),
  totalCostUsd: z.number().default(0),
  totalLatencyMs: z.number().default(0),
  metadata: z.record(z.unknown()).default({}),
});

export type Run = z.infer<typeof RunSchema>;

export const RunSummarySchema = RunSchema.pick({
  id: true,
  name: true,
  status: true,
  source: true,
  model: true,
  startedAt: true,
  completedAt: true,
  totalTokensIn: true,
  totalTokensOut: true,
  totalCostUsd: true,
  totalLatencyMs: true,
}).extend({
  eventCount: z.number(),
});

export type RunSummary = z.infer<typeof RunSummarySchema>;

export const ReplayStateSchema = z.object({
  runId: z.string(),
  currentSequence: z.number(),
  totalEvents: z.number(),
  isPlaying: z.boolean(),
  playbackSpeed: z.number(),
});

export type ReplayState = z.infer<typeof ReplayStateSchema>;

export interface ForkOptions {
  fromEventId: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

export const EVENT_COLORS: Record<EventType, string> = {
  "run.started": "#22d3ee",
  "run.completed": "#34d399",
  "run.failed": "#f87171",
  "agent.thought": "#a78bfa",
  "llm.request": "#38bdf8",
  "llm.response": "#60a5fa",
  "tool.call": "#fbbf24",
  "tool.result": "#f59e0b",
  "file.edit": "#4ade80",
  "shell.command": "#fb923c",
  checkpoint: "#94a3b8",
  "fork.created": "#e879f9",
  "user.message": "#f472b6",
  error: "#ef4444",
};

export const EVENT_LABELS: Record<EventType, string> = {
  "run.started": "Run Started",
  "run.completed": "Run Completed",
  "run.failed": "Run Failed",
  "agent.thought": "Thought",
  "llm.request": "LLM Request",
  "llm.response": "LLM Response",
  "tool.call": "Tool Call",
  "tool.result": "Tool Result",
  "file.edit": "File Edit",
  "shell.command": "Shell Command",
  checkpoint: "Checkpoint",
  "fork.created": "Fork Created",
  "user.message": "User Message",
  error: "Error",
};
