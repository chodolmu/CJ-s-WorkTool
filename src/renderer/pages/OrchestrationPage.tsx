import React, { useMemo } from "react";
import { useAppStore } from "../stores/app-store";
import { StatusDot } from "../components/StatusDot";
import type { AgentStatus } from "@shared/types";

export function OrchestrationPage() {
  const { agents, pipeline, features, currentProjectId } = useAppStore();

  const agentMap = useMemo(() => {
    const map = new Map<string, typeof agents[0]>();
    agents.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents]);

  const planner = agentMap.get("planner");
  const generator = agentMap.get("generator");
  const evaluator = agentMap.get("evaluator");

  if (!currentProjectId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <span className="text-3xl mb-3">🔄</span>
        <h2 className="text-lg font-medium mb-1">파이프라인 오케스트레이션</h2>
        <p className="text-sm text-text-secondary">
          프로젝트를 시작하면 파이프라인 흐름을 볼 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-lg font-medium text-text-primary">파이프라인 오케스트레이션</h1>
        <p className="text-xs text-text-secondary mt-0.5">
          Planner → Generator → Evaluator 흐름 시각화
        </p>
      </div>

      {/* Pipeline Status */}
      <div className="p-4 bg-bg-card border border-border-subtle rounded-card">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-medium text-text-secondary uppercase tracking-wide">파이프라인 상태</div>
          <PipelineStatusBadge status={pipeline.status} />
        </div>
        {pipeline.totalFeatures > 0 && (
          <div>
            <div className="flex justify-between text-xs text-text-secondary mb-1">
              <span>{pipeline.currentFeature ?? "준비"}</span>
              <span>{pipeline.completedFeatures}/{pipeline.totalFeatures} 기능</span>
            </div>
            <div className="w-full h-2 bg-bg-active rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-700"
                style={{ width: `${(pipeline.completedFeatures / pipeline.totalFeatures) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Flow Diagram */}
      <div className="p-4 bg-bg-card border border-border-subtle rounded-card">
        <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-4">에이전트 흐름</div>

        <div className="flex items-center justify-center gap-2">
          {/* Planner */}
          <AgentFlowNode
            icon="🔧"
            name="Planner"
            status={planner?.status ?? "queued"}
            description="스펙을 기능 단위로 분해"
            isActive={planner?.status === "running"}
          />

          <FlowArrow />

          {/* Generator */}
          <AgentFlowNode
            icon="💻"
            name="Generator"
            status={generator?.status ?? "queued"}
            description="각 기능의 코드 작성"
            isActive={generator?.status === "running"}
            currentTask={generator?.currentFeature}
          />

          <FlowArrow />

          {/* Evaluator */}
          <AgentFlowNode
            icon="🔍"
            name="Evaluator"
            status={evaluator?.status ?? "queued"}
            description="코드 품질 검증"
            isActive={evaluator?.status === "running"}
            currentTask={evaluator?.currentFeature}
          />

          {/* Retry arrow back to Generator */}
          <div className="flex flex-col items-center ml-2">
            <span className="text-[10px] text-status-warning">실패?</span>
            <svg width="40" height="30" className="text-status-warning">
              <path d="M5,5 Q20,25 35,5" stroke="currentColor" fill="none" strokeWidth="1.5" strokeDasharray="3,3" markerEnd="url(#arrowRetry)" />
              <defs>
                <marker id="arrowRetry" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6" fill="currentColor" />
                </marker>
              </defs>
            </svg>
            <span className="text-[10px] text-text-muted">재시도 (최대 3회)</span>
          </div>
        </div>
      </div>

      {/* Feature Assignment */}
      <div className="p-4 bg-bg-card border border-border-subtle rounded-card">
        <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">
          기능 할당
        </div>

        {features.length === 0 ? (
          <div className="text-xs text-text-muted italic py-2 text-center">
            Discovery 후 Planner가 기능을 생성합니다.
          </div>
        ) : (
          <div className="space-y-1.5">
            {features.map((feature) => (
              <div
                key={feature.id}
                className="flex items-center gap-3 p-2.5 bg-bg-hover rounded-md"
              >
                <span className="text-xs text-text-muted w-5 text-right shrink-0">
                  {feature.order}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">{feature.name}</div>
                </div>
                <FeatureStatusPill status={feature.status} />
                <div className="text-xs text-text-muted shrink-0 w-20 text-right">
                  {feature.status === "in_progress" && "💻 Generator"}
                  {feature.status === "evaluating" && "🔍 Evaluator"}
                  {feature.status === "completed" && "✅ 완료"}
                  {feature.status === "failed" && "❌ 실패"}
                  {feature.status === "pending" && "⏳ 대기"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extra agents (non-core) */}
      {agents.filter((a) => !["planner", "generator", "evaluator"].includes(a.id)).length > 0 && (
        <div className="p-4 bg-bg-card border border-border-subtle rounded-card">
          <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">
            커스텀 에이전트
          </div>
          <div className="grid grid-cols-2 gap-2">
            {agents
              .filter((a) => !["planner", "generator", "evaluator"].includes(a.id))
              .map((agent) => (
                <div key={agent.id} className="flex items-center gap-2 p-2.5 bg-bg-hover rounded-md">
                  <span className="text-sm">{agent.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary truncate">{agent.displayName}</div>
                  </div>
                  <StatusDot status={agent.status} size="sm" />
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentFlowNode({
  icon,
  name,
  status,
  description,
  isActive,
  currentTask,
}: {
  icon: string;
  name: string;
  status: AgentStatus;
  description: string;
  isActive: boolean;
  currentTask?: string | null;
}) {
  return (
    <div
      className={`flex flex-col items-center p-4 rounded-card border-2 w-36 transition-all ${
        isActive
          ? "border-accent bg-accent/5 shadow-lg shadow-accent/10"
          : status === "completed"
            ? "border-status-success/50 bg-status-success/5"
            : "border-border-subtle bg-bg-card"
      }`}
    >
      <span className="text-2xl mb-1">{icon}</span>
      <span className="text-sm font-medium text-text-primary">{name}</span>
      <StatusDot status={status} size="sm" />
      <span className="text-[10px] text-text-muted text-center mt-1">{description}</span>
      {currentTask && (
        <span className="text-[10px] text-accent mt-1 truncate max-w-full">
          → {currentTask}
        </span>
      )}
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center">
      <div className="w-8 h-0.5 bg-border-strong" />
      <div className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-6 border-l-border-strong" />
    </div>
  );
}

function PipelineStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    idle: { label: "대기", color: "text-text-muted bg-bg-hover" },
    running: { label: "실행중", color: "text-status-success bg-status-success/10" },
    paused: { label: "일시정지", color: "text-status-warning bg-status-warning/10" },
    waiting_checkpoint: { label: "대기중", color: "text-status-warning bg-status-warning/10" },
    completed: { label: "완료", color: "text-status-info bg-status-info/10" },
    failed: { label: "실패", color: "text-status-error bg-status-error/10" },
  };

  const c = config[status] ?? config.idle;
  return (
    <span className={`px-2 py-0.5 rounded-badge text-xs font-medium ${c.color}`}>
      {c.label}
    </span>
  );
}

function FeatureStatusPill({ status }: { status: string }) {
  const config: Record<string, string> = {
    pending: "bg-bg-active text-text-muted",
    in_progress: "bg-status-info/10 text-status-info",
    evaluating: "bg-status-warning/10 text-status-warning",
    completed: "bg-status-success/10 text-status-success",
    failed: "bg-status-error/10 text-status-error",
  };

  return (
    <span className={`px-2 py-0.5 rounded-badge text-[10px] font-medium ${config[status] ?? config.pending}`}>
      {status}
    </span>
  );
}
