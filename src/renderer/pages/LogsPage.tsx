import React, { useState, useEffect, useMemo } from "react";
import { useAppStore } from "../stores/app-store";
import type { ActivityEventType } from "@shared/types";
import type { ActivityItem } from "../components/ActivityFeed";

const eventTypeConfig: Record<ActivityEventType, { badge: string; color: string; bgColor: string }> = {
  thinking:    { badge: "THINK",  color: "text-status-neutral",  bgColor: "bg-status-neutral/10" },
  tool_call:   { badge: "TOOL",   color: "text-status-info",     bgColor: "bg-status-info/10" },
  complete:    { badge: "DONE",   color: "text-status-success",  bgColor: "bg-status-success/10" },
  error:       { badge: "ERROR",  color: "text-status-error",    bgColor: "bg-status-error/10" },
  checkpoint:  { badge: "CHECK",  color: "text-status-warning",  bgColor: "bg-status-warning/10" },
  user_action: { badge: "USER",   color: "text-accent",          bgColor: "bg-accent/10" },
  system:      { badge: "SYS",    color: "text-text-muted",      bgColor: "bg-bg-hover" },
};

const filterOptions: { label: string; value: ActivityEventType | "all" }[] = [
  { label: "전체", value: "all" },
  { label: "도구", value: "tool_call" },
  { label: "완료", value: "complete" },
  { label: "오류", value: "error" },
  { label: "체크", value: "checkpoint" },
  { label: "시스템", value: "system" },
];

export function LogsPage() {
  const { activities, currentProjectId } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<ActivityEventType | "all">("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let result = activities;

    if (filterType !== "all") {
      result = result.filter((a) => a.eventType === filterType);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.message.toLowerCase().includes(q) ||
          a.agentId.toLowerCase().includes(q) ||
          (a.details && a.details.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [activities, filterType, searchQuery]);

  // 역순 (최신 순)
  const sortedFiltered = useMemo(() => [...filtered].reverse(), [filtered]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!currentProjectId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <span className="text-3xl mb-3">📜</span>
        <h2 className="text-lg font-medium mb-1">활동 로그</h2>
        <p className="text-sm text-text-secondary">프로젝트를 시작하면 활동 로그를 볼 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header + Search + Filters */}
      <div className="shrink-0 space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium text-text-primary">활동 로그</h1>
          <span className="text-xs text-text-muted">{filtered.length} 이벤트</span>
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="로그 검색..."
          className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />

        {/* Filters */}
        <div className="flex gap-1.5 flex-wrap">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterType(opt.value)}
              className={`px-2.5 py-1 rounded-badge text-xs font-medium transition-colors cursor-pointer ${
                filterType === opt.value
                  ? "bg-accent text-white"
                  : "bg-bg-card border border-border-subtle text-text-secondary hover:bg-bg-hover"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {sortedFiltered.length === 0 ? (
          <div className="text-center text-sm text-text-muted py-8">
            {searchQuery ? "검색 결과가 없습니다." : "아직 활동이 없습니다."}
          </div>
        ) : (
          sortedFiltered.map((activity) => {
            const config = eventTypeConfig[activity.eventType] ?? eventTypeConfig.system;
            const isExpanded = expandedIds.has(activity.id);

            return (
              <div
                key={activity.id}
                className="p-2.5 bg-bg-card border border-border-subtle rounded-md hover:bg-bg-hover transition-colors cursor-pointer"
                onClick={() => activity.details && toggleExpand(activity.id)}
              >
                <div className="flex items-start gap-2">
                  {/* Timestamp */}
                  <span className="text-[10px] text-text-muted font-mono shrink-0 mt-0.5 w-14">
                    {new Date(activity.timestamp).toLocaleTimeString("en-US", {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>

                  {/* Event type badge */}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${config.color} ${config.bgColor}`}>
                    {config.badge}
                  </span>

                  {/* Agent */}
                  <span className="text-xs text-accent shrink-0">{activity.agentId}</span>

                  {/* Message */}
                  <span className="text-xs text-text-primary flex-1 min-w-0 truncate">
                    {activity.message}
                  </span>

                  {/* Expand indicator */}
                  {activity.details && (
                    <span className="text-[10px] text-text-muted shrink-0">
                      {isExpanded ? "▼" : "▶"}
                    </span>
                  )}
                </div>

                {/* Expanded details */}
                {isExpanded && activity.details && (
                  <pre className="mt-2 ml-16 p-2 bg-bg-base border border-border-subtle rounded text-xs text-text-secondary font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {activity.details}
                  </pre>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
