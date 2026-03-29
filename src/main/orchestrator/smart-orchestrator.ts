import { EventEmitter } from "events";
import { CLIBridge, type CLIStreamEvent } from "../agent-runner/cli-bridge";
import { PromptAssembler } from "../agent-runner/prompt-assembler";
import { MemoryManager } from "../memory/memory-manager";
import { PresetManager } from "../preset/preset-manager";
import { LearningManager } from "../memory/learning-manager";
import { DecisionRequester, type PendingDecision } from "./decision-requester";
import { DirectorAgent, type WorkPlan } from "./director-agent";
import { PlanManager } from "../memory/plan-manager";
import type { AgentDefinition, SpecCard } from "@shared/types";

/**
 * Smart Orchestrator — 실행 엔진
 *
 * Director Agent가 작업 계획을 수립하면,
 * Orchestrator가 각 에이전트의 CLI 호출과 결과 전달을 수행한다.
 *
 * 플로우:
 *   [사용자] → [Director: AI 분석 + 판단] → [Orchestrator: 실행] → [Planner/Generator/Evaluator]
 *
 * Orchestrator 자체는 AI를 호출하지 않음 — 실행/전달/복구만 담당.
 */
export class SmartOrchestrator extends EventEmitter {
  private learningManager: LearningManager;
  private decisionRequester: DecisionRequester;
  public director: DirectorAgent;

  constructor(
    private cliBridge: CLIBridge,
    private promptAssembler: PromptAssembler,
    private memoryManager: MemoryManager,
    private presetManager: PresetManager,
    planManager: PlanManager,
  ) {
    super();
    this.learningManager = new LearningManager(memoryManager);
    this.decisionRequester = new DecisionRequester();
    this.director = new DirectorAgent(cliBridge, promptAssembler, memoryManager, planManager);

    this.director.on("activity", (data) => this.emit("activity", data));
    this.decisionRequester.on("decision-needed", (decision: PendingDecision) => {
      this.emit("decision-needed", decision);
    });
  }

  respondToDecision(answer: string): void {
    this.decisionRequester.respondToDecision(answer);
  }

