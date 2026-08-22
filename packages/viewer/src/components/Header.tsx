import { motion } from "framer-motion";
import type { Run } from "@agent-trace/core/browser";
import { formatCost, formatDuration, formatTokens } from "@agent-trace/core/browser";

interface HeaderProps {
  run: Run;
  cumulativeCost: number;
  cumulativeTokens: { in: number; out: number };
  isPlaying: boolean;
}

export function Header({ run, cumulativeCost, cumulativeTokens, isPlaying }: HeaderProps) {
  const statusColors = {
    completed: "text-success bg-success/10 border-success/20",
    failed: "text-danger bg-danger/10 border-danger/20",
    running: "text-warning bg-warning/10 border-warning/20",
    forked: "text-purple bg-purple/10 border-purple/20",
  };

  return (
    <header className="glass flex items-center justify-between px-6 py-3 border-b border-white/5">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isPlaying ? "bg-accent playing-indicator" : "bg-accent"}`} />
          <h1 className="text-lg font-semibold gradient-text">agent-trace</h1>
        </div>
        <div className="h-5 w-px bg-white/10" />
        <div>
          <div className="text-sm font-medium text-zinc-200">{run.name}</div>
          <div className="text-xs text-zinc-500 flex items-center gap-2">
            {run.source && <span className="capitalize">{run.source}</span>}
            {run.model && (
              <>
                <span>·</span>
                <span>{run.model}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <Stat label="Tokens" value={`${formatTokens(cumulativeTokens.in + cumulativeTokens.out)}`} />
        <Stat label="Cost" value={formatCost(cumulativeCost)} accent />
        <Stat label="Latency" value={formatDuration(run.totalLatencyMs)} />
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusColors[run.status]}`}>
          {run.status}
        </span>
      </div>
    </header>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-right">
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
