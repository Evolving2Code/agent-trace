import type { ReplayState, Run, TraceEvent } from "./types.js";
import { EVENT_COLORS, EVENT_LABELS } from "./types.js";

export class ReplayEngine {
  private events: TraceEvent[];
  private currentSequence = 0;
  private isPlaying = false;
  private playbackSpeed = 1;
  private playTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(state: ReplayState, event: TraceEvent | null) => void>();

  constructor(
    public readonly run: Run,
    events: TraceEvent[]
  ) {
    this.events = [...events].sort((a, b) => a.sequence - b.sequence);
  }

  get state(): ReplayState {
    return {
      runId: this.run.id,
      currentSequence: this.currentSequence,
      totalEvents: this.events.length,
      isPlaying: this.isPlaying,
      playbackSpeed: this.playbackSpeed,
    };
  }

  get currentEvent(): TraceEvent | null {
    return this.events.find((e) => e.sequence === this.currentSequence) ?? null;
  }

  get allEvents(): TraceEvent[] {
    return this.events;
  }

  get visibleEvents(): TraceEvent[] {
    return this.events.filter((e) => e.sequence <= this.currentSequence);
  }

  get cumulativeCost(): number {
    return this.visibleEvents.reduce((sum, e) => sum + (e.costUsd ?? 0), 0);
  }

  get cumulativeTokens(): { in: number; out: number } {
    return this.visibleEvents.reduce(
      (acc, e) => ({
        in: acc.in + (e.tokensIn ?? 0),
        out: acc.out + (e.tokensOut ?? 0),
      }),
      { in: 0, out: 0 }
    );
  }

  subscribe(listener: (state: ReplayState, event: TraceEvent | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.state, this.currentEvent);
    return () => this.listeners.delete(listener);
  }

  seek(sequence: number): void {
    this.currentSequence = Math.max(0, Math.min(sequence, this.events.length - 1));
    this.notify();
  }

  stepForward(): void {
    if (this.currentSequence < this.events.length - 1) {
      this.currentSequence++;
      this.notify();
    } else {
      this.pause();
    }
  }

  stepBackward(): void {
    if (this.currentSequence > 0) {
      this.currentSequence--;
      this.notify();
    }
  }

  play(speed = 1): void {
    this.playbackSpeed = speed;
    this.isPlaying = true;
    this.pauseTimer();
    const intervalMs = Math.max(50, 800 / speed);
    this.playTimer = setInterval(() => {
      if (this.currentSequence >= this.events.length - 1) {
        this.pause();
        return;
      }
      this.stepForward();
    }, intervalMs);
    this.notify();
  }

  pause(): void {
    this.isPlaying = false;
    this.pauseTimer();
    this.notify();
  }

  setSpeed(speed: number): void {
    if (this.isPlaying) {
      this.play(this.playbackSpeed);
    } else {
      this.playbackSpeed = speed;
      this.notify();
    }
  }

  destroy(): void {
    this.pause();
    this.listeners.clear();
  }

  private pauseTimer(): void {
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }
  }

  private notify(): void {
    const state = this.state;
    const event = this.currentEvent;
    for (const listener of this.listeners) {
      listener(state, event);
    }
  }
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

export function getEventColor(type: TraceEvent["type"]): string {
  return EVENT_COLORS[type];
}

export function getEventLabel(type: TraceEvent["type"]): string {
  return EVENT_LABELS[type];
}

export function diffRuns(
  eventsA: TraceEvent[],
  eventsB: TraceEvent[]
): Array<{
  sequence: number;
  type: "same" | "changed" | "added" | "removed";
  eventA?: TraceEvent;
  eventB?: TraceEvent;
}> {
  const maxLen = Math.max(eventsA.length, eventsB.length);
  const diffs: Array<{
    sequence: number;
    type: "same" | "changed" | "added" | "removed";
    eventA?: TraceEvent;
    eventB?: TraceEvent;
  }> = [];

  for (let i = 0; i < maxLen; i++) {
    const a = eventsA[i];
    const b = eventsB[i];
    if (!a && b) {
      diffs.push({ sequence: i, type: "added", eventB: b });
    } else if (a && !b) {
      diffs.push({ sequence: i, type: "removed", eventA: a });
    } else if (a && b) {
      const same =
        a.type === b.type &&
        JSON.stringify(a.data) === JSON.stringify(b.data) &&
        a.status === b.status;
      diffs.push({
        sequence: i,
        type: same ? "same" : "changed",
        eventA: a,
        eventB: b,
      });
    }
  }

  return diffs;
}