  /**
   * 메인 진입점: 사용자 요청 → Director 분석 → 에이전트 실행
   */
  async handleRequest(params: {
    projectId: string;
    presetId: string;
    workingDir: string;
    userMessage: string;
    specCard: SpecCard;
    agents: AgentDefinition[];
    forceMode?: string;
  }): Promise<OrchestratorResult> {
    const { projectId, presetId, workingDir, userMessage, specCard, agents } = params;

    this.emit("status", { phase: "analyzing", message: "Director analyzing request..." });

    // 1. Director가 모든 판단을 수행 (CLI 1회 호출)
    const workPlan = await this.director.handleRequest({
      projectId,
      userMessage,
      specCard,
      agents,
      workingDir,
    });

    this.emit("status", {
      phase: "planned",
      message: `${workPlan.mode} mode: ${workPlan.steps.map((s) => s.agentId).join(" → ")}`,
    });

    // 2. 각 step 실행
    const results: StepResult[] = [];
    let previousOutput = "";

    for (const step of workPlan.steps) {
      const agent = agents.find((a) => a.id === step.agentId);
      if (!agent) {
        results.push({ agentId: step.agentId, success: false, output: "Agent not found", skipped: false });
        continue;
      }

      this.emit("activity", {
        agentId: step.agentId,
        eventType: "system",
        message: `${agent.displayName} starting...`,
      });

      // Director가 이미 구조화한 task를 프롬프트로 구성
      let prompt = this.buildAgentPrompt(agent, step.task, previousOutput);

      // 학습 내용 주입 (Generator 한정)
      if (agent.id === "generator") {
        const lessons = this.learningManager.getLessonsForPrompt(projectId);
        if (lessons) prompt += "\n\n---\n\n" + lessons;
      }

      // CLI 실행
      const session = this.cliBridge.spawn(prompt, {
        workingDir,
        model: agent.model,
      });

      let output = "";
      session.on("event", (event: CLIStreamEvent) => {
        if (event.type === "text") output += event.content;
        this.emit("stream", { agentId: step.agentId, ...event });
        this.emit("activity", {
          agentId: step.agentId,
          eventType: event.type === "tool_use" ? "tool_call" : "thinking",
          message: event.content.slice(0, 150),
        });
      });

      const result = await session.waitForCompletion();
      const fullOutput = output || result.output;

      // 사용자 결정 필요 여부 체크
      if (result.success) {
        const needsDecision = this.decisionRequester.checkAndRequest(
          step.agentId,
          fullOutput,
          step.task,
        );

        if (needsDecision) {
          this.emit("activity", {
            agentId: step.agentId,
            eventType: "checkpoint",
            message: `${agent.displayName} needs your decision`,
          });
          const answer = await this.decisionRequester.waitForDecision();
          previousOutput = `User decided: ${answer}\n\n${fullOutput}`;
          this.emit("activity", {
            agentId: "user",
            eventType: "user_action",
            message: `Decision: ${answer}`,
          });
        }
      }

      this.emit("activity", {
        agentId: step.agentId,
        eventType: result.success ? "complete" : "error",
        message: result.success
          ? `${agent.displayName} completed`
          : `${agent.displayName} failed: ${result.error}`,
      });

      results.push({
        agentId: step.agentId,
        success: result.success,
        output: fullOutput,
        filesChanged: result.filesChanged,
        tokenUsage: result.tokenUsage,
        skipped: false,
      });

      if (!result.success && step.required) {
        this.emit("status", { phase: "failed", message: `${agent.displayName} failed` });
        break;
      }

      previousOutput = fullOutput;
    }

    // 3. 결과 종합
    const allSuccess = results.every((r) => r.success || !workPlan.steps.find((s) => s.agentId === r.agentId)?.required);

    this.emit("status", {
      phase: allSuccess ? "completed" : "failed",
      message: allSuccess ? "All steps completed" : "Some steps failed",
    });

    return {
      success: allSuccess,
      mode: workPlan.mode,
      steps: results,
      summary: this.buildSummary(results),
      directorAnalysis: workPlan.analysis,
    };
  }

  /**
   * Director가 구조화한 task를 에이전트 프롬프트로 변환
   * (PromptTranslator 대체 — 단순 템플릿)
   */
  private buildAgentPrompt(agent: AgentDefinition, task: string, previousOutput: string): string {
    const sections: string[] = [];

    sections.push(`## Your Role: ${agent.displayName}\n${agent.role}\nGoal: ${agent.goal}`);

    if (agent.constraints.length > 0) {
      sections.push(`## Constraints\n${agent.constraints.map((c) => `- ${c}`).join("\n")}`);
    }

    sections.push(`## Task\n${task}`);

    if (previousOutput) {
      sections.push(`## Previous Agent Output (context)\n${previousOutput.slice(0, 1000)}`);
    }

    if (agent.outputFormat) {
      sections.push(`## Expected Output Format\n${agent.outputFormat}`);
    }

    return sections.join("\n\n---\n\n");
  }

  private buildSummary(results: StepResult[]): string {
    const completed = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success && !r.skipped);

    if (failed.length === 0) {
      return `All ${completed.length} steps completed successfully.`;
    }
    return `${completed.length} steps completed, ${failed.length} failed: ${failed.map((f) => f.agentId).join(", ")}`;
  }
}

// Types
interface StepResult {
  agentId: string;
  success: boolean;
  output: string;
  filesChanged?: string[];
  tokenUsage?: { input: number; output: number };
  skipped: boolean;
}

export interface OrchestratorResult {
  success: boolean;
  mode: string;
  steps: StepResult[];
  summary: string;
  directorAnalysis: string;
}
