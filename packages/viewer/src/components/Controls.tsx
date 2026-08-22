interface ControlsProps {
  isPlaying: boolean;
  playbackSpeed: number;
  currentSequence: number;
  totalEvents: number;
  onPlay: () => void;
  onPause: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSetSpeed: (speed: number) => void;
}

const SPEEDS = [0.5, 1, 2, 4];

export function Controls({
  isPlaying,
  playbackSpeed,
  currentSequence,
  totalEvents,
  onPlay,
  onPause,
  onStepForward,
  onStepBackward,
  onSetSpeed,
}: ControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-3 border-t border-white/5 bg-surface-2">
      <button
        onClick={onStepBackward}
        disabled={currentSequence <= 0}
        className="w-9 h-9 rounded-lg bg-surface-3 hover:bg-surface-4 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        title="Step back"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-zinc-300">
          <path d="M3 3v10l8-5-8-5z" />
          <rect x="1" y="3" width="2" height="10" />
        </svg>
      </button>

      <button
        onClick={isPlaying ? onPause : onPlay}
        className="w-12 h-12 rounded-full bg-accent hover:bg-accent-dim flex items-center justify-center transition-colors playing-indicator"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="#06060a">
            <rect x="4" y="3" width="3" height="12" rx="1" />
            <rect x="11" y="3" width="3" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="#06060a" className="ml-0.5">
            <path d="M5 3l10 6-10 6V3z" />
          </svg>
        )}
      </button>

      <button
        onClick={onStepForward}
        disabled={currentSequence >= totalEvents - 1}
        className="w-9 h-9 rounded-lg bg-surface-3 hover:bg-surface-4 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        title="Step forward"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-zinc-300">
          <path d="M3 3v10l8-5-8-5z" />
        </svg>
      </button>

      <div className="h-6 w-px bg-white/10 mx-2" />

      <div className="flex gap-1">
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            onClick={() => onSetSpeed(speed)}
            className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
              playbackSpeed === speed
                ? "bg-accent/20 text-accent"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-surface-3"
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>

      <div className="ml-4 text-xs text-zinc-600 font-mono">
        <kbd className="px-1.5 py-0.5 rounded bg-surface-3 text-zinc-500">Space</kbd> play/pause
        <span className="mx-2">·</span>
        <kbd className="px-1.5 py-0.5 rounded bg-surface-3 text-zinc-500">←</kbd>
        <kbd className="px-1.5 py-0.5 rounded bg-surface-3 text-zinc-500">→</kbd> step
      </div>
    </div>
  );
}
