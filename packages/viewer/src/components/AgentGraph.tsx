import { motion } from "framer-motion";
import type { TraceEvent } from "@agent-trace/core/browser";

interface AgentGraphProps {
  events: TraceEvent[];
  visibleEvents: TraceEvent[];
  currentSequence: number;
  getEventColor: (type: TraceEvent["type"]) => string;
}

const NODE_TYPES = ["user.message", "agent.thought", "tool.call", "llm.request", "file.edit", "shell.command", "error"] as const;

export function AgentGraph({ events, visibleEvents, currentSequence, getEventColor }: AgentGraphProps) {
  const visibleSet = new Set(visibleEvents.map((e) => e.sequence));
  const nodes = events
    .filter((e) => NODE_TYPES.includes(e.type as (typeof NODE_TYPES)[number]))
    .slice(0, 20);

  if (nodes.length === 0) return null;

  return (
    <div className="w-64 border-l border-white/5 bg-surface-1 flex flex-col">
      <div className="px-4 py-3 border-b border-white/5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Agent Flow</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col items-center gap-1">
          {nodes.map((event, i) => {
            const isVisible = visibleSet.has(event.sequence);
            const isCurrent = event.sequence === currentSequence;
            const color = getEventColor(event.type);

            return (
              <div key={event.id} className="flex flex-col items-center">
                <motion.div
                  initial={false}
                  animate={{
                    opacity: isVisible ? 1 : 0.2,
                    scale: isCurrent ? 1.15 : 1,
                  }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center border"
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
                    className="w-px h-4 transition-colors"
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
    <span className="text-sm" style={{ color }}>
      {icons[type] ?? "•"}
    </span>
  );
}
