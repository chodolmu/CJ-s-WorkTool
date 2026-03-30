import React, { useEffect, useRef, useState } from "react";
import type { ActivityEventType } from "@shared/types";

export interface ActivityItem {
  id: string;
  timestamp: string;
  agentId: string;
  agentIcon?: string;
  eventType: ActivityEventType;
  message: string;
  details?: string | null;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  maxHeight?: string;
}

const eventTypeConfig: Record<ActivityEventType, { badge: string; color: string }> = {
  thinking:    { badge: "THINK",  color: "text-status-neutral" },
  tool_call:   { badge: "TOOL",   color: "text-status-info" },
  complete:    { badge: "DONE",   color: "text-status-success" },
  error:       { badge: "ERROR",  color: "text-status-error" },
  checkpoint:  { badge: "CHECK",  color: "text-status-warning" },
  user_action: { badge: "USER",   color: "text-accent" },
  system:      { badge: "SYS",    color: "text-text-muted" },
};

const agentIcons: Record<string, string> = {
  planner: "🔧",
  generator: "💻",
  evaluator: "🔍",
  user: "👤",
  system: "⚙️",
};

export function ActivityFeed({ activities, maxHeight = "100%" }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ActivityEventType | null>(null);

  // 자동 스크롤
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const importantTypes = new Set<ActivityEventType>(["error", "system", "complete", "checkpoint"]);
  const filtered = filter === "important" as any
    ? activities.filter((a) => importantTypes.has(a.eventType))
    : filter
      ? activities.filter((a) => a.eventType === filter)
      : activities;

  return (
    <div className="flex flex-col" style={{ maxHeight }}>
      {/* Filter chips */}
      <div className="flex items-center gap-1 px-1 pb-1.5 shrink-0 flex-wrap">
        <FilterChip label="전체" active={filter === null} onClick={() => setFilter(null)} />
        <FilterChip label="중요만" active={filter === "important" as any} onClick={() => setFilter("important" as any)} />
        <FilterChip label="System" active={filter === "system"} onClick={() => setFilter("system")} />
        <FilterChip label="Error" active={filter === "error"} onClick={() => setFilter("error")} />
        <FilterChip label="Done" active={filter === "complete"} onClick={() => setFilter("complete")} />
        <FilterChip label="Tool" active={filter === "tool_call"} onClick={() => setFilter("tool_call")} />
        <span className="text-[10px] text-text-muted ml-auto">{filtered.length}/{activities.length}</span>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-0.5 font-mono text-xs"
      >
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-20 text-text-muted">
            아직 활동이 없습니다
          </div>
        )}

        {filtered.map((item) => {
          const config = eventTypeConfig[item.eventType];
          const icon = item.agentIcon ?? agentIcons[item.agentId] ?? "🤖";
          const isExpanded = expandedIds.has(item.id);
          const time = new Date(item.timestamp).toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          return (
            <div
              key={item.id}
              className="flex items-start gap-1.5 px-1 py-0.5 hover:bg-bg-hover rounded transition-colors"
            >
              <span className="text-text-muted shrink-0 w-16">{time}</span>
              <span className="shrink-0 w-5 text-center">{icon}</span>
              <span className={`shrink-0 w-12 font-semibold ${config.color}`}>
                {config.badge}
              </span>
              <span
                className={`text-text-secondary flex-1 ${item.details ? "cursor-pointer hover:text-text-primary" : ""}`}
                onClick={() => item.details && toggleExpand(item.id)}
              >
                {item.message}
                {item.details && (
                  <span className="text-text-muted ml-1">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                )}
                {isExpanded && item.details && (
                  <div className="mt-1 p-2 bg-bg-active rounded text-text-muted whitespace-pre-wrap break-all">
                    {item.details}
                  </div>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && activities.length > 0 && (
        <button
          onClick={() => {
            setAutoScroll(true);
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
          }}
          className="absolute bottom-2 right-4 px-2 py-1 bg-accent text-white text-xs rounded cursor-pointer"
        >
          ↓ 새 활동
        </button>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-xs cursor-pointer transition-colors ${
        active
          ? "bg-accent/20 text-accent"
          : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
      }`}
    >
      {label}
    </button>
  );
}
