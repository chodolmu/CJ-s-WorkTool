import React, { useState } from "react";
import type { Milestone, Sprint, Task, MilestoneStatus } from "@shared/types";
import { SprintNode } from "./SprintNode";

type MilestoneWithSprints = Milestone & {
  sprints: (Sprint & { tasks: Task[] })[];
};

interface MilestoneNodeProps {
  milestone: MilestoneWithSprints;
}

function MilestoneStatusIcon({ status }: { status: MilestoneStatus }) {
  switch (status) {
    case "pending":
      return <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-500" />;
    case "active":
      return <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400" />;
    case "completed":
      return <span className="text-green-400 text-sm font-bold leading-none">&#10003;</span>;
    case "failed":
      return <span className="text-red-400 text-sm font-bold leading-none">&#10005;</span>;
  }
}

export const MilestoneNode: React.FC<MilestoneNodeProps> = ({ milestone }) => {
  const [collapsed, setCollapsed] = useState(false);

  const sprints = milestone.sprints ?? [];
  const allTasks = sprints.flatMap((s) => s.tasks ?? []);
  const completed = allTasks.filter((t) => t.status === "completed").length;
  const total = allTasks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-gray-700/50 transition-colors"
      >
        <span className="text-gray-400 text-xs w-3 text-center select-none font-mono">
          {collapsed ? "+" : "-"}
        </span>
        <MilestoneStatusIcon status={milestone.status} />
        <span className="flex-1 truncate text-gray-100 font-semibold text-sm">
          {milestone.name}
        </span>
        <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
          {completed}/{total}
        </span>
      </button>

      {/* Progress bar */}
      {total > 0 && (
        <div className="ml-7 mr-2 h-1.5 bg-gray-700 rounded-full overflow-hidden mt-0.5 mb-1">
          <div
            className={`h-full rounded-full transition-all ${
              pct === 100 ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {!collapsed && (
        <div className="flex flex-col gap-0.5">
          {sprints.map((sprint) => (
            <SprintNode key={sprint.id} sprint={sprint} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MilestoneNode;
