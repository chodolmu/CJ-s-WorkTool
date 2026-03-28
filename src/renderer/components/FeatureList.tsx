import React from "react";
import type { FeatureStatus } from "@shared/types";

export interface FeatureItem {
  id: string;
  name: string;
  description: string;
  order: number;
  status: FeatureStatus;
}

interface FeatureListProps {
  features: FeatureItem[];
}

const statusConfig: Record<FeatureStatus, { icon: string; color: string }> = {
  pending:     { icon: "⏳", color: "text-text-muted" },
  in_progress: { icon: "🔄", color: "text-status-info" },
  evaluating:  { icon: "🔍", color: "text-status-warning" },
  completed:   { icon: "✅", color: "text-status-success" },
  failed:      { icon: "❌", color: "text-status-error" },
};

export function FeatureList({ features }: FeatureListProps) {
  if (features.length === 0) {
    return (
      <div className="text-xs text-text-muted italic py-4 text-center">
        아직 기능이 없습니다. Discovery 후 Planner가 생성합니다.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-xs text-text-secondary uppercase tracking-wide mb-2">
        기능 ({features.filter((f) => f.status === "completed").length}/{features.length})
      </div>
      {features.map((feature) => {
        const config = statusConfig[feature.status];
        return (
          <div
            key={feature.id}
            className="flex items-start gap-2 p-2 bg-bg-card border border-border-subtle rounded-md"
          >
            <span className="text-sm shrink-0 mt-0.5">{config.icon}</span>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${config.color}`}>
                {feature.order}. {feature.name}
              </div>
              {feature.description && (
                <div className="text-xs text-text-muted truncate mt-0.5">
                  {feature.description}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
