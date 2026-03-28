import React from "react";
interface ProgressBarProps {
  completed: number;
  total: number;
  currentLabel?: string | null;
  size?: "sm" | "md";
}

export function ProgressBar({ completed, total, currentLabel, size = "md" }: ProgressBarProps) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const barHeight = size === "sm" ? "h-1" : "h-2";

  return (
    <div>
      <div className="flex justify-between text-xs text-text-secondary mb-1">
        <span>{currentLabel ?? "준비"}</span>
        <span>{completed}/{total} 기능 ({percent}%)</span>
      </div>
      <div className={`w-full ${barHeight} bg-bg-active rounded-full overflow-hidden`}>
        <div
          className={`${barHeight} bg-accent rounded-full transition-all duration-700`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
