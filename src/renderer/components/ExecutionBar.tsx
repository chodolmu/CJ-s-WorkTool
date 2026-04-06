import React, { useEffect, useState, useRef } from "react";
import { useAppStore } from "../stores/app-store";

export function ExecutionBar() {
  const executionStatus = useAppStore((s) => s.executionStatus);
  const activeTaskId = useAppStore((s) => s.activeTaskId);
  const milestones = useAppStore((s) => s.milestones);

  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());

  // Find the active task from the tree
  const activeTask = (() => {
    for (const m of milestones) {
      for (const s of m.sprints) {
        for (const t of s.tasks) {
          if (t.id === activeTaskId) return t;
        }
      }
    }
    return null;
  })();

  // Reset timer when activeTaskId changes
  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
  }, [activeTaskId]);

  // Tick elapsed time every second while running
  useEffect(() => {
    if (executionStatus !== "running" || !activeTaskId) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [executionStatus, activeTaskId]);

  if (executionStatus !== "running" || !activeTask) {
    return null;
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const modelColors: Record<string, string> = {
    haiku: "bg-emerald-700 text-emerald-100",
    sonnet: "bg-violet-700 text-violet-100",
    opus: "bg-amber-700 text-amber-100",
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-10 bg-gray-900 border-t border-gray-700 flex items-center px-4 gap-3 z-50">
      {/* Pulse indicator */}
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
      </span>

      {/* Task name */}
      <span className="text-sm text-gray-200 truncate">{activeTask.name}</span>

      {/* Model badge */}
      <span
        className={`px-2 py-0.5 text-xs rounded-full font-medium shrink-0 ${modelColors[activeTask.model] ?? "bg-gray-600 text-gray-200"}`}
      >
        {activeTask.model}
      </span>

      {/* Elapsed time */}
      <span className="ml-auto text-xs font-mono text-gray-400 shrink-0">
        {timeStr}
      </span>
    </div>
  );
}
