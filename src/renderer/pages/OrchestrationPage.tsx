import React, { useMemo, useState } from "react";
import { useAppStore } from "../stores/app-store";
import { StatusDot } from "../components/StatusDot";
import { toast } from "../components/Toast";
import type { AgentStatus, PipelineStep, SpecCard } from "@shared/types";

/**
 * 선택된 에이전트 + specCard hints로 전체 파이프라인 흐름 생성
 * Director → [after_planner 그룹] → Generator ↔ Evaluator + [after_generator 그룹]
 */
function buildFullPipeline(
  agents: { id: string; displayName: string; icon: string; trigger?: string }[],
  specCard: SpecCard | null,
): PipelineStep[] {
  const hints = specCard?.directorHints;
  const steps: PipelineStep[] = [];
  let idx = 0;

  const coreIds = new Set(["director", "planner", "generator", "evaluator"]);

  // 에이전트를 trigger 기준으로 분류
  const director = agents.find(a => a.id === "director");
  const planner = agents.find(a => a.id === "planner");
  const generator = agents.find(a => a.id === "generator");
  const evaluator = agents.find(a => a.id === "evaluator");
  const afterPlanner = agents.filter(a =>
    (a.trigger === "after_planner") && !coreIds.has(a.id)
  );
  const afterGenerator = agents.filter(a =>
    (a.trigger === "after_generator" || a.trigger === "after_evaluator") && !coreIds.has(a.id)
  );

  // 1. Director (항상 최상위)
  if (director) {
    steps.push({
      id: `flow-${idx++}`, agentId: "director", type: "plan",
      displayName: director.displayName,
      description: "방향 수립 + 작업 분배",
    });
  }

  // 2. Planner
  if (planner) {
    steps.push({
      id: `flow-${idx++}`, agentId: "planner", type: "plan",
      displayName: planner.displayName,
      description: "기능 분해 + 구현 계획",
    });
  }

  // 3. After-Planner 에이전트들 (설계 단계)
  for (const a of afterPlanner) {
    steps.push({
      id: `flow-${idx++}`, agentId: a.id, type: "design",
      displayName: a.displayName,
      description: `${a.displayName} 작업`,
    });
  }

  // 3.5 suggestedPhases에서 추가 단계 (design, compliance 등 — 에이전트가 없어도)
  if (hints?.suggestedPhases) {
    for (const phase of hints.suggestedPhases) {
      if (phase === "design" && !afterPlanner.some(a => a.id === "designer") && !steps.some(s => s.type === "design")) {
        steps.push({
          id: `flow-${idx++}`, agentId: "generator", type: "design",
          displayName: "설계",
          description: hints.domainContext ? `${hints.domainContext} 설계` : "프로젝트 설계",
        });
      }
      if (phase === "compliance" && !steps.some(s => s.displayName.includes("규정"))) {
        steps.push({
          id: `flow-${idx++}`, agentId: "generator", type: "custom",
          displayName: "규정 검토",
          description: hints.reviewFocus?.join(", ") ?? "법률/규정 준수 확인",
        });
      }
      if (phase === "security" && !steps.some(s => s.displayName.includes("보안"))) {
        steps.push({
          id: `flow-${idx++}`, agentId: "generator", type: "custom",
          displayName: "보안 감사",
          description: "보안 취약점 점검",
        });
      }
      if (phase === "data-modeling" && !steps.some(s => s.displayName.includes("데이터"))) {
        steps.push({
          id: `flow-${idx++}`, agentId: "generator", type: "custom",
          displayName: "데이터 모델링",
          description: "DB 스키마/모델 설계",
        });
      }
    }
  }

  // 4. Generator (구현)
  if (generator) {
    steps.push({
      id: `flow-${idx++}`, agentId: "generator", type: "generate",
      displayName: generator.displayName,
      description: "기능별 코드 구현",
      loop: { maxRetries: 3, pairedWith: "evaluator" },
    });
  }

  // 5. After-Generator 에이전트들 (검증 보조)
  for (const a of afterGenerator) {
    steps.push({
      id: `flow-${idx++}`, agentId: a.id, type: "evaluate",
      displayName: a.displayName,
      description: `${a.displayName} 검증`,
    });
  }

  // 6. Evaluator (최종 검증)
  if (evaluator) {
    steps.push({
      id: `flow-${idx++}`, agentId: "evaluator", type: "evaluate",
      displayName: evaluator.displayName,
      description: hints?.reviewFocus?.length
        ? `검증 — ${hints.reviewFocus.join(", ")}`
        : "코드 빌드/실행/스펙 검증",
      loop: { maxRetries: 3, pairedWith: "generator" },
    });
  }

  // 7. 수동(manual) 에이전트는 별도로 끝에 (파이프라인 외)
  // → UI의 "기타 에이전트" 섹션에 표시

  return steps;
}

