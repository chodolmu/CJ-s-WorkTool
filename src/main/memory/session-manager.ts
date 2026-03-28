import type { MemoryManager } from "./memory-manager";
import type { CLIBridge } from "../agent-runner/cli-bridge";

/**
 * 세션 생명주기 관리
 * - 앱 시작 시 세션 생성
 * - 앱 종료 시 활동 로그 요약 → 세션에 저장
 * - 다음 시작 시 이전 세션 요약을 프롬프트에 포함 가능
 */
export class SessionManager {
  private currentSessionId: string | null = null;
  private currentProjectId: string | null = null;

  constructor(
    private memoryManager: MemoryManager,
    private cliBridge: CLIBridge,
  ) {}

  /** 새 세션 시작 */
  startSession(projectId: string): string {
    const session = this.memoryManager.createSession(projectId);
    this.currentSessionId = session.id;
    this.currentProjectId = projectId;
    return session.id;
  }

  /** 세션 종료 — 활동 로그를 요약하여 저장 */
  async endSession(): Promise<void> {
    if (!this.currentSessionId || !this.currentProjectId) return;

    const activities = this.memoryManager.getActivities(this.currentProjectId, 200);

    if (activities.length === 0) {
      this.memoryManager.endSession(this.currentSessionId, "No activity in this session.");
      this.currentSessionId = null;
      return;
    }

    // 활동 로그를 간단히 요약 (AI 호출 없이 로컬 요약)
    const summary = this.buildLocalSummary(activities);
    this.memoryManager.endSession(this.currentSessionId, summary);
    this.currentSessionId = null;
  }

  /** AI 없이 로컬에서 세션 요약 생성 (토큰 절약) */
  private buildLocalSummary(
    activities: { agentId: string; eventType: string; message: string }[],
  ): string {
    const agentActions = new Map<string, string[]>();

    for (const act of activities) {
      if (act.eventType === "thinking") continue; // 사고 과정은 스킵

      if (!agentActions.has(act.agentId)) {
        agentActions.set(act.agentId, []);
      }

      // complete/error 이벤트만 요약에 포함
      if (act.eventType === "complete" || act.eventType === "error" || act.eventType === "system") {
        agentActions.get(act.agentId)!.push(act.message);
      }
    }

    const lines: string[] = [];
    lines.push(`Session: ${new Date().toISOString().split("T")[0]}`);
    lines.push(`Total events: ${activities.length}`);
    lines.push("");

    for (const [agentId, actions] of agentActions) {
      if (actions.length === 0) continue;
      lines.push(`[${agentId}]`);
      // 에이전트당 최대 5개 액션만
      for (const action of actions.slice(-5)) {
        lines.push(`  - ${action.slice(0, 150)}`);
      }
    }

    return lines.join("\n");
  }

  /** 마지막 세션 요약 가져오기 (프롬프트 주입용) */
  getLastSessionSummary(projectId: string): string | null {
    return this.memoryManager.getLastSessionSummary(projectId);
  }

  get sessionId() {
    return this.currentSessionId;
  }
}
