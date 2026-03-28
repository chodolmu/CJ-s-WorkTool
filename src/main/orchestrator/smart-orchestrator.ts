import { EventEmitter } from "events";
import { CLIBridge, type CLIStreamEvent } from "../agent-runner/cli-bridge";
import { PromptAssembler } from "../agent-runner/prompt-assembler";
import { PromptTranslator, type ProjectContext } from "../agent-runner/prompt-translator";
import { MemoryManager } from "../memory/memory-manager";
import { PresetManager } from "../preset/preset-manager";
import { LearningManager } from "../memory/learning-manager";
import { classifyTask, type ExecutionMode } from "./task-router";
import { DecisionRequester, type PendingDecision } from "./decision-requester";
import type { AgentDefinition, SpecCard } from "@shared/types";

/**
 * Smart Orchestrator
 *
 * 에이전트 간 작업을 지능적으로 조율하는 핵심 모듈
 *
 * 역할:
 *   1. 작업 라우팅: 어떤 에이전트가 이 작업을 맡을지 결정
 *   2. 실행 모드 결정: Direct / Light / Full 자동 판단
 *   3. 에이전트 간 결과 전달: A의 출력을 B의 입력으로 연결
 *   4. 병렬 실행: 독립적인 에이전트는 동시 실행
 *   5. 실패 복구: 에이전트 실패 시 대체 전략 결정
 */
export class SmartOrchestrator extends EventEmitter {
  private promptTranslator: PromptTranslator;
  private learningManager: LearningManager;
  private decisionRequester: DecisionRequester;

  constructor(
    private cliBridge: CLIBridge,
    private promptAssembler: PromptAssembler,
    private memoryManager: MemoryManager,
    private presetManager: PresetManager,
  ) {
    super();
    this.promptTranslator = new PromptTranslator();
    this.learningManager = new LearningManager(memoryManager);
    this.decisionRequester = new DecisionRequester();

    // 결정 요청을 상위로 전파
    this.decisionRequester.on("decision-needed", (decision: PendingDecision) => {
      this.emit("decision-needed", decision);
    });
  }

  /** 사용자가 결정에 응답했을 때 호출 */
  respondToDecision(answer: string): void {
    this.decisionRequester.respondToDecision(answer);
  }

