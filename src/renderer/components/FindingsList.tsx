import React from "react";
import type { Finding } from "@shared/types";

interface FindingsListProps {
  findings: Finding[];
  title?: string;
}

const severityConfig: Record<Finding["severity"], { icon: string; color: string; bgColor: string }> = {
  error:   { icon: "❌", color: "text-status-error",   bgColor: "bg-status-error/10" },
  warning: { icon: "⚠️", color: "text-status-warning", bgColor: "bg-status-warning/10" },
  info:    { icon: "ℹ️", color: "text-status-info",    bgColor: "bg-status-info/10" },
};

export function FindingsList({ findings, title = "Evaluator 검증 결과" }: FindingsListProps) {
  if (findings.length === 0) {
    return (
      <div className="text-xs text-text-muted italic py-2 text-center">
        보고된 결과가 없습니다.
      </div>
    );
  }

  const errorCount = findings.filter((f) => f.severity === "error").length;
  const warnCount = findings.filter((f) => f.severity === "warning").length;
  const infoCount = findings.filter((f) => f.severity === "info").length;

  return (
    <div className="space-y-2">
      {/* Header with counts */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          {title}
        </div>
        <div className="flex gap-2 text-[10px]">
          {errorCount > 0 && (
            <span className="text-status-error">{errorCount} 오류</span>
          )}
          {warnCount > 0 && (
            <span className="text-status-warning">{warnCount} 경고</span>
          )}
          {infoCount > 0 && (
            <span className="text-status-info">{infoCount} 정보</span>
          )}
        </div>
      </div>

      {/* Findings */}
      {findings.map((finding, i) => {
        const config = severityConfig[finding.severity];
        return (
          <div
            key={i}
            className={`flex items-start gap-2 p-2.5 rounded-md border border-border-subtle ${config.bgColor}`}
          >
            <span className="text-sm shrink-0">{config.icon}</span>
            <div className="flex-1 min-w-0">
              {/* 비전공자용 요약 */}
              <div className={`text-sm font-medium ${config.color}`}>
                {finding.summaryForUser}
              </div>
              {/* 기술적 상세 */}
              {finding.message !== finding.summaryForUser && (
                <div className="text-xs text-text-muted mt-0.5 font-mono">
                  {finding.message}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
