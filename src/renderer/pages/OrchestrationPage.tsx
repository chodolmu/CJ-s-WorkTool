import React, { useMemo, useState } from "react";
import { useAppStore } from "../stores/app-store";
import { StatusDot } from "../components/StatusDot";
import { PhaseChat } from "../components/PhaseChat";
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

  if (director) {
    steps.push({
      id: `flow-${idx++}`, agentId: "director", type: "plan",
      displayName: director.displayName,
      description: "방향 수립 + 작업 분배",
    });
  }

  if (planner) {
    steps.push({
      id: `flow-${idx++}`, agentId: "planner", type: "plan",
      displayName: planner.displayName,
      description: "기능 분해 + 구현 계획",
    });
  }

  for (const a of afterPlanner) {
    steps.push({
      id: `flow-${idx++}`, agentId: a.id, type: "design",
      displayName: a.displayName,
      description: `${a.displayName} 작업`,
    });
  }

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

  if (generator) {
    steps.push({
      id: `flow-${idx++}`, agentId: "generator", type: "generate",
      displayName: generator.displayName,
      description: "기능별 코드 구현",
      loop: { maxRetries: 3, pairedWith: "evaluator" },
    });
  }

  for (const a of afterGenerator) {
    steps.push({
      id: `flow-${idx++}`, agentId: a.id, type: "evaluate",
      displayName: a.displayName,
      description: `${a.displayName} 검증`,
    });
  }

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

  return steps;
}

