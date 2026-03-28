import React from "react";
import type { SpecCard } from "@shared/types";

interface SpecCardReviewProps {
  specCard: SpecCard;
  onToggleExpansion: (id: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export function SpecCardReview({
  specCard,
  onToggleExpansion,
  onConfirm,
  onBack,
}: SpecCardReviewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto">
      <h2 className="text-lg font-medium text-text-primary mb-6">
        스펙 확인
      </h2>

      <div className="w-full bg-bg-card border border-border-subtle rounded-card overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-accent/10 border-b border-border-subtle">
          <div className="text-sm font-medium text-accent">
            {specCard.projectType}
          </div>
        </div>

        {/* Core decisions */}
        <div className="p-4 border-b border-border-subtle">
          <div className="text-xs text-text-secondary mb-2 uppercase tracking-wide">
            핵심 (당신의 결정)
          </div>
          <div className="space-y-2">
            {specCard.coreDecisions.map((d) => (
              <div key={d.key} className="flex items-start justify-between">
                <span className="text-xs text-text-secondary">{d.label}</span>
                <span className="text-sm text-text-primary font-medium text-right max-w-[60%]">
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Expansions */}
        <div className="p-4 border-b border-border-subtle">
          <div className="text-xs text-text-secondary mb-2 uppercase tracking-wide">
            확장 기능 (AI 추천)
          </div>
          <div className="space-y-1.5">
            {specCard.expansions.map((exp) => (
              <label
                key={exp.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={exp.enabled}
                  onChange={() => onToggleExpansion(exp.id)}
                  className="w-3.5 h-3.5 rounded border-border-strong accent-accent"
                />
                <span
                  className={`text-sm ${exp.enabled ? "text-text-primary" : "text-text-muted"}`}
                >
                  {exp.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Tech stack */}
        <div className="p-4">
          <div className="text-xs text-text-secondary mb-2 uppercase tracking-wide">
            기술 스택 (AI 선정)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {specCard.techStack.map((tech) => (
              <span
                key={tech}
                className="px-2 py-0.5 bg-bg-hover border border-border-subtle rounded-badge text-xs text-text-secondary"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          ← 수정
        </button>
        <button
          onClick={onConfirm}
          className="px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-button text-sm font-medium transition-colors cursor-pointer"
        >
          다음: 에이전트 선택 →
        </button>
      </div>
    </div>
  );
}
