import React from "react";
import type { Task, TaskStatus, TaskDifficulty, ModelType } from "@shared/types";
import { useAppStore } from "../../stores/app-store";

interface TaskNodeProps {
  task: Task;
}

function StatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case "pending":
      return <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-500" />;
    case "queued":
      return <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500" />;
    case "running":
      return (
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 animate-spin border border-blue-300 border-t-transparent" />
      );
    case "completed":
      return <span className="text-green-400 text-xs font-bold leading-none">&#10003;</span>;
    case "failed":
      return <span className="text-red-400 text-xs font-bold leading-none">&#10005;</span>;
    case "skipped":
      return <span className="text-gray-500 text-xs line-through leading-none">--</span>;
  }
}

function ModelBadge({ model }: { model: ModelType }) {
  const config: Record<ModelType, { label: string; classes: string }> = {
    haiku: { label: "H", classes: "bg-gray-600 text-gray-300" },
    sonnet: { label: "S", classes: "bg-blue-800 text-blue-300" },
    opus: { label: "O", classes: "bg-purple-800 text-purple-300" },
  };
  const { label, classes } = config[model];
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-mono font-bold leading-none ${classes}`}
    >
      {label}
    </span>
  );
}

function DifficultyDots({ difficulty }: { difficulty: TaskDifficulty }) {
  const config: Record<TaskDifficulty, { count: number; color: string }> = {
    easy: { count: 1, color: "bg-green-400" },
    medium: { count: 2, color: "bg-yellow-400" },
    hard: { count: 3, color: "bg-red-400" },
  };
  const { count, color } = config[difficulty];
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />
      ))}
    </span>
  );
}

export const TaskNode: React.FC<TaskNodeProps> = ({ task }) => {
  const selectTask = useAppStore((s) => s.selectTask);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const isSelected = selectedTaskId === task.id;

  return (
    <button
      type="button"
      onClick={() => selectTask(task.id)}
      className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left text-sm transition-colors
        ${isSelected ? "bg-blue-900/50 ring-1 ring-blue-500" : "hover:bg-gray-700/50"}
        ${task.status === "skipped" ? "opacity-50" : ""}`}
    >
      <StatusIcon status={task.status} />
      <span
        className={`flex-1 truncate text-gray-200 ${task.status === "skipped" ? "line-through" : ""}`}
      >
        {task.name}
      </span>
      <DifficultyDots difficulty={task.difficulty} />
      <ModelBadge model={task.model} />
    </button>
  );
};

export default TaskNode;
