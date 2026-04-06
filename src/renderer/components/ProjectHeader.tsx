import React from "react";
import { useAppStore } from "../stores/app-store";

declare const window: Window & { harness: any };

interface ProjectHeaderProps {
  projectId: string;
  projectName: string;
}

export function ProjectHeader({ projectId, projectName }: ProjectHeaderProps) {
  const executionStatus = useAppStore((s) => s.executionStatus);
  const stats = useAppStore((s) => s.stats);

  const progressPercent = stats?.progressPercent ?? 0;
  const totalCost = stats?.totalCost ?? 0;

  const handleStart = () => {
    window.harness.execution.start(projectId);
  };

  const handlePause = () => {
    window.harness.execution.pause();
  };

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-gray-800 border-b border-gray-700">
      {/* Project name */}
      <h1 className="text-xl font-bold text-gray-100 shrink-0">
        {projectName}
      </h1>

      {/* Progress bar */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>진행률</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-2 bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Cost */}
      <div className="shrink-0 text-right">
        <span className="text-xs text-gray-500">비용</span>
        <p className="text-sm font-mono text-gray-300">
          ${totalCost.toFixed(4)}
        </p>
      </div>

      {/* Start / Pause button */}
      <div className="shrink-0">
        {executionStatus === "running" ? (
          <button
            onClick={handlePause}
            className="px-4 py-1.5 text-sm font-medium bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors cursor-pointer"
          >
            일시정지
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="px-4 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors cursor-pointer"
          >
            실행
          </button>
        )}
      </div>
    </div>
  );
}
