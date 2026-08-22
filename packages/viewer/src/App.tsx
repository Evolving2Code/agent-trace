import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Header } from "./components/Header";
import { EventList } from "./components/EventList";
import { EventDetail } from "./components/EventDetail";
import { Timeline } from "./components/Timeline";
import { Controls } from "./components/Controls";
import { AgentGraph } from "./components/AgentGraph";
import { useReplay } from "./hooks/useReplay";
import { loadRunData } from "./lib/loadRun";
import type { RunData } from "./lib/loadRun";

export default function App() {
  const [data, setData] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRunData()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error || !data) return <ErrorScreen message={error ?? "No run data"} />;

  return <ReplayStudio data={data} />;
}

function ReplayStudio({ data }: { data: RunData }) {
  const replay = useReplay(data.run, data.events);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        replay.state.isPlaying ? replay.pause() : replay.play(replay.state.playbackSpeed);
      } else if (e.code === "ArrowRight") {
        replay.stepForward();
      } else if (e.code === "ArrowLeft") {
        replay.stepBackward();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [replay]);

  return (
    <div className="h-screen flex flex-col bg-surface-0">
      <Header
        run={data.run}
        cumulativeCost={replay.cumulativeCost}
        cumulativeTokens={replay.cumulativeTokens}
        isPlaying={replay.state.isPlaying}
      />

      <div className="flex-1 flex overflow-hidden">
        <EventList
          events={data.events}
          visibleEvents={replay.visibleEvents}
          currentSequence={replay.state.currentSequence}
          getEventColor={replay.getEventColor}
          getEventLabel={replay.getEventLabel}
          onSelect={replay.seek}
        />
        <EventDetail
          event={replay.currentEvent}
          getEventColor={replay.getEventColor}
          getEventLabel={replay.getEventLabel}
        />
        <AgentGraph
          events={data.events}
          visibleEvents={replay.visibleEvents}
          currentSequence={replay.state.currentSequence}
          getEventColor={replay.getEventColor}
        />
      </div>

      <Timeline
        events={data.events}
        currentSequence={replay.state.currentSequence}
        getEventColor={replay.getEventColor}
        onSeek={replay.seek}
      />

      <Controls
        isPlaying={replay.state.isPlaying}
        playbackSpeed={replay.state.playbackSpeed}
        currentSequence={replay.state.currentSequence}
        totalEvents={replay.state.totalEvents}
        onPlay={() => replay.play(replay.state.playbackSpeed)}
        onPause={replay.pause}
        onStepForward={replay.stepForward}
        onStepBackward={replay.stepBackward}
        onSetSpeed={replay.setSpeed}
      />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-surface-0 gap-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full"
      />
      <p className="text-zinc-500 text-sm">Loading replay studio...</p>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-surface-0 gap-4">
      <p className="text-danger text-sm">{message}</p>
      <p className="text-zinc-600 text-xs">Run: agent-trace demo && agent-trace play</p>
    </div>
  );
}
