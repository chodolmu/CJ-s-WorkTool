import React from "react";

interface WelcomePageProps {
  onNewProject: () => void;
  onLoadProject?: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  recentProjects?: { id: string; name: string; status: string; updatedAt: string }[];
}

export function WelcomePage({ onNewProject, onLoadProject, onDeleteProject, recentProjects }: WelcomePageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6 glow-accent">
        <span className="text-3xl font-bold text-accent">W</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">
        WorkTool
      </h1>
      <p className="text-sm opacity-60 mb-8 max-w-lg">
        만들고 싶은 것을 알려주세요. AI 에이전트가 기획, 코드 작성, 검증까지 해드립니다.
      </p>

      <button
        onClick={onNewProject}
        className="px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors cursor-pointer mb-8"
      >
        + 새 프로젝트
      </button>

      {recentProjects && recentProjects.length > 0 && (
        <div className="w-full max-w-sm">
          <div className="text-xs opacity-50 uppercase tracking-wide mb-2">
            최근 프로젝트
          </div>
          <div className="space-y-1">
            {recentProjects.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md border border-border-subtle hover:bg-bg-hover transition-colors group"
              >
                <button
                  onClick={() => onLoadProject?.(p.id)}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <div className="text-sm text-text-primary truncate">{p.name}</div>
                  <div className="text-xs text-text-muted">
                    {p.status} · {new Date(p.updatedAt).toLocaleDateString()}
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`"${p.name}" 프로젝트를 삭제할까요?`)) {
                      onDeleteProject?.(p.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-status-error text-xs cursor-pointer px-1"
                  title="프로젝트 삭제"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 text-xs opacity-40">
        Claude Code 설치 및 로그인이 필요합니다
      </div>
    </div>
  );
}
