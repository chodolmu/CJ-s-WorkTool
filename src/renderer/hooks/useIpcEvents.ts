import React, { useEffect } from "react";
import { useAppStore } from "../stores/app-store";
import { toast } from "../components/Toast";

/**
 * Main Process → Renderer IPC 이벤트를 수신하여 Zustand 스토어에 반영
 * App 최상위에서 1회만 호출
 */
export function useIpcEvents() {
  const {
    updateAgentStatus,
    updateAgentSubstatus,
    updateAgentChangeSummary,
    setPhaseCoach,
    setSmartInputRequest,
    setPipelineStatus,
    setPipelineProgress,
    setPipelineSteps,
    setActiveStep,
    completeStep,
    addActivity,
    setCheckpoint,
    setClaudeInstalled,
  } = useAppStore();

  useEffect(() => {
    // Electron preload가 없으면 (브라우저 직접 접근) 스킵
    if (!window.harness?.on) return;

    const cleanups: (() => void)[] = [];

    // 파이프라인 상태
    cleanups.push(
      window.harness.on("pipeline:status", (data: { status: string }) => {
        setPipelineStatus(data.status as Parameters<typeof setPipelineStatus>[0]);

        if (data.status === "completed") {
          toast("success", "Pipeline Complete", "All features have been built successfully.");
        } else if (data.status === "failed") {
          toast("error", "Pipeline Failed", "Check the activity log for details.");
        }
      }),
    );

    // 파이프라인 진행률 + 기능 상태 동기화
    cleanups.push(
      window.harness.on("pipeline:progress", (data: { completed: number; total: number; current: string | null }) => {
        setPipelineProgress(data.completed, data.total, data.current);

        // 기능 목록 새로고침 트리거
        const { currentProjectId } = useAppStore.getState();
        if (currentProjectId && window.harness?.invoke) {
          window.harness.invoke("schedule:list", { projectId: currentProjectId }).then((features: any) => {
            if (Array.isArray(features)) {
              const { setFeatures } = useAppStore.getState();
              setFeatures(features);
            }
          }).catch(() => {});
        }
      }),
    );

    // 에이전트 활동
    cleanups.push(
      window.harness.on("agent:activity", (data: {
        agentId: string;
        eventType: string;
        message: string;
        details?: string;
      }) => {
        addActivity({
          timestamp: new Date().toISOString(),
          agentId: data.agentId,
          eventType: data.eventType as Parameters<typeof addActivity>[0]["eventType"],
          message: data.message,
          details: data.details ?? null,
        });

        // 에이전트 실행 상태 추적: system 이벤트 = 시작, thinking/tool_call = 작업중
        if (data.eventType === "system" || data.eventType === "thinking" || data.eventType === "tool_call") {
          updateAgentStatus(data.agentId, "running");
        }
        if (data.eventType === "complete") {
          updateAgentStatus(data.agentId, "completed");
        }
        if (data.eventType === "error") {
          updateAgentStatus(data.agentId, "failed");
          toast("error", `Agent Error: ${data.agentId}`, data.message);
        }
      }),
    );

    // 명시적 에이전트 상태 변경 (Pipeline/Orchestrator에서 emit)
    cleanups.push(
      window.harness.on("agent:status-change", (data: {
        agentId: string;
        status: string;
        substatus?: string;
        currentFeature?: string;
      }) => {
        updateAgentStatus(
          data.agentId,
          data.status as Parameters<typeof updateAgentStatus>[1],
          data.currentFeature,
        );
        if (data.substatus) {
          updateAgentSubstatus(
            data.agentId,
            data.substatus as Parameters<typeof updateAgentSubstatus>[1],
          );
        }
      }),
    );

    // 변경 요약
    cleanups.push(
      window.harness.on("agent:change-summary", (data: {
        agentId: string;
        summary: string;
        filesChanged: string[];
      }) => {
        updateAgentChangeSummary(data.agentId, data.summary, data.filesChanged);
        toast("success", `${data.agentId} completed`, data.summary);
      }),
    );

    // 체크포인트
    cleanups.push(
      window.harness.on("checkpoint:request", (data: { id: string; type: string; data: Record<string, unknown> }) => {
        setCheckpoint(data);
        toast("warning", "Action Required", (data.data.message as string) ?? "Checkpoint needs your input.", 0);
      }),
    );

    // 에러
    cleanups.push(
      window.harness.on("pipeline:error", (data: { error: string }) => {
        setPipelineStatus("failed");
        addActivity({
          timestamp: new Date().toISOString(),
          agentId: "system",
          eventType: "error",
          message: `Pipeline error: ${data.error}`,
        });
        toast("error", "Pipeline Error", data.error);
      }),
    );

    // 동적 파이프라인 구성
    cleanups.push(
      window.harness.on("pipeline:configured", (data: { steps: unknown[] }) => {
        setPipelineSteps(data.steps as Parameters<typeof setPipelineSteps>[0]);
      }),
    );

    cleanups.push(
      window.harness.on("pipeline:step-started", (data: { id: string }) => {
        setActiveStep(data.id);
      }),
    );

    cleanups.push(
      window.harness.on("pipeline:step-completed", (data: { id: string }) => {
        completeStep(data.id);
      }),
    );

    // Phase Coach 가이드 메시지
    cleanups.push(
      window.harness.on("phase:coach", (data: unknown) => {
        setPhaseCoach(data as Parameters<typeof setPhaseCoach>[0]);
      }),
    );

    // Smart Input 요청
    cleanups.push(
      window.harness.on("smart-input:request", (data: unknown) => {
        setSmartInputRequest(data as Parameters<typeof setSmartInputRequest>[0]);
      }),
    );

    // 채팅 액션 실행 결과
    cleanups.push(
      window.harness.on("chat:actions-executed", (data: { actions: string[] }) => {
        for (const action of data.actions) {
          toast("success", "액션 실행", action);
        }
      }),
    );

    // 에이전트 목록 업데이트 (채팅에서 추가/제거 시)
    cleanups.push(
      window.harness.on("agents:updated", (data: { agents: { id: string; displayName: string; icon: string; trigger?: string }[] }) => {
        const { initAgents } = useAppStore.getState();
        initAgents(data.agents);
        toast("success", "팀 업데이트", `에이전트 ${data.agents.length}개`);
      }),
    );

    // 기능 목록 업데이트 (채팅/파이프라인에서 기능 추가 시)
    cleanups.push(
      window.harness.on("features:updated", () => {
        const { currentProjectId } = useAppStore.getState();
        if (currentProjectId && window.harness?.invoke) {
          window.harness.invoke("project:load", { projectId: currentProjectId }).then((project: any) => {
            if (project) {
              window.harness.invoke("schedule:list", { projectId: currentProjectId }).then((features: any) => {
                if (Array.isArray(features)) {
                  const { setFeatures } = useAppStore.getState();
                  setFeatures(features);
                }
              }).catch(() => {});
            }
          }).catch(() => {});
        }
      }),
    );

    // 파이프라인 시작 요청 (채팅에서 트리거)
    cleanups.push(
      window.harness.on("pipeline:start-requested", () => {
        toast("info", "파이프라인", "파이프라인 탭에서 시작 버튼을 눌러주세요.");
      }),
    );

    // ── GSD 파이프라인 이벤트 ──
    cleanups.push(
      window.harness.on("gsd:event", (data: {
        type: string;
        gsdType: string;
        message: string;
        timestamp: string;
        data: Record<string, unknown>;
      }) => {
        // 활동 로그에 추가
        addActivity({
          timestamp: data.timestamp,
          agentId: "gsd",
          eventType: data.type as Parameters<typeof addActivity>[0]["eventType"],
          message: data.message,
        });

        // GSD 파이프라인 상태 업데이트
        const { updateGsdPipeline, addGsdPhase, updateGsdPhaseStatus } = useAppStore.getState();

        switch (data.gsdType) {
          case "phase_start":
            updateGsdPipeline({ isRunning: true, currentPhase: String(data.data.phaseName || "") });
            addGsdPhase({
              number: String(data.data.phaseNumber || ""),
              name: String(data.data.phaseName || ""),
              status: "running",
            });
            break;
          case "phase_step_start":
            updateGsdPipeline({ currentStep: String(data.data.step || "") });
            break;
          case "wave_start":
            updateGsdPipeline({ activeWave: Number(data.data.waveNumber || 0) });
            break;
          case "phase_complete":
            updateGsdPhaseStatus(String(data.data.phaseNumber || ""), data.data.success ? "completed" : "failed");
            updateGsdPipeline({ currentStep: undefined, activeWave: undefined });
            break;
          case "cost_update":
            updateGsdPipeline({ cost: Number(data.data.cumulativeCostUsd || 0) });
            break;
          case "session_error":
            toast("error", "GSD 에러", data.message);
            break;
          case "milestone_complete":
            updateGsdPipeline({ isRunning: false });
            if (data.data.success) {
              toast("success", "마일스톤 완료", data.message);
            } else {
              toast("error", "마일스톤 실패", data.message);
            }
            break;
        }
      }),
    );

    // GSD 승인 요청
    cleanups.push(
      window.harness.on("gsd:approval-request", (data: {
        id: string;
        type: string;
        context: Record<string, unknown>;
      }) => {
        const { setGsdApproval } = useAppStore.getState();
        setGsdApproval({
          id: data.id,
          type: data.type as "discuss" | "verify" | "blocker",
          context: data.context,
        });
        toast("warning", "승인 필요", `${data.type} 단계에서 확인이 필요합니다.`, 0);
      }),
    );

    // GSD 페이즈 완료
    cleanups.push(
      window.harness.on("gsd:phase-complete", (data: unknown) => {
        toast("info", "페이즈 완료", "다음 페이즈로 진행합니다.");
      }),
    );

    // Claude Code 설치 상태
    cleanups.push(
      window.harness.on("system:claude-status", (data: { installed: boolean }) => {
        setClaudeInstalled(data.installed);
        if (!data.installed) {
          toast("warning", "Claude Code Not Found", "Install Claude Code CLI to enable pipeline execution.", 8000);
        }
      }),
    );

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);
}