export function OrchestrationPage({ specCard }: { specCard?: SpecCard | null }) {
  const { agents, pipeline, features, currentProjectId } = useAppStore();

  const agentMap = useMemo(() => {
    const map = new Map<string, typeof agents[0]>();
    agents.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents]);

  // 에이전트 trigger 정보 (없으면 id로 추론)
  const agentsWithTrigger = useMemo(() => {
    return agents.map(a => ({
      ...a,
      trigger: a.trigger ?? inferTrigger(a.id),
    }));
  }, [agents]);

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

  // 우선순위: 실행중 파이프라인 > 에이전트 기반 동적 구성 > 기본 3단계
  const steps = pipeline.steps.length > 0
    ? pipeline.steps
    : agents.length > 0
      ? buildFullPipeline(agentsWithTrigger, specCard ?? null)
      : DEFAULT_STEPS;

  const isPreview = pipeline.steps.length === 0;

  // 파이프라인에 포함된 agentId 목록 (중복 agentId도 처리)
  const pipelineAgentIds = new Set(steps.map(s => s.agentId));
  // manual trigger만 기타 에이전트로 표시 (core 에이전트는 항상 파이프라인에 포함)
  const extraAgents = agents.filter(a =>
    !pipelineAgentIds.has(a.id)
    && a.trigger === "manual"
    && !["director", "planner", "generator", "evaluator"].includes(a.id),
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-lg font-medium text-text-primary">파이프라인 오케스트레이션</h1>
        <p className="text-xs text-text-secondary mt-0.5">
          {!isPreview
            ? `실행중: ${steps.map(s => s.displayName).join(" → ")}`
            : `${steps.map(s => s.displayName).join(" → ")} ${agents.length > 4 ? `(${agents.length}개 에이전트)` : ""}`
          }
        </p>
      </div>

      {/* Pipeline Status + Controls */}
      <div className="p-4 bg-bg-card border border-border-subtle rounded-card">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-medium text-text-secondary uppercase tracking-wide">파이프라인 상태</div>
          <PipelineStatusBadge status={pipeline.status} />
        </div>
        {pipeline.totalFeatures > 0 && (
          <div className="mb-3">
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
        <PipelineControls
          status={pipeline.status}
          projectId={currentProjectId}
        />
      </div>

      {/* Dynamic Flow Diagram */}
      <div className={`p-4 bg-bg-card border rounded-card ${isPreview ? "border-dashed border-border-strong" : "border-border-subtle"}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className="text-xs font-medium text-text-secondary uppercase tracking-wide">에이전트 흐름</div>
          {isPreview && agents.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-accent/10 text-accent rounded-badge">
              {specCard?.directorHints ? "예상 흐름" : "기본 흐름"}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {steps.map((step, idx) => {
            const agent = agentMap.get(step.agentId);
            const isActive = pipeline.activeStepId === step.id;
            const isCompleted = pipeline.completedStepIds.includes(step.id);
            const agentStatus: AgentStatus = isActive ? "running" : isCompleted ? "completed" : "queued";

            return (
              <React.Fragment key={step.id}>
                {idx > 0 && <FlowArrow />}
                <StepFlowNode
                  step={step}
                  icon={agent?.icon ?? STEP_ICONS[step.type] ?? "⚙️"}
                  status={agentStatus}
                  isActive={isActive}
                />
              </React.Fragment>
            );
          })}

          {/* Retry indicator for generate↔evaluate loop */}
          {steps.some(s => s.loop) && (
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
              <span className="text-[10px] text-text-muted">재시도</span>
            </div>
          )}
        </div>
      </div>

      {/* Feature Assignment */}
      <div className="p-4 bg-bg-card border border-border-subtle rounded-card">
        <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">
          기능 할당
        </div>

        {features.length === 0 ? (
          <div className="text-xs text-text-muted italic py-2 text-center">
            Discovery 후 Director가 기능을 생성합니다.
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
                  {feature.status === "in_progress" && "💻 구현중"}
                  {feature.status === "evaluating" && "🔍 검증중"}
                  {feature.status === "completed" && "✅ 완료"}
                  {feature.status === "failed" && "❌ 실패"}
                  {feature.status === "pending" && "⏳ 대기"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extra agents (not in pipeline flow) */}
      {extraAgents.length > 0 && (
        <div className="p-4 bg-bg-card border border-border-subtle rounded-card">
          <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">
            기타 에이전트
          </div>
          <div className="grid grid-cols-2 gap-2">
            {extraAgents.map((agent) => (
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

/** trigger가 없는 에이전트의 trigger를 id로 추론 */
function inferTrigger(agentId: string): string {
  // 코어 에이전트 — director/planner는 파이프라인 앞부분에 배치
  if (agentId === "director") return "core_director";
  if (agentId === "planner") return "core_planner";
  if (agentId === "generator") return "after_planner";
  if (agentId === "evaluator") return "after_generator";
  // 설계/기획 관련 → after_planner
  if (/designer|architect|writer|modeler/.test(agentId)) return "after_planner";
  // 나머지 (검증/테스트 관련) → after_generator
  return "after_generator";
}

// ── 단계 유형별 기본 아이콘 ──
const STEP_ICONS: Record<string, string> = {
  plan: "🔧",
  design: "🎨",
  generate: "💻",
  evaluate: "🔍",
  custom: "⚙️",
};

// ── 에이전트가 아직 없을 때 기본 ──
const DEFAULT_STEPS: PipelineStep[] = [
  { id: "default-plan", agentId: "planner", displayName: "기획", type: "plan", description: "스펙을 기능 단위로 분해" },
  { id: "default-gen", agentId: "generator", displayName: "구현", type: "generate", description: "각 기능의 코드 작성" },
  { id: "default-eval", agentId: "evaluator", displayName: "검증", type: "evaluate", description: "코드 품질 검증" },
];

function StepFlowNode({
  step,
  icon,
  status,
  isActive,
}: {
  step: PipelineStep;
  icon: string;
  status: AgentStatus;
  isActive: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center p-3 rounded-card border-2 w-28 transition-all ${
        isActive
          ? "border-accent bg-accent/5 shadow-lg shadow-accent/10 scale-105"
          : status === "completed"
            ? "border-status-success/50 bg-status-success/5"
            : "border-border-subtle bg-bg-card"
      }`}
      title={step.description}
    >
      <span className="text-xl mb-0.5">{icon}</span>
      <span className="text-xs font-medium text-text-primary">{step.displayName}</span>
      <StatusDot status={status} size="sm" />
      <span className="text-[10px] text-text-muted text-center mt-0.5 leading-tight line-clamp-2">{step.description}</span>
      {isActive && (
        <span className="text-[9px] text-accent mt-1 animate-pulse">실행중...</span>
      )}
      {status === "completed" && (
        <span className="text-[9px] text-status-success mt-0.5">완료</span>
      )}
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center shrink-0">
      <div className="w-5 h-0.5 bg-border-strong" />
      <div className="w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[5px] border-l-border-strong" />
    </div>
  );
}

function PipelineControls({ status, projectId }: { status: string; projectId: string | null }) {
  const [confirming, setConfirming] = useState<"stop" | null>(null);
  const { gsdPipeline } = useAppStore();

  const isRunning = gsdPipeline.isRunning;
  const isStopped = !isRunning;

  const handleStart = async () => {
    if (!projectId) return;
    const project = await window.harness.project.load(projectId);
    const workingDir = project?.workingDir || ".";

    toast("info", "GSD 파이프라인", "시작 중...");
    const result = await window.harness.gsd.startPipeline({
      projectDir: workingDir,
      prompt: project?.specCard?.projectType || "프로젝트 빌드",
    });

    if (!result.success) {
      toast("error", "GSD 파이프라인", result.error || "실패");
    }
  };

  const handleStop = async () => {
    if (confirming !== "stop") {
      setConfirming("stop");
      setTimeout(() => setConfirming(null), 3000);
      return;
    }
    setConfirming(null);
    await window.harness.gsd.stop();
    toast("warning", "파이프라인", "강제 중단됨");
    useAppStore.getState().updateGsdPipeline({ isRunning: false });
  };

  return (
    <div className="flex items-center gap-2">
      {/* 시작 */}
      {isStopped && projectId && (
        <ControlButton onClick={handleStart} icon="▶" label="GSD 시작" variant="accent" />
      )}

      {/* 중단 */}
      {isRunning && (
        <ControlButton
          onClick={handleStop}
          icon="⏹"
          label={confirming === "stop" ? "확인?" : "중단"}
          variant={confirming === "stop" ? "danger-confirm" : "danger"}
        />
      )}

      {/* 비용 표시 */}
      {gsdPipeline.cost > 0 && (
        <span className="text-[10px] text-text-muted ml-2">
          ${gsdPipeline.cost.toFixed(3)}
        </span>
      )}

      {/* 현재 단계 */}
      {gsdPipeline.currentStep && (
        <span className="text-[10px] text-accent ml-1">
          {gsdPipeline.currentPhase} / {gsdPipeline.currentStep}
        </span>
      )}
    </div>
  );
}

function ControlButton({ onClick, icon, label, variant = "default" }: {
  onClick: () => void;
  icon: string;
  label: string;
  variant?: "default" | "accent" | "danger" | "danger-confirm";
}) {
  const colors = {
    default: "border-border-subtle text-text-secondary hover:border-border-strong hover:bg-bg-hover",
    accent: "border-accent/50 text-accent hover:bg-accent/10",
    danger: "border-status-error/30 text-status-error/70 hover:border-status-error hover:bg-status-error/10",
    "danger-confirm": "border-status-error bg-status-error/20 text-status-error animate-pulse",
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition-all ${colors[variant]}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
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
