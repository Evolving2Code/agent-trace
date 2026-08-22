import { motion } from "framer-motion";
import type { Run } from "@agent-trace/core/browser";
import { formatCost, formatDuration, formatTokens } from "@agent-trace/core/browser";

interface HeaderProps {
  run: Run;
  cumulativeCost: number;
  cumulativeTokens: { in: number; out: number };
  isPlaying: boolean;
  currentStep: number;
  totalSteps: number;
}

export function Header({
  run,
  cumulativeCost,
  cumulativeTokens,
  isPlaying,
  currentStep,
  totalSteps,
}: HeaderProps) {
  const statusColors = {
    completed: "text-success bg-success/10 border-success/20",
    failed: "text-danger bg-danger/10 border-danger/20",
    running: "text-warning bg-warning/10 border-warning/20",
    forked: "text-purple bg-purple/10 border-purple/20",
  };

  return (
    <header className="glass shrink-0 border-b border-white/5">
      <div className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:px-6">
        <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={`mt-1 h-2 w-2 shrink-0 rounded-full sm:mt-0 ${
                isPlaying ? "bg-accent playing-indicator" : "bg-accent"
              }`}
            />
            <div className="min-w-0">
              <h1 className="text-base font-semibold gradient-text sm:text-lg">agent-trace</h1>
              <p className="truncate text-sm font-medium text-zinc-200">{run.name}</p>
            </div>
          </div>

          <div className="hidden h-5 w-px bg-white/10 sm:block" />

          <div className="hidden min-w-0 sm:block">
            <div className="text-xs text-zinc-500 flex items-center gap-2">
              {run.source && <span className="capitalize">{run.source}</span>}
              {run.model && (
                <>
                  <span>·</span>
                  <span className="truncate">{run.model}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 lg:justify-end">
          <div className="flex flex-wrap gap-3 sm:gap-4">
            <Stat label="Step" value={`${currentStep}/${totalSteps}`} className="md:hidden" />
            <Stat label="Tokens" value={formatTokens(cumulativeTokens.in + cumulativeTokens.out)} />
            <Stat label="Cost" value={formatCost(cumulativeCost)} accent />
            <Stat label="Latency" value={formatDuration(run.totalLatencyMs)} className="hidden sm:block" />
          </div>
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${statusColors[run.status]}`}
          >
            {run.status}
          </span>
        </div>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  accent,
  className = "",
}: {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={`text-left sm:text-right ${className}`}>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <motion.div
        key={value}
        initial={{ opacity: 0.5, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`text-sm font-mono font-medium ${accent ? "text-accent" : "text-zinc-300"}`}
      >
        {value}
      </motion.div>
    </div>
  );
}
