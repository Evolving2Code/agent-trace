import { motion, AnimatePresence } from "framer-motion";
import type { TraceEvent } from "@evolving2code/agent-trace-core/browser";
import { formatTimestamp } from "@evolving2code/agent-trace-core/browser";

interface EventDetailProps {
  event: TraceEvent | null;
  getEventColor: (type: TraceEvent["type"]) => string;
  getEventLabel: (type: TraceEvent["type"]) => string;
  className?: string;
}

export function EventDetail({ event, getEventColor, getEventLabel, className = "" }: EventDetailProps) {
  if (!event) {
    return (
      <div className={`flex-1 flex items-center justify-center text-zinc-600 px-6 text-center ${className}`}>
        <p>Select an event to inspect</p>
      </div>
    );
  }

  const color = getEventColor(event.type);

  return (
    <main className={`flex-1 flex flex-col overflow-hidden min-h-0 min-w-0 ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={event.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          className="flex-1 flex flex-col overflow-hidden min-h-0"
        >
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-white/5 flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            <span
              className="px-2.5 py-1 rounded-md text-xs font-semibold shrink-0"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {getEventLabel(event.type)}
            </span>
            <span className="text-xs font-mono text-zinc-500">
              step {event.sequence} · {formatTimestamp(event.timestamp)}
            </span>
            {event.latencyMs != null && (
              <span className="text-xs text-zinc-500">{event.latencyMs}ms</span>
            )}
            {event.costUsd != null && (
              <span className="text-xs text-accent font-mono">${event.costUsd.toFixed(4)}</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
            <EventContent event={event} />
          </div>
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

function EventContent({ event }: { event: TraceEvent }) {
  const d = event.data;

  if (event.type === "agent.thought" && typeof d.content === "string") {
    return (
      <div className="w-full max-w-3xl">
        <h3 className="text-xs uppercase tracking-wider text-purple mb-3 font-semibold">Agent Reasoning</h3>
        <p className="text-zinc-300 leading-relaxed text-sm sm:text-[15px] break-words">{d.content}</p>
      </div>
    );
  }

  if (event.type === "user.message" && typeof d.content === "string") {
    return (
      <div className="w-full max-w-3xl">
        <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-3 font-semibold">User Message</h3>
        <div className="bg-surface-3 rounded-lg p-4 border border-white/5">
          <p className="text-zinc-200 text-sm sm:text-base break-words">{d.content}</p>
        </div>
      </div>
    );
  }

  if ((event.type === "tool.call" || event.type === "tool.result") && d.tool) {
    return (
      <div className="w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-warning font-mono font-semibold text-sm">{String(d.tool)}</span>
          {d.path != null && (
            <span className="text-zinc-400 font-mono text-xs sm:text-sm break-all">→ {String(d.path)}</span>
          )}
        </div>
        {d.content != null && (
          <pre className="bg-surface-2 rounded-lg p-3 sm:p-4 text-xs sm:text-sm font-mono text-zinc-300 overflow-x-auto border border-white/5 whitespace-pre-wrap break-words">
            {String(d.content)}
          </pre>
        )}
        {d.stdout != null && (
          <pre className="bg-surface-2 rounded-lg p-3 sm:p-4 text-xs sm:text-sm font-mono text-success overflow-x-auto border border-white/5 whitespace-pre-wrap break-words">
            {String(d.stdout)}
          </pre>
        )}
        {d.exitCode !== undefined && (
          <span className={`text-sm font-mono ${d.exitCode === 0 ? "text-success" : "text-danger"}`}>
            exit {String(d.exitCode)}
          </span>
        )}
      </div>
    );
  }

  if (event.type === "file.edit") {
    return (
      <div className="w-full max-w-3xl space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="text-success font-mono text-xs sm:text-sm break-all">{String(d.path)}</span>
          {d.description != null && (
            <span className="text-zinc-500 text-xs sm:text-sm">— {String(d.description)}</span>
          )}
        </div>
        {d.diff != null && (
          <pre className="bg-surface-2 rounded-lg p-3 sm:p-4 text-xs sm:text-sm font-mono overflow-x-auto border border-white/5">
            {String(d.diff)
              .split("\n")
              .map((line, i) => (
                <div
                  key={i}
                  className={`whitespace-pre-wrap break-all ${
                    line.startsWith("+")
                      ? "text-success"
                      : line.startsWith("-")
                        ? "text-danger"
                        : "text-zinc-400"
                  }`}
                >
                  {line}
                </div>
              ))}
          </pre>
        )}
      </div>
    );
  }

  if (event.type === "shell.command") {
    return (
      <div className="w-full max-w-3xl">
        <pre className="bg-surface-2 rounded-lg p-3 sm:p-4 text-xs sm:text-sm font-mono text-warning border border-white/5 whitespace-pre-wrap break-all">
          $ {String(d.command)}
        </pre>
      </div>
    );
  }

  if (event.type === "error") {
    return (
      <div className="w-full max-w-3xl">
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-4">
          <p className="text-danger font-mono text-xs sm:text-sm break-words">{String(d.message)}</p>
          {d.attempt != null && (
            <p className="text-zinc-500 text-xs mt-2">Attempt {String(d.attempt)}</p>
          )}
        </div>
      </div>
    );
  }

  if (event.type === "llm.request" || event.type === "llm.response") {
    return (
      <div className="w-full max-w-3xl space-y-3">
        {d.model != null && <span className="text-xs text-zinc-500 font-mono">{String(d.model)}</span>}
        {d.content != null && (
          <p className="text-zinc-300 leading-relaxed text-sm sm:text-base break-words">{String(d.content)}</p>
        )}
        <div className="flex flex-wrap gap-4 text-xs text-zinc-500 font-mono">
          {event.tokensIn != null && <span>in: {event.tokensIn}</span>}
          {event.tokensOut != null && <span>out: {event.tokensOut}</span>}
        </div>
      </div>
    );
  }

  return (
    <pre className="bg-surface-2 rounded-lg p-3 sm:p-4 text-xs sm:text-sm font-mono text-zinc-400 overflow-x-auto border border-white/5 whitespace-pre-wrap break-words">
      {JSON.stringify(d, null, 2)}
    </pre>
  );
}
