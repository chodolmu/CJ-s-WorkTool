import React, { useState } from "react";
import type { Sprint, Task, SprintStatus } from "@shared/types";
import { TaskNode } from "./TaskNode";

type SprintWithTasks = Sprint & { tasks: Task[] };

interface SprintNodeProps {
  sprint: SprintWithTasks;
}

function SprintStatusIcon({ status }: { status: SprintStatus }) {
  switch (status) {
    case "pending":
      return <span className="inline-block w-2 h-2 rounded-full bg-gray-500" />;
    case "active":
      return <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />;
    case "completed":
      return <span className="text-green-400 text-xs font-bold leading-none">&#10003;</span>;
    case "failed":
      return <span className="text-red-400 text-xs font-bold leading-none">&#10005;</span>;
  }
}

export const SprintNode: React.FC<SprintNodeProps> = ({ sprint }) => {
  const [collapsed, setCollapsed] = useState(false);

  const tasks = sprint.tasks ?? [];
  const completed = tasks.filter((t) => t.status === "completed").length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="ml-3">
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-sm hover:bg-gray-700/40 transition-colors group"
      >
        <span className="text-gray-500 text-xs w-3 text-center select-none">
          {collapsed ? "+" : "-"}
        </span>
        <SprintStatusIcon status={sprint.status} />
        <span className="flex-1 truncate text-gray-300 font-medium">{sprint.name}</span>
        <span className="text-xs text-gray-500 tabular-nums">
          {completed}/{total}
        </span>
      </button>

      {/* Progress bar */}
      {total > 0 && (
        <div className="ml-7 mr-2 h-1 bg-gray-700 rounded-full overflow-hidden mt-0.5 mb-1">
          <div
            className={`h-full rounded-full transition-all ${
              pct === 100 ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {!collapsed && (
        <div className="ml-4 flex flex-col gap-0.5">
          {tasks.map((task) => (
            <TaskNode key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SprintNode;
