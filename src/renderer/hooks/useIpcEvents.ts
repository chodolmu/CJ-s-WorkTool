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
    updateAgentChangeSummary,
    setPipelineStatus,
    setPipelineProgress,
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

    // 파이프라인 진행률
    cleanups.push(
      window.harness.on("pipeline:progress", (data: { completed: number; total: number; current: string | null }) => {
        setPipelineProgress(data.completed, data.total, data.current);
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

        if (data.eventType === "system" && data.message.includes("starting")) {
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
