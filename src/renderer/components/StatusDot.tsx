import React from "react";
import type { AgentStatus } from "@shared/types";

interface StatusDotProps {
  status: AgentStatus;
  size?: "sm" | "md";
}

const statusConfig: Record<AgentStatus, { color: string; label: string; pulse: boolean }> = {
  running:   { color: "bg-status-success", label: "실행중",   pulse: true },
  queued:    { color: "bg-status-neutral",  label: "대기",    pulse: false },
  completed: { color: "bg-status-info",     label: "완료", pulse: false },
  failed:    { color: "bg-status-error",    label: "실패",    pulse: false },
  paused:    { color: "bg-status-warning",  label: "일시정지",    pulse: false },
};

export function StatusDot({ status, size = "md" }: StatusDotProps) {
  const config = statusConfig[status];
  const sizeClass = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";

  return (
    <span className="relative inline-flex" title={config.label}>
      <span className={`${sizeClass} rounded-full ${config.color}`} />
      {config.pulse && (
        <span
          className={`absolute inset-0 ${sizeClass} rounded-full ${config.color} animate-ping opacity-40`}
        />
      )}
    </span>
  );
}

export function StatusLabel({ status }: { status: AgentStatus }) {
  const config = statusConfig[status];
  return (
    <div className="flex items-center gap-1.5">
      <StatusDot status={status} size="sm" />
      <span className="text-xs text-text-secondary">{config.label}</span>
    </div>
  );
}