  /**
   * 메인 진입점: 사용자 요청을 받아서 적절한 에이전트에게 라우팅
   */
  async handleRequest(params: {
    projectId: string;
    presetId: string;
    workingDir: string;
    userMessage: string;
    specCard: SpecCard;
    agents: AgentDefinition[];
    forceMode?: ExecutionMode;
  }): Promise<OrchestratorResult> {
    const { projectId, presetId, workingDir, userMessage, specCard, agents, forceMode } = params;

    // 1. 작업 분류
    const classification = classifyTask(userMessage);
    const mode = forceMode ?? classification.mode;

    this.emit("status", { phase: "analyzing", message: "Analyzing request..." });

    // 2. 프로젝트 컨텍스트 수집
    const context = this.buildProjectContext(projectId, specCard);

    // 3. 에이전트 라우팅 결정
    const plan = this.planExecution(userMessage, mode, agents, context);

    this.emit("status", {
      phase: "planned",
      message: `${plan.mode} mode: ${plan.steps.map((s) => s.agentId).join(" → ")}`,
    });

    // 4. 실행
    const results: StepResult[] = [];
    let previousOutput = "";

    for (const step of plan.steps) {
      const agent = agents.find((a) => a.id === step.agentId);
      if (!agent) {
        results.push({ agentId: step.agentId, success: false, output: "Agent not found", skipped: false });
        continue;
      }

      // 프롬프트 변환
      const translated = this.promptTranslator.translate({
        userMessage: step.task,
        targetAgent: agent,
        projectContext: context,
        conversationHistory: previousOutput ? [`Previous agent output: ${previousOutput.slice(0, 500)}`] : undefined,
      });

      this.emit("activity", {
        agentId: step.agentId,
        eventType: "system",
        message: `${agent.displayName} starting (${translated.intent.type})`,
      });

      // 학습 내용 주입 (Generator 한정)
      let finalPrompt = translated.prompt;
      if (agent.id === "generator") {
        const lessons = this.learningManager.getLessonsForPrompt(projectId);
        if (lessons) finalPrompt += "\n\n---\n\n" + lessons;
      }

      // CLI 실행
      const session = this.cliBridge.spawn(finalPrompt, {
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

          // 사용자 응답 대기
          const answer = await this.decisionRequester.waitForDecision();

          // 응답을 다음 에이전트 컨텍스트에 추가
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

      // 실패 시 복구 전략
      if (!result.success && step.required) {
        // 필수 에이전트가 실패하면 중단
        this.emit("status", { phase: "failed", message: `${agent.displayName} failed` });
        break;
      }

      previousOutput = fullOutput;
    }

    // 5. 결과 종합
    const allSuccess = results.every((r) => r.success || !plan.steps.find((s) => s.agentId === r.agentId)?.required);

    this.emit("status", {
      phase: allSuccess ? "completed" : "failed",
      message: allSuccess ? "All steps completed" : "Some steps failed",
    });

    return {
      success: allSuccess,
      mode: plan.mode,
      steps: results,
      summary: this.buildSummary(results),
    };
  }

  /**
   * 실행 계획 생성 — 어떤 에이전트를 어떤 순서로 실행할지
   */
  private planExecution(
    message: string,
    mode: ExecutionMode,
    agents: AgentDefinition[],
    context: ProjectContext,
  ): ExecutionPlan {
    const hasGenerator = agents.some((a) => a.id === "generator");
    const hasEvaluator = agents.some((a) => a.id === "evaluator");
    const hasPlanner = agents.some((a) => a.id === "planner");

    if (mode === "direct") {
      // Direct: Generator만 (가장 빠른 경로)
      return {
        mode: "direct",
        steps: [{
          agentId: hasGenerator ? "generator" : agents[0]?.id ?? "generator",
          task: message,
          required: true,
        }],
      };
    }

    if (mode === "light") {
      // Light: Generator → Evaluator
      const steps: ExecutionStep[] = [
        { agentId: "generator", task: message, required: true },
      ];
      if (hasEvaluator) {
        steps.push({
          agentId: "evaluator",
          task: `Evaluate the implementation of: ${message}`,
          required: false,
        });
      }
      return { mode: "light", steps };
    }

    // Full: Planner → Generator → Evaluator + 커스텀 에이전트
    const steps: ExecutionStep[] = [];

    if (hasPlanner) {
      steps.push({ agentId: "planner", task: message, required: true });
    }

    steps.push({ agentId: "generator", task: message, required: true });

    // 커스텀 에이전트 (after_generator 트리거)
    for (const agent of agents) {
      if (agent.trigger === "after_generator" && agent.id !== "evaluator") {
        steps.push({ agentId: agent.id, task: message, required: false });
      }
    }

    if (hasEvaluator) {
      steps.push({
        agentId: "evaluator",
        task: `Evaluate the implementation of: ${message}`,
        required: true,
      });
    }

    return { mode: "full", steps };
  }

  private buildProjectContext(projectId: string, specCard: SpecCard): ProjectContext {
    const project = this.memoryManager.getProject(projectId);
    const features = this.memoryManager.getFeatures(projectId);
    const activities = this.memoryManager.getActivities(projectId, 5);

    return {
      projectName: project?.name ?? "Project",
      projectType: specCard.projectType,
      techStack: specCard.techStack,
      currentPhase: project?.status ?? "building",
      completedFeatures: features.filter((f) => f.status === "completed").length,
      totalFeatures: features.length,
      recentChanges: activities
        .filter((a) => a.eventType === "complete")
        .map((a) => a.message)
        .slice(0, 3),
    };
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
interface ExecutionStep {
  agentId: string;
  task: string;
  required: boolean;
}

interface ExecutionPlan {
  mode: ExecutionMode;
  steps: ExecutionStep[];
}

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
  mode: ExecutionMode;
  steps: StepResult[];
  summary: string;
}
