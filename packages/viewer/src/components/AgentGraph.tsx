import { motion } from "framer-motion";
import type { TraceEvent } from "@agent-trace/core/browser";

interface AgentGraphProps {
  events: TraceEvent[];
  visibleEvents: TraceEvent[];
  currentSequence: number;
  getEventColor: (type: TraceEvent["type"]) => string;
  className?: string;
}

const NODE_TYPES = [
  "user.message",
  "agent.thought",
  "tool.call",
  "llm.request",
  "file.edit",
  "shell.command",
  "error",
] as const;

export function AgentGraph({
  events,
  visibleEvents,
  currentSequence,
  getEventColor,
  className = "",
}: AgentGraphProps) {
  const visibleSet = new Set(visibleEvents.map((e) => e.sequence));
  const nodes = events
    .filter((e) => NODE_TYPES.includes(e.type as (typeof NODE_TYPES)[number]))
    .slice(0, 20);

  if (nodes.length === 0) return null;

  return (
    <div className={`md:border-l border-white/5 bg-surface-1 flex flex-col min-h-0 ${className}`}>
      <div className="px-4 py-3 border-b border-white/5 shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Agent Flow</h2>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
        <div className="flex flex-col items-center gap-1 max-w-sm mx-auto">
          {nodes.map((event, i) => {
            const isVisible = visibleSet.has(event.sequence);
            const isCurrent = event.sequence === currentSequence;
            const color = getEventColor(event.type);

            return (
              <div key={event.id} className="flex flex-col items-center w-full">
                <motion.div
                  initial={false}
                  animate={{
                    opacity: isVisible ? 1 : 0.2,
                    scale: isCurrent ? 1.12 : 1,
                  }}
                  className="w-11 h-11 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border touch-manipulation"
                  style={{
                    backgroundColor: `${color}15`,
                    borderColor: isCurrent ? color : `${color}30`,
                    boxShadow: isCurrent ? `0 0 16px ${color}40` : "none",
                  }}
                >
                  <NodeIcon type={event.type} color={color} />
                </motion.div>
                {i < nodes.length - 1 && (
                  <div
                    className="w-px h-4 sm:h-5 transition-colors"
                    style={{ backgroundColor: isVisible ? `${color}40` : "#333" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NodeIcon({ type, color }: { type: TraceEvent["type"]; color: string }) {
  const icons: Partial<Record<TraceEvent["type"], string>> = {
    "user.message": "💬",
    "agent.thought": "🧠",
    "tool.call": "🔧",
    "llm.request": "✨",
    "file.edit": "📝",
    "shell.command": "⚡",
    error: "❌",
  };

  return (
    <span className="text-base sm:text-sm" style={{ color }}>
      {icons[type] ?? "•"}
    </span>
  );
}
