import type { ReactNode } from "react";

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
    <div
      className="shrink-0 border-t border-white/5 bg-surface-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-center">
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <ControlButton
            onClick={onStepBackward}
            disabled={currentSequence <= 0}
            label="Step back"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-zinc-300">
              <path d="M3 3v10l8-5-8-5z" />
              <rect x="1" y="3" width="2" height="10" />
            </svg>
          </ControlButton>

          <button
            type="button"
            onClick={isPlaying ? onPause : onPlay}
            className="w-14 h-14 sm:w-12 sm:h-12 rounded-full bg-accent hover:bg-accent-dim active:scale-95 flex items-center justify-center transition-all playing-indicator touch-manipulation"
            aria-label={isPlaying ? "Pause replay" : "Play replay"}
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

          <ControlButton
            onClick={onStepForward}
            disabled={currentSequence >= totalEvents - 1}
            label="Step forward"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-zinc-300">
              <path d="M3 3v10l8-5-8-5z" />
            </svg>
          </ControlButton>
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <div className="flex gap-1">
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => onSetSpeed(speed)}
                className={`min-w-11 px-3 py-2 sm:px-2.5 sm:py-1 rounded-md text-xs font-mono transition-colors touch-manipulation ${
                  playbackSpeed === speed
                    ? "bg-accent/20 text-accent"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-surface-3 active:bg-surface-4"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          <div className="hidden lg:flex items-center text-xs text-zinc-600 font-mono ml-2">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-3 text-zinc-500">Space</kbd>
            <span className="mx-2">·</span>
            <kbd className="px-1.5 py-0.5 rounded bg-surface-3 text-zinc-500">←</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-surface-3 text-zinc-500">→</kbd>
            <span className="ml-2">step</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: ReactNode;
}) {
  const sizeClass = "w-11 h-11 sm:w-9 sm:h-9";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`${sizeClass} rounded-lg bg-surface-3 hover:bg-surface-4 active:bg-surface-4 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors touch-manipulation`}
    >
      {children}
    </button>
  );
}
