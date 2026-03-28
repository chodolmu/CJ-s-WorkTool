import React, { useMemo } from "react";
import { useAppStore } from "../stores/app-store";
import { FeatureList } from "../components/FeatureList";
import { ProgressBar } from "../components/ProgressBar";
import type { SpecCard } from "@shared/types";

interface SpecsPageProps {
  specCard: SpecCard | null;
}

export function SpecsPage({ specCard }: SpecsPageProps) {
  const { features, pipeline, projectName } = useAppStore();

  const completedCount = useMemo(
    () => features.filter((f) => f.status === "completed").length,
    [features],
  );

  if (!specCard) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <span className="text-3xl mb-3">📋</span>
        <h2 className="text-lg font-medium mb-1">스펙 & 대시보드</h2>
        <p className="text-sm text-text-secondary">
          Discovery를 완료하면 프로젝트 스펙 카드와 진행 상황을 여기서 볼 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-medium text-text-primary">{projectName ?? "프로젝트"} — 스펙</h1>
        <p className="text-xs text-text-secondary mt-0.5">
          프로젝트 스펙 카드, 기능 목록, 전체 진행률
        </p>
      </div>

      {/* Overall progress */}
      {features.length > 0 && (
        <div className="p-4 bg-bg-card border border-border-subtle rounded-card">
          <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">진행률</div>
          <ProgressBar
            completed={completedCount}
            total={features.length}
            currentLabel={pipeline.currentFeature}
          />
          <div className="flex gap-4 mt-3 text-xs text-text-secondary">
            <span>파이프라인: <span className="text-text-primary capitalize">{pipeline.status}</span></span>
            <span>기능: <span className="text-text-primary">{completedCount}/{features.length}</span></span>
          </div>
        </div>
      )}

      {/* Spec Card */}
      <div className="p-4 bg-bg-card border border-border-subtle rounded-card space-y-4">
        <div className="text-xs font-medium text-text-secondary uppercase tracking-wide">스펙 카드</div>

        {/* Project type */}
        <div className="p-3 bg-bg-hover rounded-lg">
          <div className="text-xs text-text-muted mb-1">프로젝트 유형</div>
          <div className="text-sm text-text-primary font-medium">{specCard.projectType}</div>
        </div>

        {/* Core Decisions */}
        <div>
          <div className="text-xs text-text-muted mb-2">핵심 결정사항</div>
          <div className="grid grid-cols-2 gap-2">
            {specCard.coreDecisions.map((d) => (
              <div key={d.key} className="p-2.5 bg-bg-hover rounded-lg">
                <div className="text-[10px] text-text-muted uppercase">{d.label}</div>
                <div className="text-sm text-text-primary mt-0.5">{d.value}</div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  {d.source === "user" ? "👤 User" : "🤖 AI"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div>
          <div className="text-xs text-text-muted mb-2">기술 스택</div>
          <div className="flex flex-wrap gap-1.5">
            {specCard.techStack.map((tech) => (
              <span
                key={tech}
                className="px-2 py-1 bg-accent/10 text-accent text-xs rounded-badge font-medium"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* Expansions */}
        <div>
          <div className="text-xs text-text-muted mb-2">확장 기능</div>
          <div className="space-y-1">
            {specCard.expansions.map((exp) => (
              <div
                key={exp.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  exp.enabled
                    ? "bg-status-success/10 text-text-primary"
                    : "bg-bg-hover text-text-muted line-through"
                }`}
              >
                <span>{exp.enabled ? "✅" : "⬜"}</span>
                <span>{exp.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature List */}
      <div className="p-4 bg-bg-card border border-border-subtle rounded-card">
        <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">기능</div>
        <FeatureList features={features} />
      </div>

      {/* Discovery Decisions — coreDecisions에 이미 한글 label로 포함되어 있으므로 별도 표시 불필요 */}
    </div>
  );
}
