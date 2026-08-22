import type { TraceEvent } from "@agent-trace/core/browser";

interface TimelineProps {
  events: TraceEvent[];
  currentSequence: number;
  getEventColor: (type: TraceEvent["type"]) => string;
  onSeek: (sequence: number) => void;
}

export function Timeline({ events, currentSequence, getEventColor, onSeek }: TimelineProps) {
  if (events.length === 0) return null;

  const progress = events.length > 1 ? (currentSequence / (events.length - 1)) * 100 : 0;

  return (
    <div className="px-6 py-4 border-t border-white/5 bg-surface-1">
      <div className="relative h-8 timeline-track rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-accent/20 transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
        {events.map((event) => {
          const left = events.length > 1 ? (event.sequence / (events.length - 1)) * 100 : 50;
          const isPast = event.sequence <= currentSequence;
          return (
            <button
              key={event.id}
              onClick={() => onSeek(event.sequence)}
              className="event-marker absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border border-surface-0"
              style={{
                left: `${left}%`,
                backgroundColor: getEventColor(event.type),
                opacity: isPast ? 1 : 0.3,
                transform: `translate(-50%, -50%) scale(${event.sequence === currentSequence ? 1.5 : 1})`,
              }}
              title={`Step ${event.sequence}: ${event.type}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] font-mono text-zinc-600">
        <span>0</span>
        <span>
          step {currentSequence} / {events.length - 1}
        </span>
        <span>{events.length - 1}</span>
      </div>
    </div>
  );
}
