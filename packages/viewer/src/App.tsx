import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Header } from "./components/Header";
import { EventList } from "./components/EventList";
import { EventDetail } from "./components/EventDetail";
import { Timeline } from "./components/Timeline";
import { Controls } from "./components/Controls";
import { AgentGraph } from "./components/AgentGraph";
import { MobileTabBar, type MobilePanel } from "./components/MobileTabBar";
import { useReplay } from "./hooks/useReplay";
import { useMediaQuery } from "./hooks/useMediaQuery";
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
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("detail");

  const handleSelectEvent = (sequence: number) => {
    replay.seek(sequence);
    if (!isDesktop) setMobilePanel("detail");
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
    <div className="app-shell flex flex-col bg-surface-0">
      <Header
        run={data.run}
        cumulativeCost={replay.cumulativeCost}
        cumulativeTokens={replay.cumulativeTokens}
        isPlaying={replay.state.isPlaying}
        currentStep={replay.state.currentSequence}
        totalSteps={replay.state.totalEvents - 1}
      />

      <div className="flex-1 flex overflow-hidden min-h-0">
        <EventList
          events={data.events}
          visibleEvents={replay.visibleEvents}
          currentSequence={replay.state.currentSequence}
          getEventColor={replay.getEventColor}
          getEventLabel={replay.getEventLabel}
          onSelect={handleSelectEvent}
          className="hidden md:flex md:w-64 lg:w-72 shrink-0"
        />

        <EventList
          events={data.events}
          visibleEvents={replay.visibleEvents}
          currentSequence={replay.state.currentSequence}
          getEventColor={replay.getEventColor}
          getEventLabel={replay.getEventLabel}
          onSelect={handleSelectEvent}
          className={`md:hidden flex-1 min-w-0 ${mobilePanel === "timeline" ? "flex" : "hidden"}`}
        />

        <EventDetail
          event={replay.currentEvent}
          getEventColor={replay.getEventColor}
          getEventLabel={replay.getEventLabel}
          className={`min-w-0 ${mobilePanel === "detail" ? "flex" : "hidden md:flex"} flex-1`}
        />

        <AgentGraph
          events={data.events}
          visibleEvents={replay.visibleEvents}
          currentSequence={replay.state.currentSequence}
          getEventColor={replay.getEventColor}
          className={`xl:hidden flex-1 min-w-0 ${mobilePanel === "flow" ? "flex" : "hidden"}`}
        />

        <AgentGraph
          events={data.events}
          visibleEvents={replay.visibleEvents}
          currentSequence={replay.state.currentSequence}
          getEventColor={replay.getEventColor}
          className="hidden xl:flex xl:w-56 2xl:w-64 shrink-0"
        />
      </div>

      <Timeline
        events={data.events}
        currentSequence={replay.state.currentSequence}
        getEventColor={replay.getEventColor}
        onSeek={handleSelectEvent}
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

      <MobileTabBar
        active={mobilePanel}
        onChange={setMobilePanel}
        eventCount={data.events.length}
      />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="app-shell flex flex-col items-center justify-center bg-surface-0 gap-4">
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
    <div className="app-shell flex flex-col items-center justify-center bg-surface-0 gap-4 px-6 text-center">
      <p className="text-danger text-sm">{message}</p>
      <p className="text-zinc-600 text-xs">Run: agent-trace demo && agent-trace play</p>
    </div>
  );
}
