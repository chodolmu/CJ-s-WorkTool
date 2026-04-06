import React from "react";
import { useAppStore } from "../../stores/app-store";
import { MilestoneNode } from "./MilestoneNode";

export const ProjectTree: React.FC = () => {
  const milestones = useAppStore((s) => s.milestones);

  if (milestones.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 italic">
        No project plan loaded. Run /plan to generate a task tree.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-2 bg-gray-900 rounded-lg overflow-y-auto text-sm">
      {milestones.map((milestone) => (
        <MilestoneNode key={milestone.id} milestone={milestone} />
      ))}
    </div>
  );
};

export default ProjectTree;
