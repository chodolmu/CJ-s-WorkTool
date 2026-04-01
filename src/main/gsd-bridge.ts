import { EventEmitter } from "events";
import path from "path";

/**
 * GSD SDK 래퍼 — 파이프라인 실행의 유일한 진입점
 *
 * vendor/gsd/sdk/dist/ 에서 GSD 클래스를 dynamic import하여
 * 파이프라인 실행, 이벤트 전달, 사용자 승인을 처리한다.
 *
 * Events:
 *   "gsd-event"        — 변환된 UI 이벤트 (ActivityEntry 호환)
 *   "approval-request" — 사용자 승인 필요 시 (discuss, verify, blocker)
 *   "phase-complete"   — 마일스톤 모드에서 페이즈 완료 시
 */
export class GsdBridge extends EventEmitter {
  private GSDClass: any = null;
  private activeGsd: any = null;
  private abortController: AbortController | null = null;
  private gsdBasePath: string;

  constructor(gsdBasePath: string) {
    super();
    this.gsdBasePath = gsdBasePath; // vendor/gsd/
  }

  /**
   * GSD SDK dynamic import (ESM)
   * vendor 경로에서 직접 로드 — sdk-chat.ts와 동일한 패턴
   */
  private async loadGSD(): Promise<any> {
    if (this.GSDClass) return this.GSDClass;

    const sdkPath = path.join(this.gsdBasePath, "sdk", "dist", "index.js");
    // file:// URL로 변환 (Windows 경로 호환)
    const fileUrl = "file:///" + sdkPath.replace(/\\/g, "/");
    const mod = await import(fileUrl);
    this.GSDClass = mod.GSD;
    return this.GSDClass;
  }

