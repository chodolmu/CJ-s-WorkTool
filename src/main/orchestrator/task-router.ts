import { CLIBridge, type CLIStreamEvent } from "../agent-runner/cli-bridge";
import { PromptAssembler } from "../agent-runner/prompt-assembler";
import { MemoryManager } from "../memory/memory-manager";
import { PresetManager } from "../preset/preset-manager";
import { EventEmitter } from "events";
import type { SpecCard } from "@shared/types";

/**
 * 작업 크기에 따라 실행 모드를 자동 라우팅
 *
 * Direct: Claude 1회 호출 (채팅에서 바로 코드 수정)
 *   → "버튼 색상 바꿔줘", "오타 수정", "변수명 변경"
 *
 * Light: Generator + Evaluator = 2회 호출 (Planner 스킵)
 *   → "비밀번호 확인 필드 추가", "페이지네이션 구현"
 *
 * Full: Planner + Generator + Evaluator = 3+ 호출 (전체 파이프라인)
 *   → "소셜 로그인 시스템", "결제 모듈 통합"
 */
export type ExecutionMode = "direct" | "light" | "full";

interface TaskClassification {
  mode: ExecutionMode;
  confidence: number;
  reason: string;
}

// 키워드 기반 분류 (AI 호출 없이 로컬에서 판단 — 토큰 0)
const DIRECT_PATTERNS = [
  /색상|color|colour/i,
  /오타|typo|오류.*수정|fix.*typo/i,
  /이름.*변경|rename|바꿔/i,
  /텍스트.*변경|text.*change|문구/i,
  /크기.*조정|size|resize|font.*size/i,
  /삭제|remove|delete|지워/i,
  /간격|padding|margin|spacing/i,
  /보여줘|show|display|explain|설명/i,
  /숨겨|hide|visible/i,
  /정렬|align|center/i,
];

const FULL_PATTERNS = [
  /시스템|system/i,
  /통합|integration|integrate/i,
  /인증|authentication|auth/i,
  /모듈|module/i,
  /아키텍처|architecture/i,
  /마이그레이션|migration|migrate/i,
  /리팩토링|refactor/i,
  /데이터베이스|database|db.*설계/i,
  /API.*설계|design.*api/i,
  /처음부터|from.*scratch|새로.*만/i,
];

export function classifyTask(message: string): TaskClassification {
  const msg = message.trim();

  // 매우 짧은 메시지 → Direct
  if (msg.length < 30) {
    return { mode: "direct", confidence: 0.8, reason: "Short message" };
  }

  // Direct 패턴 매치
  for (const pattern of DIRECT_PATTERNS) {
    if (pattern.test(msg)) {
      return { mode: "direct", confidence: 0.85, reason: `Matches direct pattern: ${pattern.source}` };
    }
  }

  // Full 패턴 매치
  for (const pattern of FULL_PATTERNS) {
    if (pattern.test(msg)) {
      return { mode: "full", confidence: 0.8, reason: `Matches full pattern: ${pattern.source}` };
    }
  }

  // 중간 길이 + 구체적 지시 → Light
  if (msg.length < 150) {
    return { mode: "light", confidence: 0.7, reason: "Medium-length specific request" };
  }

  // 긴 메시지 → Full
  return { mode: "full", confidence: 0.6, reason: "Long/complex request" };
}

/**
 * Light Mode 실행기
 * Planner를 스킵하고 Generator→Evaluator만 실행
 */
export class LightPipeline extends EventEmitter {
  constructor(
    private cliBridge: CLIBridge,
    private promptAssembler: PromptAssembler,
    private memoryManager: MemoryManager,
    private presetManager: PresetManager,
  ) {
    super();
  }

  async run(params: {
    projectId: string;
    presetId: string;
    workingDir: string;
    specCard: SpecCard;
    task: string;
    maxRetries?: number;
  }): Promise<{ success: boolean; summary: string }> {
    const { projectId, presetId, workingDir, task, maxRetries = 2 } = params;

    this.emit("activity", {
      agentId: "system",
      eventType: "system",
      message: `Light mode: skipping Planner, running Generator directly`,
    });

    // Generator 실행
    const generatorAgent = this.presetManager.getAgent(presetId, "generator");
    if (!generatorAgent) {
      return { success: false, summary: "Generator agent not found in preset" };
    }

    const genPrompt = this.promptAssembler.assemble({
      projectId,
      presetId,
      agentDef: generatorAgent,
      taskContext: task,
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.emit("activity", {
        agentId: "generator",
        eventType: "system",
        message: `Generator starting (attempt ${attempt}/${maxRetries})`,
      });

      const genSession = this.cliBridge.spawn(genPrompt, {
        workingDir,
        model: generatorAgent.model,
      });

      genSession.on("event", (event: CLIStreamEvent) => {
        this.emit("activity", {
          agentId: "generator",
          eventType: event.type === "tool_use" ? "tool_call" : event.type === "error" ? "error" : "thinking",
          message: event.content.slice(0, 200),
        });
      });

      const genResult = await genSession.waitForCompletion();

      if (!genResult.success) {
        this.emit("activity", {
          agentId: "generator",
          eventType: "error",
          message: `Generator failed: ${genResult.error}`,
        });
        continue;
      }

      // Evaluator 실행
      const evaluatorAgent = this.presetManager.getAgent(presetId, "evaluator");
      if (!evaluatorAgent) {
        // Evaluator 없으면 Generator 결과만으로 완료
        const summary = this.extractSummary(genResult.output);
        this.emit("activity", {
          agentId: "system",
          eventType: "complete",
          message: summary,
        });
        return { success: true, summary };
      }

      this.emit("activity", {
        agentId: "evaluator",
        eventType: "system",
        message: "Evaluator starting verification",
      });

      const evalPrompt = this.promptAssembler.assemble({
        projectId,
        presetId,
        agentDef: evaluatorAgent,
        taskContext: `Evaluate the following implementation for: ${task}`,
      });

      const evalSession = this.cliBridge.spawn(evalPrompt, {
        workingDir,
        model: evaluatorAgent.model,
      });

      const evalResult = await evalSession.waitForCompletion();
      const verdict = this.parseVerdict(evalResult.output);

      if (verdict === "pass") {
        const summary = this.extractSummary(genResult.output);
        this.emit("activity", {
          agentId: "evaluator",
          eventType: "complete",
          message: `Passed: ${summary}`,
        });
        return { success: true, summary };
      }

      // Fail → retry
      this.emit("activity", {
        agentId: "evaluator",
        eventType: "error",
        message: `Rejected (attempt ${attempt}/${maxRetries})`,
      });
    }

    return { success: false, summary: "Max retries exceeded" };
  }

  private parseVerdict(output: string): "pass" | "fail" {
    if (/pass|approved|success/i.test(output)) return "pass";
    return "fail";
  }

  private extractSummary(output: string): string {
    const lines = output.split("\n").filter((l) => l.trim().length > 10);
    return lines[lines.length - 1]?.slice(0, 200) ?? "Changes applied";
  }
}
