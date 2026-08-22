import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { nanoid } from "nanoid";
import type { ForkOptions, Run, RunSummary, TraceEvent } from "./types.js";
import { RunSchema, TraceEventSchema } from "./types.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  source TEXT,
  model TEXT,
  parent_run_id TEXT,
  fork_from_event_id TEXT,
  fork_from_sequence INTEGER,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  total_tokens_in INTEGER NOT NULL DEFAULT 0,
  total_tokens_out INTEGER NOT NULL DEFAULT 0,
  total_cost_usd REAL NOT NULL DEFAULT 0,
  total_latency_ms INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  type TEXT NOT NULL,
  agent_id TEXT,
  parent_event_id TEXT,
  label TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd REAL,
  latency_ms INTEGER,
  status TEXT,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE,
  UNIQUE(run_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id);
CREATE INDEX IF NOT EXISTS idx_events_sequence ON events(run_id, sequence);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at DESC);
`;

export class TraceStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  createRun(input: {
    name: string;
    source?: string;
    model?: string;
    metadata?: Record<string, unknown>;
    parentRunId?: string;
    forkFromEventId?: string;
    forkFromSequence?: number;
  }): Run {
    const id = nanoid(12);
    const startedAt = Date.now();
    const metadata = JSON.stringify(input.metadata ?? {});

    this.db
      .prepare(
        `INSERT INTO runs (id, name, status, source, model, parent_run_id, fork_from_event_id, fork_from_sequence, started_at, metadata)
         VALUES (?, ?, 'running', ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.source ?? null,
        input.model ?? null,
        input.parentRunId ?? null,
        input.forkFromEventId ?? null,
        input.forkFromSequence ?? null,
        startedAt,
        metadata
      );

    return this.getRun(id)!;
  }

  appendEvent(
    runId: string,
    event: Omit<TraceEvent, "id" | "runId" | "sequence"> & { sequence?: number }
  ): TraceEvent {
    const id = nanoid(12);
    const sequence =
      event.sequence ??
      ((
        this.db
          .prepare("SELECT COALESCE(MAX(sequence), -1) + 1 as next FROM events WHERE run_id = ?")
          .get(runId) as { next: number }
      ).next);

    const record: TraceEvent = TraceEventSchema.parse({
      id,
      runId,
      sequence,
      ...event,
    });

    this.db
      .prepare(
        `INSERT INTO events (id, run_id, sequence, timestamp, type, agent_id, parent_event_id, label, data, tokens_in, tokens_out, cost_usd, latency_ms, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.id,
        record.runId,
        record.sequence,
        record.timestamp,
        record.type,
        record.agentId ?? null,
        record.parentEventId ?? null,
        record.label ?? null,
        JSON.stringify(record.data),
        record.tokensIn ?? null,
        record.tokensOut ?? null,
        record.costUsd ?? null,
        record.latencyMs ?? null,
        record.status ?? null
      );

    if (record.tokensIn || record.tokensOut || record.costUsd || record.latencyMs) {
      this.db
        .prepare(
          `UPDATE runs SET
            total_tokens_in = total_tokens_in + ?,
            total_tokens_out = total_tokens_out + ?,
            total_cost_usd = total_cost_usd + ?,
            total_latency_ms = total_latency_ms + ?
           WHERE id = ?`
        )
        .run(
          record.tokensIn ?? 0,
          record.tokensOut ?? 0,
          record.costUsd ?? 0,
          record.latencyMs ?? 0,
          runId
        );
    }

    return record;
  }

  completeRun(runId: string, status: "completed" | "failed" = "completed"): Run {
    this.db
      .prepare("UPDATE runs SET status = ?, completed_at = ? WHERE id = ?")
      .run(status, Date.now(), runId);
    return this.getRun(runId)!;
  }

  getRun(runId: string): Run | null {
    const row = this.db.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return this.rowToRun(row);
  }

  listRuns(limit = 50): RunSummary[] {
    const rows = this.db
      .prepare(
        `SELECT r.*, (SELECT COUNT(*) FROM events e WHERE e.run_id = r.id) as event_count
         FROM runs r ORDER BY r.started_at DESC LIMIT ?`
      )
      .all(limit) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      status: row.status as Run["status"],
      source: (row.source as string) ?? undefined,
      model: (row.model as string) ?? undefined,
      startedAt: row.started_at as number,
      completedAt: (row.completed_at as number) ?? undefined,
      totalTokensIn: row.total_tokens_in as number,
      totalTokensOut: row.total_tokens_out as number,
      totalCostUsd: row.total_cost_usd as number,
      totalLatencyMs: row.total_latency_ms as number,
      eventCount: row.event_count as number,
    }));
  }

  getEvents(runId: string): TraceEvent[] {
    const rows = this.db
      .prepare("SELECT * FROM events WHERE run_id = ? ORDER BY sequence ASC")
      .all(runId) as Record<string, unknown>[];
    return rows.map((row) => this.rowToEvent(row));
  }

  getEvent(runId: string, sequence: number): TraceEvent | null {
    const row = this.db
      .prepare("SELECT * FROM events WHERE run_id = ? AND sequence = ?")
      .get(runId, sequence) as Record<string, unknown> | undefined;
    return row ? this.rowToEvent(row) : null;
  }

  getEventById(eventId: string): TraceEvent | null {
    const row = this.db.prepare("SELECT * FROM events WHERE id = ?").get(eventId) as
      | Record<string, unknown>
      | undefined;
    return row ? this.rowToEvent(row) : null;
  }

  forkRun(parentRunId: string, options: ForkOptions): Run {
    const parentRun = this.getRun(parentRunId);
    const forkEvent = this.getEventById(options.fromEventId);
    if (!parentRun || !forkEvent) {
      throw new Error("Parent run or fork event not found");
    }

    const forkedRun = this.createRun({
      name: options.name ?? `${parentRun.name} (fork @ step ${forkEvent.sequence + 1})`,
      source: parentRun.source,
      model: parentRun.model,
      metadata: { ...parentRun.metadata, ...options.metadata, forkedFrom: parentRunId },
      parentRunId,
      forkFromEventId: options.fromEventId,
      forkFromSequence: forkEvent.sequence,
    });

    const parentEvents = this.getEvents(parentRunId).filter(
      (e) => e.sequence <= forkEvent.sequence
    );

    for (const event of parentEvents) {
      this.appendEvent(forkedRun.id, {
        timestamp: event.timestamp,
        type: event.type,
        agentId: event.agentId,
        parentEventId: event.parentEventId,
        label: event.label,
        data: { ...event.data, inherited: true },
        tokensIn: event.tokensIn,
        tokensOut: event.tokensOut,
        costUsd: event.costUsd,
        latencyMs: event.latencyMs,
        status: event.status,
      });
    }

    this.appendEvent(forkedRun.id, {
      timestamp: Date.now(),
      type: "fork.created",
      label: `Forked from ${parentRun.name}`,
      data: {
        parentRunId,
        forkFromEventId: options.fromEventId,
        forkFromSequence: forkEvent.sequence,
      },
      status: "ok",
    });

    return this.getRun(forkedRun.id)!;
  }

  exportRun(runId: string): { run: Run; events: TraceEvent[] } {
    const run = this.getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    return { run, events: this.getEvents(runId) };
  }

  importRun(data: { run: Run; events: TraceEvent[] }): Run {
    const run = this.createRun({
      name: data.run.name,
      source: data.run.source,
      model: data.run.model,
      metadata: data.run.metadata,
    });

    for (const event of data.events) {
      this.appendEvent(run.id, {
        sequence: event.sequence,
        timestamp: event.timestamp,
        type: event.type,
        agentId: event.agentId,
        parentEventId: event.parentEventId,
        label: event.label,
        data: event.data,
        tokensIn: event.tokensIn,
        tokensOut: event.tokensOut,
        costUsd: event.costUsd,
        latencyMs: event.latencyMs,
        status: event.status,
      });
    }

    this.completeRun(run.id, data.run.status === "failed" ? "failed" : "completed");
    return this.getRun(run.id)!;
  }

  private rowToRun(row: Record<string, unknown>): Run {
    return RunSchema.parse({
      id: row.id,
      name: row.name,
      status: row.status,
      source: row.source ?? undefined,
      model: row.model ?? undefined,
      parentRunId: row.parent_run_id ?? undefined,
      forkFromEventId: row.fork_from_event_id ?? undefined,
      forkFromSequence: row.fork_from_sequence ?? undefined,
      startedAt: row.started_at,
      completedAt: row.completed_at ?? undefined,
      totalTokensIn: row.total_tokens_in,
      totalTokensOut: row.total_tokens_out,
      totalCostUsd: row.total_cost_usd,
      totalLatencyMs: row.total_latency_ms,
      metadata: JSON.parse((row.metadata as string) || "{}"),
    });
  }

  private rowToEvent(row: Record<string, unknown>): TraceEvent {
    return TraceEventSchema.parse({
      id: row.id,
      runId: row.run_id,
      sequence: row.sequence,
      timestamp: row.timestamp,
      type: row.type,
      agentId: row.agent_id ?? undefined,
      parentEventId: row.parent_event_id ?? undefined,
      label: row.label ?? undefined,
      data: JSON.parse((row.data as string) || "{}"),
      tokensIn: row.tokens_in ?? undefined,
      tokensOut: row.tokens_out ?? undefined,
      costUsd: row.cost_usd ?? undefined,
      latencyMs: row.latency_ms ?? undefined,
      status: row.status ?? undefined,
    });
  }
}
