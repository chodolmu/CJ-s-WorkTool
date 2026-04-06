import React, { useEffect, useState } from "react";
import { useAppStore } from "../stores/app-store";
import { ProjectHeader } from "../components/ProjectHeader";
import { TaskDetailPanel } from "../components/detail/TaskDetailPanel";
import { ExecutionBar } from "../components/ExecutionBar";
import type { ProjectTree, ProjectStats } from "@shared/types";

declare const window: Window & { harness: any };

interface ProjectPageProps {
  projectId: string;
}

export function ProjectPage({ projectId }: ProjectPageProps) {
  const milestones = useAppStore((s) => s.milestones);
  const setProjectTree = useAppStore((s) => s.setProjectTree);
  const setStats = useAppStore((s) => s.setStats);
  const selectTask = useAppStore((s) => s.selectTask);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const executionStatus = useAppStore((s) => s.executionStatus);

  const [projectName, setProjectName] = useState("프로젝트");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      window.harness.data.getProjectTree(projectId),
      window.harness.data.getProjectStats(projectId),
    ])
      .then(([tree, stats]: [ProjectTree, ProjectStats]) => {
        setProjectName(tree.project.name);
        setProjectTree(tree.milestones);
        setStats(stats);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, [projectId]);

  if (!loaded) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        로딩중...
      </div>
    );
  }

  if (milestones.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <ProjectHeader projectId={projectId} projectName={projectName} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-lg text-gray-400">계획을 먼저 생성하세요</p>
            <p className="text-sm text-gray-600">
              /plan 명령으로 마일스톤, 스프린트, 태스크를 생성할 수 있습니다
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ProjectHeader projectId={projectId} projectName={projectName} />

      {/* Split: Tree (left) + Detail (right) */}
      <div className="flex-1 flex min-h-0">
        {/* Project Tree - 40% */}
        <div className="w-2/5 border-r border-gray-700 overflow-y-auto p-3">
          {milestones.map((milestone) => (
            <div key={milestone.id} className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <MilestoneIcon status={milestone.status} />
                <span className="text-sm font-semibold text-gray-200">
                  {milestone.name}
                </span>
              </div>
              {milestone.sprints.map((sprint) => (
                <div key={sprint.id} className="ml-4 mb-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <SprintIcon status={sprint.status} />
                    <span className="text-xs font-medium text-gray-400">
                      {sprint.name}
                    </span>
                  </div>
                  <div className="ml-4 space-y-0.5">
                    {sprint.tasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => selectTask(task.id)}
                        className={`w-full text-left px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                          task.id === selectedTaskId
                            ? "bg-blue-600/30 text-blue-200"
                            : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                        }`}
                      >
                        <span className="mr-1.5">{taskIcon(task.status)}</span>
                        {task.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Task Detail - 60% */}
        <div className="w-3/5 flex flex-col min-h-0">
          <TaskDetailPanel />
        </div>
      </div>

      {/* Execution Bar - bottom, add padding when visible */}
      {executionStatus === "running" && <div className="h-10 shrink-0" />}
      <ExecutionBar />
    </div>
  );
}

/* --- Small helper components --- */

function MilestoneIcon({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "text-gray-500",
    active: "text-blue-400",
    completed: "text-green-400",
    failed: "text-red-400",
  };
  return <span className={`text-xs ${colors[status] ?? "text-gray-500"}`}>◆</span>;
}

function SprintIcon({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "text-gray-600",
    active: "text-blue-400",
    completed: "text-green-400",
    failed: "text-red-400",
  };
  return <span className={`text-xs ${colors[status] ?? "text-gray-600"}`}>▸</span>;
}

function taskIcon(status: string): string {
  switch (status) {
    case "completed":
      return "✓";
    case "failed":
      return "✗";
    case "running":
      return "●";
    case "skipped":
      return "–";
    default:
      return "○";
  }
}
