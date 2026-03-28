import React from "react";
import { useAppStore } from "../../stores/app-store";
import { ActivityFeed } from "../ActivityFeed";

interface ActivityPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function ActivityPanel({ isOpen, onToggle }: ActivityPanelProps) {
  const activities = useAppStore((s) => s.activities);

  return (
    <div className="border-t border-border-subtle bg-bg-base shrink-0 relative">
      {/* Toggle bar */}
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-4 py-1.5 hover:bg-bg-hover transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">Activity</span>
          {activities.length > 0 && (
            <span className="text-[10px] text-text-muted bg-bg-active px-1.5 py-0.5 rounded-badge">
              {activities.length}
            </span>
          )}
        </div>
        <span className="text-[10px] text-text-muted">{isOpen ? "▼" : "▲"}</span>
      </button>

      {/* Log content */}
      {isOpen && (
        <div className={`px-3 pb-2 ${activities.length > 0 ? "h-48" : "h-16"}`}>
          {activities.length > 0 ? (
            <ActivityFeed activities={activities} maxHeight="100%" />
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-text-muted">
              Activity will appear here when agents start working
            </div>
          )}
        </div>
      )}
    </div>
  );
}
