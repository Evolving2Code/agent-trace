export type MobilePanel = "timeline" | "detail" | "flow";

interface MobileTabBarProps {
  active: MobilePanel;
  onChange: (panel: MobilePanel) => void;
  eventCount: number;
}

const TABS: Array<{ id: MobilePanel; label: string; icon: string }> = [
  { id: "timeline", label: "Timeline", icon: "☰" },
  { id: "detail", label: "Inspector", icon: "◉" },
  { id: "flow", label: "Flow", icon: "↕" },
];

export function MobileTabBar({ active, onChange, eventCount }: MobileTabBarProps) {
  return (
    <nav
      className="md:hidden shrink-0 border-t border-white/5 bg-surface-2/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Replay panels"
    >
      <div className="grid grid-cols-3">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] transition-colors ${
                isActive
                  ? "text-accent bg-accent/5"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
              }`}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="text-[11px] font-medium">{tab.label}</span>
              {tab.id === "timeline" && (
                <span className="text-[10px] text-zinc-600">{eventCount} events</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
