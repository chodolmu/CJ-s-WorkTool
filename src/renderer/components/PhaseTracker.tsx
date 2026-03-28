import React, { useState, useEffect, useCallback } from "react";
import { PHASE_DEFINITIONS, PHASE_ORDER, getNextPhase } from "../../shared/phase-definitions";
import type { ProjectPhase, PhaseCheckItem, ProjectPhaseState } from "@shared/types";
import { useAppStore } from "../stores/app-store";
import { toast } from "./Toast";

interface PhaseTrackerProps {
  phaseState: ProjectPhaseState | null;
  onPhaseChange: (newState: ProjectPhaseState) => void;
  compact?: boolean;
}

export function PhaseTracker({ phaseState, onPhaseChange, compact = false }: PhaseTrackerProps) {
  if (!phaseState) {
    return (
      <div className="text-xs text-text-muted italic py-2">
        프로젝트를 시작하면 단계 진행을 볼 수 있습니다.
      </div>
    );
  }

  const { currentPhase, phases } = phaseState;
  const currentDef = PHASE_DEFINITIONS.find((d) => d.id === currentPhase)!;
  const currentChecklist = phases[currentPhase]?.checklist ?? [];
  const completedItems = currentChecklist.filter((c) => c.completed).length;
  const allCompleted = currentChecklist.length > 0 && completedItems === currentChecklist.length;
  const nextPhase = getNextPhase(currentPhase);

  const handleToggleCheck = (itemId: string) => {
    const updatedPhases = { ...phases };
    const phase = updatedPhases[currentPhase];
    if (!phase) return;

    phase.checklist = phase.checklist.map((c) =>
      c.id === itemId ? { ...c, completed: !c.completed } : c,
    );

    onPhaseChange({ ...phaseState, phases: updatedPhases });
  };

  const handleAdvancePhase = () => {
    if (!nextPhase) return;

    const updatedPhases = { ...phases };

    // 현재 단계 완료
    updatedPhases[currentPhase] = {
      ...updatedPhases[currentPhase],
      status: "completed",
      completedAt: new Date().toISOString(),
    };

    // 다음 단계 활성
    updatedPhases[nextPhase] = {
      ...updatedPhases[nextPhase],
      status: "active",
      startedAt: new Date().toISOString(),
    };

    onPhaseChange({ currentPhase: nextPhase, phases: updatedPhases });
    toast("success", `단계: ${nextPhase}`, `${PHASE_DEFINITIONS.find((d) => d.id === nextPhase)!.label} 단계로 이동했습니다.`);
  };

  const handleSkipPhase = () => {
    if (!nextPhase) return;

    const updatedPhases = { ...phases };
    updatedPhases[currentPhase] = {
      ...updatedPhases[currentPhase],
      status: "skipped",
      completedAt: new Date().toISOString(),
    };
    updatedPhases[nextPhase] = {
      ...updatedPhases[nextPhase],
      status: "active",
      startedAt: new Date().toISOString(),
    };

    onPhaseChange({ currentPhase: nextPhase, phases: updatedPhases });
    toast("info", "단계 건너뜀", `${PHASE_DEFINITIONS.find((d) => d.id === nextPhase)!.label} 단계로 건너뛰었습니다.`);
  };

  if (compact) {
    return <PhaseBar currentPhase={currentPhase} phases={phases} />;
  }

  return (
    <div className="space-y-4">
      {/* Phase progress bar */}
      <PhaseBar currentPhase={currentPhase} phases={phases} />

      {/* Current phase detail */}
      <div className="p-4 bg-bg-card border border-border-subtle rounded-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{currentDef.icon}</span>
            <div>
              <div className="text-sm font-medium text-text-primary">{currentDef.label}</div>
              <div className="text-xs text-text-secondary">{currentDef.description}</div>
            </div>
          </div>
          <span className="text-xs text-text-muted px-2 py-1 bg-bg-hover rounded-badge">
            {completedItems}/{currentChecklist.length}
          </span>
        </div>

        {/* Checklist */}
        <div className="space-y-1.5 mb-4">
          {currentChecklist.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-bg-hover transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => handleToggleCheck(item.id)}
                className="w-3.5 h-3.5 rounded accent-accent cursor-pointer"
              />
              <span className={`text-sm ${item.completed ? "text-text-muted line-through" : "text-text-primary"}`}>
                {item.label}
              </span>
              {item.autoCheck && (
                <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded-badge">auto</span>
              )}
            </label>
          ))}
        </div>

        {/* Gate condition */}
        <div className="text-[11px] text-text-muted px-2 py-1.5 bg-bg-hover rounded-md mb-3">
          <span className="text-text-secondary font-medium">다음 단계 조건:</span> {currentDef.gateCondition}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {nextPhase && (
            <>
              <button
                onClick={handleAdvancePhase}
                disabled={!allCompleted}
                className={`flex-1 px-4 py-2 rounded-button text-sm font-medium transition-all cursor-pointer ${
                  allCompleted
                    ? "bg-accent hover:bg-accent-hover text-white active:scale-[0.98]"
                    : "bg-bg-active text-text-muted cursor-not-allowed"
                }`}
              >
                {PHASE_DEFINITIONS.find((d) => d.id === nextPhase)!.label} 단계로 진행 →
              </button>
              <button
                onClick={handleSkipPhase}
                className="px-3 py-2 text-xs text-text-muted hover:text-text-secondary border border-border-subtle rounded-button cursor-pointer transition-all hover:bg-bg-hover"
              >
                건너뛰기
              </button>
            </>
          )}
          {!nextPhase && (
            <div className="flex-1 text-center py-2 text-sm text-status-success font-medium">
              🎉 모든 단계 완료!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 상단 단계 진행 바 */
function PhaseBar({
  currentPhase,
  phases,
}: {
  currentPhase: ProjectPhase;
  phases: ProjectPhaseState["phases"];
}) {
  return (
    <div className="flex items-center gap-1">
      {PHASE_ORDER.map((phaseId, i) => {
        const def = PHASE_DEFINITIONS.find((d) => d.id === phaseId)!;
        const state = phases[phaseId];
        const isCurrent = phaseId === currentPhase;

        let dotStyle = "bg-bg-active border-border-subtle text-text-muted";
        if (state?.status === "completed") dotStyle = "bg-status-success/10 border-status-success/30 text-status-success";
        else if (state?.status === "skipped") dotStyle = "bg-bg-hover border-border-subtle text-text-muted line-through";
        else if (isCurrent) dotStyle = "bg-accent/10 border-accent/30 text-accent";

        return (
          <React.Fragment key={phaseId}>
            {i > 0 && (
              <div className={`flex-1 h-px max-w-[24px] ${
                state?.status === "completed" || state?.status === "skipped"
                  ? "bg-status-success/30"
                  : "bg-border-subtle"
              }`} />
            )}
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-badge border text-[10px] font-medium shrink-0 ${dotStyle}`}
              title={`${def.label}: ${state?.status ?? "locked"}`}
            >
              <span>{def.icon}</span>
              <span className="hidden sm:inline">{def.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
