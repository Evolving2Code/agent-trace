import { useCallback, useEffect, useRef, useState } from "react";
import type { ReplayState, Run, TraceEvent } from "@agent-trace/core/browser";
import {
  ReplayEngine,
  formatCost,
  formatDuration,
  formatTokens,
  getEventColor,
  getEventLabel,
} from "@agent-trace/core/browser";

export function useReplay(run: Run, events: TraceEvent[]) {
  const engineRef = useRef<ReplayEngine | null>(null);
  const [state, setState] = useState<ReplayState>({
    runId: run.id,
    currentSequence: 0,
    totalEvents: events.length,
    isPlaying: false,
    playbackSpeed: 1,
  });
  const [currentEvent, setCurrentEvent] = useState<TraceEvent | null>(events[0] ?? null);
  const [visibleEvents, setVisibleEvents] = useState<TraceEvent[]>(events.length ? [events[0]] : []);

  useEffect(() => {
    const engine = new ReplayEngine(run, events);
    engineRef.current = engine;

    const unsub = engine.subscribe((s, e) => {
      setState(s);
      setCurrentEvent(e);
      setVisibleEvents(engine.visibleEvents);
    });

    return () => {
      unsub();
      engine.destroy();
    };
  }, [run, events]);

  const seek = useCallback((seq: number) => engineRef.current?.seek(seq), []);
  const play = useCallback((speed?: number) => engineRef.current?.play(speed), []);
  const pause = useCallback(() => engineRef.current?.pause(), []);
  const stepForward = useCallback(() => engineRef.current?.stepForward(), []);
  const stepBackward = useCallback(() => engineRef.current?.stepBackward(), []);
  const setSpeed = useCallback((speed: number) => engineRef.current?.setSpeed(speed), []);

  const cumulativeCost = visibleEvents.reduce((s, e) => s + (e.costUsd ?? 0), 0);
  const cumulativeTokens = visibleEvents.reduce(
    (acc, e) => ({ in: acc.in + (e.tokensIn ?? 0), out: acc.out + (e.tokensOut ?? 0) }),
    { in: 0, out: 0 }
  );

  return {
    state,
    currentEvent,
    visibleEvents,
    cumulativeCost,
    cumulativeTokens,
    seek,
    play,
    pause,
    stepForward,
    stepBackward,
    setSpeed,
    formatCost,
    formatDuration,
    formatTokens,
    getEventColor,
    getEventLabel,
  };
}