export function OrchestrationPage({ specCard }: { specCard?: SpecCard | null }) {
  const { agents, pipeline, features, currentProjectId, activePhaseChatStepId, setActivePhaseChatStep } = useAppStore();

  const projects = useAppStore((s) => s.projects);
  const currentProject = projects.find((p) => p.id === currentProjectId);
  const workingDir = currentProject?.workingDir || ".";

  const agentMap = useMemo(() => {
    const map = new Map<string, typeof agents[0]>();
    agents.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents]);

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

  const steps = pipeline.steps.length > 0
    ? pipeline.steps
    : agents.length > 0
      ? buildFullPipeline(agentsWithTrigger, specCard ?? null)
      : DEFAULT_STEPS;

  const isPreview = pipeline.steps.length === 0;

  const pipelineAgentIds = new Set(steps.map(s => s.agentId));
  const extraAgents = agents.filter(a =>
    !pipelineAgentIds.has(a.id)
    && a.trigger === "manual"
    && !["director", "planner", "generator", "evaluator"].includes(a.id),
  );

  // 선택된 스텝의 이름 찾기
  const selectedStep = steps.find(s => s.id === activePhaseChatStepId);

  return (
    <div className="flex h-full">
      {/* ── 좌측: 파이프라인 패널 ── */}
      <div className="w-[380px] shrink-0 border-r border-border-subtle overflow-y-auto p-4 space-y-4">
        <div>
          <h1 className="text-base font-medium text-text-primary">파이프라인</h1>
          <p className="text-[11px] text-text-secondary mt-0.5 truncate">
            {steps.map(s => s.displayName).join(" → ")}
          </p>
        </div>

        {/* Pipeline Status + Controls */}
        <div className="p-3 bg-bg-card border border-border-subtle rounded-card">
          <div className="flex items-center justify-between mb-2">
            <PipelineStatusBadge status={pipeline.status} />
            {pipeline.totalFeatures > 0 && (
              <span className="text-[10px] text-text-muted">
                {pipeline.completedFeatures}/{pipeline.totalFeatures}
              </span>
            )}
          </div>
          {pipeline.totalFeatures > 0 && (
            <div className="mb-2">
              <div className="w-full h-1.5 bg-bg-active rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-700"
                  style={{ width: `${(pipeline.completedFeatures / pipeline.totalFeatures) * 100}%` }}
                />
              </div>
            </div>
          )}
          <PipelineControls status={pipeline.status} projectId={currentProjectId} />
        </div>

        {/* Vertical Flow Diagram */}
        <div className={`p-3 bg-bg-card border rounded-card ${isPreview ? "border-dashed border-border-strong" : "border-border-subtle"}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">흐름</div>
            {isPreview && agents.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-accent/10 text-accent rounded-badge">
                {specCard?.directorHints ? "예상" : "기본"}
              </span>
            )}
          </div>

          <div className="space-y-1">
            {steps.map((step, idx) => {
              const agent = agentMap.get(step.agentId);
              const isActive = pipeline.activeStepId === step.id;
              const isCompleted = pipeline.completedStepIds.includes(step.id);
              const agentStatus: AgentStatus = isActive ? "running" : isCompleted ? "completed" : "queued";
              const isSelected = activePhaseChatStepId === step.id;

              return (
                <React.Fragment key={step.id}>
                  {idx > 0 && <VerticalArrow />}
                  <StepRow
                    step={step}
                    icon={agent?.icon ?? STEP_ICONS[step.type] ?? "⚙️"}
                    status={agentStatus}
                    isActive={isActive}
                    isSelected={isSelected}
                    onClick={() => setActivePhaseChatStep(step.id)}
                  />
                </React.Fragment>
              );
            })}
          </div>

          {/* Retry indicator */}
          {steps.some(s => s.loop) && (
            <div className="flex items-center gap-1.5 mt-2 pl-2">
              <span className="text-[10px] text-status-warning">↻</span>
              <span className="text-[10px] text-text-muted">Generator ↔ Evaluator 재시도 루프</span>
            </div>
          )}
        </div>

        {/* Feature Assignment */}
        <div className="p-3 bg-bg-card border border-border-subtle rounded-card">
          <div className="text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-2">
            기능 ({features.filter(f => f.status === "completed").length}/{features.length})
          </div>
          {features.length === 0 ? (
            <div className="text-[11px] text-text-muted italic text-center py-2">
              Director가 기능을 생성합니다.
            </div>
          ) : (
            <div className="space-y-1">
              {features.map((feature) => (
                <div key={feature.id} className="flex items-center gap-2 p-2 bg-bg-hover rounded-md">
                  <span className="text-[11px] text-text-muted w-4 text-right shrink-0">{feature.order}.</span>
                  <span className="text-xs text-text-primary truncate flex-1">{feature.name}</span>
                  <FeatureStatusPill status={feature.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Extra agents */}
        {extraAgents.length > 0 && (
          <div className="p-3 bg-bg-card border border-border-subtle rounded-card">
            <div className="text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-2">기타 에이전트</div>
            <div className="space-y-1">
              {extraAgents.map((agent) => (
                <div key={agent.id} className="flex items-center gap-2 p-2 bg-bg-hover rounded-md">
                  <span className="text-sm">{agent.icon}</span>
                  <span className="text-xs text-text-primary truncate flex-1">{agent.displayName}</span>
                  <StatusDot status={agent.status} size="sm" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 우측: 단계별 채팅 ── */}
      <div className="flex-1 overflow-hidden">
        {activePhaseChatStepId ? (
          <PhaseChat
            projectId={currentProjectId}
            stepId={activePhaseChatStepId}
            stepName={selectedStep?.displayName}
            workingDir={workingDir}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
              <span className="text-2xl">💬</span>
            </div>
            <h2 className="text-sm font-medium text-text-primary mb-1">단계별 채팅</h2>
            <p className="text-xs text-text-secondary max-w-xs">
              왼쪽 파이프라인에서 단계를 클릭하면<br/>해당 단계의 채팅이 표시됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** trigger가 없는 에이전트의 trigger를 id로 추론 */
function inferTrigger(agentId: string): string {
  if (agentId === "director") return "core_director";
  if (agentId === "planner") return "core_planner";
  if (agentId === "generator") return "after_planner";
  if (agentId === "evaluator") return "after_generator";
  if (/designer|architect|writer|modeler/.test(agentId)) return "after_planner";
  return "after_generator";
}

const STEP_ICONS: Record<string, string> = {
  plan: "🔧",
  design: "🎨",
  generate: "💻",
  evaluate: "🔍",
  custom: "⚙️",
};

const DEFAULT_STEPS: PipelineStep[] = [
  { id: "default-plan", agentId: "planner", displayName: "기획", type: "plan", description: "스펙을 기능 단위로 분해" },
  { id: "default-gen", agentId: "generator", displayName: "구현", type: "generate", description: "각 기능의 코드 작성" },
  { id: "default-eval", agentId: "evaluator", displayName: "검증", type: "evaluate", description: "코드 품질 검증" },
];

function StepRow({
  step,
  icon,
  status,
  isActive,
  isSelected,
  onClick,
}: {
  step: PipelineStep;
  icon: string;
  status: AgentStatus;
  isActive: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full p-2.5 rounded-lg border-2 transition-all cursor-pointer text-left ${
        isSelected
          ? "border-accent bg-accent/8 shadow-sm"
          : isActive
            ? "border-accent/50 bg-accent/5"
            : status === "completed"
              ? "border-status-success/30 bg-status-success/5"
              : "border-transparent bg-bg-hover hover:border-border-subtle"
      }`}
      title={step.description}
    >
      <span className="text-lg shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-text-primary">{step.displayName}</div>
        <div className="text-[10px] text-text-muted truncate">{step.description}</div>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        <StatusDot status={status} size="sm" />
        {isActive && <span className="text-[9px] text-accent animate-pulse">실행중</span>}
        {isSelected && <span className="text-[9px] text-accent">💬</span>}
      </div>
    </button>
  );
}

function VerticalArrow() {
  return (
    <div className="flex justify-center py-0.5">
      <div className="w-0.5 h-3 bg-border-strong" />
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
    <div className="flex items-center gap-2 flex-wrap">
      {isStopped && projectId && (
        <ControlButton onClick={handleStart} icon="▶" label="GSD 시작" variant="accent" />
      )}
      {isRunning && (
        <ControlButton
          onClick={handleStop}
          icon="⏹"
          label={confirming === "stop" ? "확인?" : "중단"}
          variant={confirming === "stop" ? "danger-confirm" : "danger"}
        />
      )}
      {gsdPipeline.cost > 0 && (
        <span className="text-[10px] text-text-muted">${gsdPipeline.cost.toFixed(3)}</span>
      )}
      {gsdPipeline.currentStep && (
        <span className="text-[10px] text-accent">
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
    <span className={`px-2 py-0.5 rounded-badge text-[10px] font-medium ${c.color}`}>
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
    <span className={`px-1.5 py-0.5 rounded-badge text-[10px] font-medium ${config[status] ?? config.pending}`}>
      {status === "completed" ? "✅" : status === "in_progress" ? "🔄" : status === "failed" ? "❌" : "⏳"}
    </span>
  );
}
