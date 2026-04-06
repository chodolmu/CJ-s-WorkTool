import { useEffect } from "react";
import { useAppStore } from "../stores/app-store";
import { toast } from "../components/Toast";
import type { TaskStatus } from "@shared/types";

/**
 * v3: Main Process → Renderer IPC 이벤트 수신 → Zustand 스토어 반영
 */
export function useIpcEvents() {
  const {
    setClaudeInstalled,
    updateTaskStatus,
    setActiveTask,
    setExecutionStatus,
  } = useAppStore();

  useEffect(() => {
    if (!window.harness?.on) return;

    const cleanups: (() => void)[] = [];

    // 태스크 시작
    cleanups.push(
      window.harness.on("execution:task-started", (data: { taskId: string; model: string }) => {
        updateTaskStatus(data.taskId, "running" as TaskStatus);
        setActiveTask(data.taskId);
        setExecutionStatus("running");
      }),
    );

    // 태스크 진행 (로그)
    cleanups.push(
      window.harness.on("execution:task-progress", (_data: { taskId: string; eventType: string; message: string }) => {
        // 로그는 TaskDetailPanel에서 개별 폴링
      }),
    );

    // 태스크 완료
    cleanups.push(
      window.harness.on("execution:task-completed", (data: { taskId: string }) => {
        updateTaskStatus(data.taskId, "completed" as TaskStatus);
        setActiveTask(null);
      }),
    );

    // 태스크 실패
    cleanups.push(
      window.harness.on("execution:task-failed", (data: { taskId: string; error: string; retryCount: number }) => {
        if (data.retryCount >= 3) {
          updateTaskStatus(data.taskId, "failed" as TaskStatus);
          toast("error", "태스크 실패", `${data.error.slice(0, 100)}`);
        } else {
          updateTaskStatus(data.taskId, "pending" as TaskStatus);
          toast("warning", "재시도", `태스크 재시도 (${data.retryCount}/3)`);
        }
        setActiveTask(null);
      }),
    );

    // 스프린트 완료
    cleanups.push(
      window.harness.on("execution:sprint-completed", (data: { sprintId: string }) => {
        toast("success", "스프린트 완료", `${data.sprintId}`);
      }),
    );

    // 마일스톤 완료
    cleanups.push(
      window.harness.on("execution:milestone-completed", (data: { milestoneId: string }) => {
        toast("success", "마일스톤 완료", `${data.milestoneId}`);
      }),
    );

    // 전체 완료
    cleanups.push(
      window.harness.on("execution:all-complete", () => {
        setExecutionStatus("idle");
        setActiveTask(null);
        toast("success", "프로젝트 완료", "모든 태스크가 완료되었습니다.");
      }),
    );

    // 실행 에러
    cleanups.push(
      window.harness.on("execution:error", (data: { message: string }) => {
        setExecutionStatus("idle");
        toast("error", "실행 오류", data.message);
      }),
    );

    // Claude Code 상태
    cleanups.push(
      window.harness.on("system:claude-status", (data: { installed: boolean }) => {
        setClaudeInstalled(data.installed);
        if (!data.installed) {
          toast("warning", "Claude Code 미설치", "CLI를 먼저 설치해주세요.");
        }
      }),
    );

    return () => cleanups.forEach((c) => c());
  }, []);
}
