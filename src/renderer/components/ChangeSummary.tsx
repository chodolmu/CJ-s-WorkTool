import React from "react";
interface ChangeSummaryProps {
  summary: string;
  filesChanged: string[];
  agentName: string;
}

export function ChangeSummary({ summary, filesChanged, agentName }: ChangeSummaryProps) {
  return (
    <div className="p-3 bg-bg-card border border-border-subtle rounded-card">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-accent uppercase tracking-wide">
          변경 요약
        </span>
        <span className="text-xs text-text-muted">{agentName}</span>
      </div>

      <p className="text-sm text-text-primary leading-relaxed mb-2">
        {summary}
      </p>

      {filesChanged.length > 0 && (
        <div className="pt-2 border-t border-border-subtle">
          <div className="text-xs text-text-muted mb-1">
            변경된 파일 ({filesChanged.length}):
          </div>
          <div className="flex flex-wrap gap-1">
            {filesChanged.map((file) => (
              <span
                key={file}
                className="px-1.5 py-0.5 bg-bg-hover border border-border-subtle rounded text-xs text-text-secondary font-mono"
              >
                {file}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
