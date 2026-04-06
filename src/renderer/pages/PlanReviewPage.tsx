import React, { useEffect, useState } from "react";
import type { ProjectTree } from "@shared/types";

interface PlanReviewPageProps {
  projectId: string;
  onApprove: () => void;
  onBack: () => void;
}

export function PlanReviewPage({ projectId, onApprove, onBack }: PlanReviewPageProps) {
  const [tree, setTree] = useState<ProjectTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTree = async () => {
    if (!window.harness) return;
    const data = await window.harness.data.getProjectTree(projectId);
    setTree(data as ProjectTree);
    setLoading(false);
  };

  const generatePlan = async () => {
    if (!window.harness) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await window.harness.planning.generate(projectId) as any;
      if (result.error) {
        setError(result.error);
      } else {
        await loadTree();
      }
    } catch (err) {
      setError(String(err));
    }
    setGenerating(false);
  };

  const handleApprove = async () => {
    if (!window.harness) return;
    await window.harness.planning.approve(projectId);
    onApprove();
  };

  useEffect(() => {
    loadTree().then(() => {
      // 트리가 비어있으면 자동 생성
      if (!tree || tree.milestones.length === 0) {
        generatePlan();
      }
    });
  }, [projectId]);

  // 트리 로드 후 비어있으면 자동 생성
  useEffect(() => {
    if (!loading && tree && tree.milestones.length === 0 && !generating) {
      generatePlan();
    }
  }, [loading, tree]);

  const totalTasks = tree?.milestones.reduce(
    (sum, m) => sum + m.sprints.reduce((s2, sp) => s2 + sp.tasks.length, 0), 0
  ) ?? 0;

  return (
    <div className="flex flex-col h-full bg-bg-base">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">계획 검토</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Opus PM이 생성한 계획을 확인하고 승인하세요
          </p>
        </div>
        <button onClick={onBack} className="text-sm text-text-muted hover:text-text-secondary cursor-pointer">
          뒤로
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {generating && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-text-muted">Opus PM이 계획을 생성 중...</p>
            <p className="text-xs text-text-muted">프로젝트를 마일스톤→스프린트→태스크로 분할합니다</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={generatePlan}
              className="mt-2 text-xs text-accent hover:text-accent-hover cursor-pointer"
            >
              다시 시도
            </button>
          </div>
        )}

        {!generating && tree && tree.milestones.length > 0 && (
          <div className="space-y-4 max-w-3xl">
            <div className="text-sm text-text-secondary mb-2">
              마일스톤 {tree.milestones.length}개 · 태스크 {totalTasks}개
            </div>

            {tree.milestones.map((m) => (
              <div key={m.id} className="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-accent/5 border-b border-border-subtle">
                  <div className="text-sm font-medium text-text-primary">{m.name}</div>
                  <div className="text-xs text-text-muted mt-0.5">{m.description}</div>
                </div>

                {m.sprints.map((s) => (
                  <div key={s.id} className="border-b border-border-subtle last:border-b-0">
                    <div className="px-4 py-2 bg-bg-hover/30">
                      <div className="text-xs font-medium text-text-secondary">{s.name}</div>
                    </div>

                    <div className="divide-y divide-border-subtle">
                      {s.tasks.map((t) => (
                        <div key={t.id} className="px-4 py-2 flex items-center gap-3">
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            t.model === "opus" ? "bg-purple-500/15 text-purple-400" :
                            t.model === "sonnet" ? "bg-blue-500/15 text-blue-400" :
                            "bg-gray-500/15 text-gray-400"
                          }`}>
                            {t.model[0].toUpperCase()}
                          </span>
                          <span className="text-sm text-text-primary flex-1">{t.name}</span>
                          <span className={`text-[10px] ${
                            t.difficulty === "hard" ? "text-red-400" :
                            t.difficulty === "medium" ? "text-yellow-400" :
                            "text-green-400"
                          }`}>
                            {"●".repeat(t.difficulty === "hard" ? 3 : t.difficulty === "medium" ? 2 : 1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {!generating && tree && tree.milestones.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-border-subtle">
          <button
            onClick={generatePlan}
            className="text-sm text-text-muted hover:text-text-secondary cursor-pointer"
          >
            다시 생성
          </button>
          <button
            onClick={handleApprove}
            className="px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium cursor-pointer"
          >
            승인하고 시작
          </button>
        </div>
      )}
    </div>
  );
}
