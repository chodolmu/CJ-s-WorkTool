import React from "react";
import { useAppStore } from "../stores/app-store";
import type { Project } from "@shared/types";

interface DashboardPageProps {
  onNewProject: () => void;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  planning:   { label: "기획중",   color: "text-yellow-400" },
  active:     { label: "실행중",   color: "text-blue-400" },
  paused:     { label: "일시정지", color: "text-gray-400" },
  completed:  { label: "완료",     color: "text-green-400" },
};

export function DashboardPage({ onNewProject, onOpenProject, onDeleteProject }: DashboardPageProps) {
  const { projects, claudeInstalled } = useAppStore();

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">WorkTool</h1>
            <p className="text-xs text-text-muted mt-0.5">태스크 드리븐 프로젝트 매니저</p>
          </div>
          <button
            onClick={onNewProject}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium cursor-pointer transition-colors"
          >
            + 새 프로젝트
          </button>
        </div>

        {/* Claude Code Status */}
        {claudeInstalled === false && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-300">
            Claude Code CLI가 설치되지 않았습니다. 설치 후 사용해주세요.
          </div>
        )}

        {/* Project Cards */}
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-4xl mb-4 opacity-30">📁</div>
            <p className="text-sm text-text-muted mb-4">아직 프로젝트가 없습니다</p>
            <button
              onClick={onNewProject}
              className="px-4 py-2 bg-accent/10 text-accent rounded-lg text-sm hover:bg-accent/20 cursor-pointer"
            >
              첫 프로젝트 시작하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project: Project) => {
              const status = statusConfig[project.status] ?? statusConfig.planning;
              return (
                <div
                  key={project.id}
                  onClick={() => onOpenProject(project.id)}
                  className="bg-bg-card border border-border-subtle rounded-lg p-4 hover:border-accent/30 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                        {project.name}
                      </h3>
                      <span className={`text-xs ${status.color}`}>{status.label}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("이 프로젝트를 삭제할까요?")) {
                          onDeleteProject(project.id);
                        }
                      }}
                      className="text-xs text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      삭제
                    </button>
                  </div>

                  {project.description && (
                    <p className="text-xs text-text-muted line-clamp-2 mb-2">
                      {project.description}
                    </p>
                  )}

                  <div className="text-[10px] text-text-muted">
                    {new Date(project.createdAt).toLocaleDateString("ko-KR")}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
