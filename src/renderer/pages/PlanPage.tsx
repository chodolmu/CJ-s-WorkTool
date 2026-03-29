import React, { useState, useEffect } from "react";
import type { PlanDocument, PlanChangeLog, FeatureStatus } from "@shared/types";

const STATUS_COLORS: Record<FeatureStatus, string> = {
  pending: "bg-gray-500/20 text-gray-400",
  in_progress: "bg-blue-500/20 text-blue-400",
  evaluating: "bg-yellow-500/20 text-yellow-400",
  completed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
};

const STATUS_LABELS: Record<FeatureStatus, string> = {
  pending: "대기",
  in_progress: "진행중",
  evaluating: "검증중",
  completed: "완료",
  failed: "실패",
};

const ACTION_LABELS: Record<PlanChangeLog["action"], string> = {
  plan_created: "계획 생성",
  feature_added: "기능 추가",
  feature_removed: "기능 제거",
  feature_status_changed: "상태 변경",
  feature_completed: "기능 완료",
  schedule_updated: "일정 변경",
  agent_changed: "에이전트 변경",
  feature_requested: "기능 요청",
};

interface PlanPageProps {
  projectId: string;
}

export function PlanPage({ projectId }: PlanPageProps) {
  const [plan, setPlan] = useState<PlanDocument | null>(null);
  const [matchRate, setMatchRate] = useState<{ rate: number; missing: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlan();
  }, [projectId]);

  async function loadPlan() {
    setLoading(true);
    try {
      if (window.harness) {
        const [planData, matchData] = await Promise.all([
          (window.harness as any).plan.get(projectId),
          (window.harness as any).plan.getMatchRate(projectId),
        ]);
        setPlan(planData);
        setMatchRate(matchData);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-text-muted text-sm">계획 로딩중...</div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-sm text-text-muted">계획 문서가 아직 없습니다</p>
        <p className="text-xs text-text-secondary mt-1">Discovery를 완료하면 자동으로 생성됩니다</p>
      </div>
    );
  }

  const completedCount = plan.features.filter((f) => f.status === "completed").length;
  const totalCount = plan.features.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{plan.overview}</h2>
          <div className="flex items-center gap-2 mt-1.5">
            {plan.specSummary.techStack.map((t) => (
              <span key={t} className="px-1.5 py-0.5 text-[9px] bg-accent/10 text-accent rounded">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* 일치도 뱃지 */}
        {matchRate && (
          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
            matchRate.rate >= 90 ? "bg-green-500/15 text-green-400" :
            matchRate.rate >= 70 ? "bg-yellow-500/15 text-yellow-400" :
            "bg-red-500/15 text-red-400"
          }`}>
            스펙 일치도 {matchRate.rate}%
            {matchRate.missing.length > 0 && (
              <span className="ml-1 text-[10px] opacity-70">({matchRate.missing.length}개 누락)</span>
            )}
          </div>
        )}
      </div>

      {/* 진행률 바 */}
      <div>
        <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
          <span>기능 진행률</span>
          <span>{completedCount}/{totalCount} ({progressPct}%)</span>
        </div>
        <div className="h-1.5 bg-bg-card rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* 기능 목록 */}
      <div>
        <h3 className="text-xs font-medium text-text-secondary mb-2">기능 목록 ({totalCount})</h3>
        <div className="space-y-1">
          {plan.features.map((f) => (
            <div key={f.featureId} className="flex items-center gap-2 px-3 py-2 bg-bg-card rounded-lg border border-border-subtle">
              <span className={`px-1.5 py-0.5 text-[9px] rounded ${STATUS_COLORS[f.status]}`}>
                {STATUS_LABELS[f.status]}
              </span>
              <span className="text-xs text-text-primary flex-1">{f.name}</span>
              {f.assignedAgent && (
                <span className="text-[9px] text-text-muted">{f.assignedAgent}</span>
              )}
              {f.estimatedStart && f.estimatedEnd && (
                <span className="text-[9px] text-text-muted">
                  {new Date(f.estimatedStart).toLocaleDateString("ko")} ~ {new Date(f.estimatedEnd).toLocaleDateString("ko")}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 에이전트 팀 */}
      <div>
        <h3 className="text-xs font-medium text-text-secondary mb-2">에이전트 팀</h3>
        <div className="flex gap-2 flex-wrap">
          {plan.agentTeam.map((a) => (
            <div key={a.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-card rounded-lg border border-border-subtle">
              <span className="text-sm">{a.icon}</span>
              <div>
                <p className="text-[10px] text-text-primary font-medium">{a.displayName}</p>
                <p className="text-[8px] text-text-muted">{a.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 누락 경고 */}
      {matchRate && matchRate.missing.length > 0 && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <h3 className="text-xs font-medium text-red-400 mb-1.5">스펙에서 누락 가능성</h3>
          <div className="space-y-1">
            {matchRate.missing.map((m) => (
              <p key={m} className="text-[10px] text-red-300">- {m}</p>
            ))}
          </div>
        </div>
      )}

      {/* 변경 이력 */}
      <div>
        <h3 className="text-xs font-medium text-text-secondary mb-2">변경 이력</h3>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {[...plan.changeLog].reverse().map((log, i) => (
            <div key={i} className="flex items-start gap-2 text-[10px]">
              <span className="text-text-muted shrink-0 w-24">
                {new Date(log.date).toLocaleString("ko", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="px-1 py-px bg-bg-card rounded text-text-muted shrink-0">
                {ACTION_LABELS[log.action]}
              </span>
              <span className="text-text-secondary">{log.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