  /**
   * 파이프라인 실행 — 단일 페이즈 또는 전체 마일스톤
   */
  async startPipeline(params: {
    projectDir: string;
    phaseNumber?: string;
    prompt?: string;
    model?: string;
    maxBudgetPerStep?: number;
  }): Promise<{ success: boolean; error?: string; cost?: number; durationMs?: number }> {
    const GSD = await this.loadGSD();

    const gsdToolsPath = path.join(this.gsdBasePath, "bin", "gsd-tools.cjs");

    const gsd = new GSD({
      projectDir: params.projectDir,
      gsdToolsPath,
      model: params.model || "claude-sonnet-4-6",
      maxBudgetUsd: params.maxBudgetPerStep || 5.0,
    });
    this.activeGsd = gsd;
    this.abortController = new AbortController();

    // 이벤트 구독 → UI로 전달
    gsd.onEvent((event: any) => {
      this.emit("gsd-event", this.transformEvent(event));
    });

    try {
      if (params.phaseNumber) {
        const result = await gsd.runPhase(params.phaseNumber, {
          callbacks: this.buildCallbacks(),
          model: params.model || "claude-sonnet-4-6",
          maxBudgetPerStep: params.maxBudgetPerStep || 5.0,
        });
        return {
          success: result.success,
          cost: result.totalCostUsd,
          durationMs: result.totalDurationMs,
        };
      } else if (params.prompt) {
        const result = await gsd.run(params.prompt, {
          callbacks: this.buildCallbacks(),
          model: params.model || "claude-sonnet-4-6",
          onPhaseComplete: async (phaseResult: any, phaseInfo: any) => {
            this.emit("phase-complete", { phaseResult, phaseInfo });
          },
        });
        return {
          success: result.success,
          cost: result.totalCostUsd,
          durationMs: result.totalDurationMs,
        };
      }

      return { success: false, error: "phaseNumber 또는 prompt 필요" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emit("gsd-event", {
        type: "error",
        gsdType: "SessionError",
        message: `파이프라인 에러: ${msg}`,
        timestamp: new Date().toISOString(),
        data: { error: msg },
      });
      return { success: false, error: msg };
    } finally {
      this.activeGsd = null;
      this.abortController = null;
    }
  }

  /**
   * HumanGateCallbacks → UI 승인 다이얼로그
   * Promise를 열어두고, renderer에서 응답이 오면 resolve
   */
  private buildCallbacks() {
    return {
      onDiscussApproval: async (ctx: { phaseNumber: string; phaseName: string }) => {
        return this.requestApproval("discuss", ctx);
      },
      onVerificationReview: async (result: { phaseNumber: string; stepResult: any }) => {
        return this.requestApproval("verify", result);
      },
      onBlockerDecision: async (blocker: { phaseNumber: string; step: string; error?: string }) => {
        return this.requestApproval("blocker", blocker);
      },
    };
  }

  private requestApproval(type: string, context: any): Promise<string> {
    return new Promise((resolve) => {
      const id = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      this.emit("approval-request", { id, type, context, resolve });
    });
  }

  /**
   * GSD 이벤트 → UI 이벤트 변환
   * 기존 ActivityEntry 호환 포맷으로 변환하여 OrchestrationPage에서 바로 사용
   */
  private transformEvent(event: any): Record<string, unknown> {
    const typeMap: Record<string, string> = {
      session_init: "system",
      session_complete: "complete",
      session_error: "error",
      assistant_text: "thinking",
      tool_call: "tool_call",
      tool_progress: "tool_call",
      tool_use_summary: "system",
      task_started: "system",
      task_progress: "system",
      task_notification: "system",
      cost_update: "system",
      rate_limit: "error",
      phase_start: "system",
      phase_step_start: "system",
      phase_step_complete: "complete",
      phase_complete: "complete",
      wave_start: "system",
      wave_complete: "complete",
      milestone_start: "system",
      milestone_complete: "complete",
    };

    return {
      type: typeMap[event.type] || "system",
      gsdType: event.type,
      message: this.describeEvent(event),
      timestamp: event.timestamp || new Date().toISOString(),
      data: event,
    };
  }

  private describeEvent(event: any): string {
    switch (event.type) {
      case "phase_start":
        return `Phase ${event.phaseNumber}: ${event.phaseName} 시작`;
      case "phase_step_start":
        return `${event.step} 단계 진행 중...`;
      case "phase_step_complete":
        return event.success
          ? `${event.step} 완료 (${event.durationMs}ms)`
          : `${event.step} 실패: ${event.error || "unknown"}`;
      case "wave_start":
        return `Wave ${event.waveNumber}: ${event.planCount}개 플랜 병렬 실행`;
      case "wave_complete":
        return `Wave ${event.waveNumber} 완료: ${event.successCount} 성공, ${event.failureCount} 실패`;
      case "tool_call":
        return `⚙️ ${event.toolName}`;
      case "cost_update":
        return `💰 누적 $${(event.cumulativeCostUsd ?? 0).toFixed(3)}`;
      case "session_error":
        return `❌ ${event.errors?.join(", ") || "에러"}`;
      case "session_complete":
        return `✅ 세션 완료 ($${(event.totalCostUsd ?? 0).toFixed(3)}, ${event.numTurns}턴)`;
      case "phase_complete":
        return event.success
          ? `Phase ${event.phaseNumber} 완료 ($${(event.totalCostUsd ?? 0).toFixed(3)})`
          : `Phase ${event.phaseNumber} 실패`;
      case "milestone_start":
        return `마일스톤 시작: ${event.phaseCount}개 페이즈`;
      case "milestone_complete":
        return event.success
          ? `마일스톤 완료 ($${(event.totalCostUsd ?? 0).toFixed(3)})`
          : `마일스톤 실패`;
      case "task_started":
        return `🔄 서브에이전트: ${event.description || ""}`;
      case "task_notification":
        return `${event.status === "completed" ? "✅" : "❌"} 서브에이전트 ${event.status}`;
      default:
        return event.type;
    }
  }

  /**
   * 파이프라인 중단
   */
  stop(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.activeGsd = null;
  }

  /**
   * GSD 상태 조회 (.planning/ 파일 기반)
   */
  async getStatus(projectDir: string): Promise<{
    roadmap: any;
    state: any;
  } | null> {
    try {
      const GSD = await this.loadGSD();
      const gsd = new GSD({
        projectDir,
        gsdToolsPath: path.join(this.gsdBasePath, "bin", "gsd-tools.cjs"),
      });
      const tools = gsd.createTools();
      return {
        roadmap: await tools.roadmapAnalyze(),
        state: await tools.stateLoad(),
      };
    } catch {
      return null;
    }
  }

  /**
   * GSD 초기화 (새 프로젝트에 .planning/ 생성)
   */
  async initProject(projectDir: string, prompt: string, model?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const GSD = await this.loadGSD();
      const { InitRunner } = await import(
        "file:///" + path.join(this.gsdBasePath, "sdk", "dist", "init-runner.js").replace(/\\/g, "/")
      );

      const gsd = new GSD({
        projectDir,
        gsdToolsPath: path.join(this.gsdBasePath, "bin", "gsd-tools.cjs"),
        model: model || "claude-sonnet-4-6",
      });

      gsd.onEvent((event: any) => {
        this.emit("gsd-event", this.transformEvent(event));
      });

      const runner = new InitRunner({
        projectDir,
        tools: gsd.createTools(),
        eventStream: gsd.eventStream,
      });

      const result = await runner.run(prompt);
      return { success: result.success };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  get isRunning(): boolean {
    return this.activeGsd !== null;
  }
}
