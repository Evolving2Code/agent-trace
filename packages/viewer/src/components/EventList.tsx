import { motion } from "framer-motion";
import type { TraceEvent } from "@agent-trace/core/browser";

interface EventListProps {
  events: TraceEvent[];
  visibleEvents: TraceEvent[];
  currentSequence: number;
  getEventColor: (type: TraceEvent["type"]) => string;
  getEventLabel: (type: TraceEvent["type"]) => string;
  onSelect: (sequence: number) => void;
  className?: string;
}

export function EventList({
  events,
  visibleEvents,
  currentSequence,
  getEventColor,
  getEventLabel,
  onSelect,
  className = "",
}: EventListProps) {
  const visibleSet = new Set(visibleEvents.map((e) => e.sequence));

  return (
    <aside className={`md:border-r border-white/5 flex flex-col bg-surface-1 min-h-0 ${className}`}>
      <div className="px-4 py-3 border-b border-white/5 shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Timeline</h2>
        <p className="text-xs text-zinc-600 mt-0.5">{events.length} events</p>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {events.map((event) => {
          const isVisible = visibleSet.has(event.sequence);
          const isCurrent = event.sequence === currentSequence;
          const color = getEventColor(event.type);

          return (
            <button
              key={event.id}
              type="button"
              onClick={() => onSelect(event.sequence)}
              className={`w-full text-left px-4 py-3 sm:py-2.5 border-b border-white/[0.03] transition-all touch-manipulation ${
                isCurrent
                  ? "bg-accent/5 border-l-2 border-l-accent"
                  : isVisible
                    ? "opacity-100 hover:bg-white/[0.03] active:bg-white/[0.05]"
                    : "opacity-30 hover:opacity-50"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs font-mono text-zinc-500 w-5 shrink-0">{event.sequence}</span>
                <span className="text-xs sm:text-sm font-medium text-zinc-300 truncate">
                  {event.label ?? getEventLabel(event.type)}
                </span>
                {event.status === "error" && (
                  <span className="text-[10px] text-danger ml-auto shrink-0">ERR</span>
                )}
              </div>
              {isVisible && event.data && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="text-[11px] text-zinc-500 mt-1 ml-8 truncate font-mono"
                >
                  {summarizeEvent(event)}
                </motion.p>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function summarizeEvent(event: TraceEvent): string {
  const d = event.data;
  if (typeof d.content === "string") return d.content.slice(0, 80);
  if (typeof d.tool === "string") return `${d.tool}${d.path ? ` → ${d.path}` : ""}`;
  if (typeof d.command === "string") return `$ ${d.command}`;
  if (typeof d.path === "string") return d.path;
  if (typeof d.summary === "string") return d.summary;
  if (typeof d.message === "string") return d.message;
  return event.type;
}
