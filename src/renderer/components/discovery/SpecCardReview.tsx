import React from "react";
import type { SpecCard } from "@shared/types";

interface SpecCardReviewProps {
  specCard: SpecCard;
  onUpdate: (specCard: SpecCard) => void;
}

export function SpecCardReview({ specCard, onUpdate }: SpecCardReviewProps) {
  return (
    <div className="w-full bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-accent/10 border-b border-border-subtle">
        <div className="text-sm font-medium text-accent">
          {specCard.projectName || specCard.projectType}
        </div>
        {specCard.description && (
          <p className="text-xs text-text-muted mt-1">{specCard.description}</p>
        )}
      </div>

      {/* Core Decisions */}
      {specCard.coreDecisions.length > 0 && (
        <div className="p-4 border-b border-border-subtle">
          <div className="text-xs text-text-secondary mb-2 uppercase tracking-wide">
            핵심 결정
          </div>
          <ul className="space-y-1">
            {specCard.coreDecisions.map((d, i) => (
              <li key={i} className="text-sm text-text-primary flex items-start gap-2">
                <span className="text-accent mt-0.5">•</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Features */}
      {specCard.features.length > 0 && (
        <div className="p-4 border-b border-border-subtle">
          <div className="text-xs text-text-secondary mb-2 uppercase tracking-wide">
            핵심 기능
          </div>
          <ul className="space-y-1">
            {specCard.features.map((f, i) => (
              <li key={i} className="text-sm text-text-primary flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tech Stack */}
      {specCard.techStack.length > 0 && (
        <div className="p-4">
          <div className="text-xs text-text-secondary mb-2 uppercase tracking-wide">
            기술 스택
          </div>
          <div className="flex flex-wrap gap-1.5">
            {specCard.techStack.map((tech) => (
              <span
                key={tech}
                className="px-2 py-0.5 bg-bg-hover border border-border-subtle rounded text-xs text-text-secondary"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
