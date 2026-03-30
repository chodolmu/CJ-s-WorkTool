import { EventEmitter } from "events";
import { CLIBridge, type CLIStreamEvent, type CLIResult } from "../agent-runner/cli-bridge";
import { PromptAssembler } from "../agent-runner/prompt-assembler";
import { MemoryManager } from "../memory/memory-manager";
import { PresetManager } from "../preset/preset-manager";
import { LearningManager } from "../memory/learning-manager";
import { PlanManager } from "../memory/plan-manager";
import { DirectorAgent, type DirectorReview } from "./director-agent";
import { withRetry, classifyError } from "../agent-runner/error-handler";
import type { AgentDefinition, Feature, SpecCard, DynamicPipeline, PipelineStep } from "@shared/types";

export interface PipelineConfig {
  projectId: string;
  presetId: string;
  workingDir: string;
  specCard: SpecCard;
  maxRetries: number;
  autoApprove: boolean;
}

export interface CheckpointRequest {
  id: string;
  type: "planner_complete" | "feature_complete" | "feature_failed" | "pipeline_complete";
  data: Record<string, unknown>;
}

type PipelineStatus = "idle" | "running" | "paused" | "waiting_checkpoint" | "completed" | "failed";

/**
 * 메인 오케스트레이션 파이프라인
 *
 * Discovery 스펙 → Planner → [확인] → Feature별 (Generator→Evaluator 루프) → [확인] → 완료
 */
export class Pipeline extends EventEmitter {
  private cliBridge: CLIBridge;
  private promptAssembler: PromptAssembler;
  private memoryManager: MemoryManager;
  private presetManager: PresetManager;
  private config: PipelineConfig;
  private _status: PipelineStatus = "idle";
  private checkpointResolve: ((action: string) => void) | null = null;
  private learningManager: LearningManager;
  private planManager: PlanManager;
  private director: DirectorAgent;
  private activeSession: import("../agent-runner/cli-bridge").CLISession | null = null;
  private aborted = false;

  constructor(
    cliBridge: CLIBridge,
    promptAssembler: PromptAssembler,
    memoryManager: MemoryManager,
    presetManager: PresetManager,
    config: PipelineConfig,
    planManager: PlanManager,
  ) {
    super();
    this.cliBridge = cliBridge;
    this.promptAssembler = promptAssembler;
    this.memoryManager = memoryManager;
    this.presetManager = presetManager;
    this.config = config;
    this.learningManager = new LearningManager(memoryManager);
    this.planManager = planManager;
    this.director = new DirectorAgent(cliBridge, promptAssembler, memoryManager, planManager);

    // Director 이벤트를 Pipeline으로 전파
    this.director.on("activity", (data) => this.emit("activity", data));
  }

  get status() {
    return this._status;
  }

  private dynamicPipeline: DynamicPipeline | null = null;

  /** 현재 파이프라인 구성 (UI에서 참조) */
  get pipelineSteps(): PipelineStep[] {
    return this.dynamicPipeline?.steps ?? [];
  }

  /** 파이프라인 전체 실행 */
  async run(): Promise<void> {
    this._status = "running";
    this.emit("status", this._status);

    try {
      // 0. Director가 프로젝트에 맞는 동적 파이프라인 구성
      const agents = this.presetManager.getPreset(this.config.presetId)?.agents ?? [];
      this.dynamicPipeline = this.director.buildDynamicPipeline(this.config.specCard, agents);
      this.emit("pipeline_configured", this.dynamicPipeline);

      const { steps, generateStepId, evaluateStepId } = this.dynamicPipeline;
      const preSteps = steps.filter(s => s.type !== "generate" && s.type !== "evaluate");
      const genStep = steps.find(s => s.id === generateStepId);
      const evalStep = steps.find(s => s.id === evaluateStepId);

      // ── Pre-steps: plan, design, custom 등 순차 실행 ──
      let features: Feature[] = [];
      let directorReview: import("./director-agent").DirectorReview | null = null;

      for (const step of preSteps) {
        this.emit("step_started", step);

        if (step.type === "plan") {
          // Plan 단계: Planner + Director 검토
          this.advancePhase("design");
          this.emit("activity", { agentId: "director", eventType: "system", message: `${step.displayName}: 기능 분해 + 계획 수립...` });
          const planResult = await this.runDirectorAndPlanner();
          features = planResult.features;
          directorReview = planResult.review;

          // 사용자 확인
          const action = await this.requestCheckpoint({
            id: `cp-planner-${Date.now()}`,
            type: "planner_complete",
            data: {
              message: `Director가 ${features.length}개 기능을 검토하고 일정을 수립했습니다. 이 순서로 진행할까요?`,
              features: features.map((f) => ({ name: f.name, description: f.description })),
              specMatchRate: directorReview.specMatchRate,
              missingFromSpec: directorReview.missingFromSpec,
              pipelineSteps: steps.map(s => ({ displayName: s.displayName, type: s.type })),
            },
          });

          if (action === "cancel") {
            this._status = "failed";
            this.emit("status", this._status);
            return;
          }
        } else {
          // Design, Custom 등: 해당 에이전트에게 프로젝트 전체 맥락으로 실행
          this.advancePhase(step.type === "design" ? "design" : "implement");
          await this.runPreStep(step);
        }

        this.emit("step_completed", step);
        // 단계 완료 보고서
        this.emit("activity", {
          agentId: step.agentId,
          eventType: "complete",
          message: `${step.displayName} 단계 완료`,
        });
      }

      // Plan이 없었으면 기본 기능 1개 생성
      if (features.length === 0) {
        features = [this.memoryManager.createFeature(
          this.config.projectId, "Core Feature",
          this.config.specCard.projectType, 1,
        )];
      }

      // ── Feature 루프: generate → evaluate 반복 ──
      this.advancePhase("implement");

      for (let i = 0; i < features.length; i++) {
        const feature = features[i];
        this.memoryManager.updateFeatureStatus(feature.id, "in_progress");
        this.director.trackFeatureProgress(this.config.projectId, feature.id, "in_progress");
        this.emit("progress", { completed: i, total: features.length, current: feature.name });

        const success = await this.runFeatureLoop(feature);

        if (success) {
          this.memoryManager.updateFeatureStatus(feature.id, "completed");
          this.director.trackFeatureProgress(this.config.projectId, feature.id, "completed");
        } else {
          this.memoryManager.updateFeatureStatus(feature.id, "failed");
          this.director.trackFeatureProgress(this.config.projectId, feature.id, "failed");
        }
        this.emit("schedule_updated");

        await this.requestCheckpoint({
          id: `cp-feature-${feature.id}`,
          type: success ? "feature_complete" : "feature_failed",
          data: {
            message: success
              ? `${feature.name} 완료! 다음 기능으로 넘어갈까요?`
              : `${feature.name}이 ${this.config.maxRetries}회 시도 후에도 실패했습니다.`,
            featureName: feature.name,
            featureIndex: i + 1,
            totalFeatures: features.length,
          },
        });
      }

      // ── 완료 ──
      this.advancePhase("test");
      this.memoryManager.updateProjectStatus(this.config.projectId, "completed");
      this.advancePhase("polish");
      this._status = "completed";
      this.emit("status", this._status);
      this.emit("progress", { completed: features.length, total: features.length, current: null });

    } catch (err) {
      const classified = classifyError(err);
      this.memoryManager.updateProjectStatus(this.config.projectId, "paused");

      this._status = "failed";
      this.emit("status", this._status);
      this.emit("activity", {
        agentId: "system",
        eventType: "error",
        message: `Pipeline stopped: ${classified.message}`,
      });
      this.emit("error", err);
    }
  }

  /** Pre-step 실행 (design, custom 등 — Feature 루프 이전 단계) */
  private async runPreStep(step: PipelineStep): Promise<void> {
    const agentDef = this.getAgent(step.agentId);
    // 에이전트가 프리셋에 없으면 generator를 대신 사용
    const actualAgent = agentDef ?? this.getAgent("generator");
    if (!actualAgent) throw new Error(`Agent ${step.agentId} not found`);

    this.emit("activity", {
      agentId: step.agentId,
      eventType: "system",
      message: `${step.displayName}: ${step.description}`,
    });

    const hints = this.config.specCard.directorHints;
    const prompt = this.promptAssembler.assemble({
      projectId: this.config.projectId,
      presetId: this.config.presetId,
      agentDef: actualAgent,
      taskContext: `## 단계: ${step.displayName}
${step.description}

## 프로젝트 정보
- 유형: ${this.config.specCard.projectType}
- 기술 스택: ${this.config.specCard.techStack.join(", ")}
- 도메인: ${hints?.domainContext ?? "일반"}
- 검증 중점: ${hints?.reviewFocus?.join(", ") ?? "없음"}
- 기술 제약: ${hints?.techConstraints?.join(", ") ?? "없음"}

이 단계의 결과물을 생성하세요.`,
    });

    await this.runAgent(step.agentId, actualAgent, prompt);
  }

  /** Director 방향 수립 → Planner 기능 분해 → Director 검토/일정 수립 */
  private async runDirectorAndPlanner(): Promise<{ features: Feature[]; review: DirectorReview }> {
    const plannerDef = this.getAgent("planner");
    if (!plannerDef) throw new Error("Planner agent not found in preset");

    const prompt = this.promptAssembler.assemble({
      projectId: this.config.projectId,
      presetId: this.config.presetId,
      agentDef: plannerDef,
      taskContext: `Create a feature list and implementation plan based on the project spec.
The spec card has been loaded into the project state.
Output a JSON array of features with name, description, and order.`,
    });

    const result = await this.runAgent("planner", plannerDef, prompt);

    // 결과에서 기능 목록 추출
    const features = this.parsePlannerOutput(result.output);

    // DB에 저장
    const savedFeatures: Feature[] = [];
    for (const f of features) {
      const feature = this.memoryManager.createFeature(
        this.config.projectId,
        f.name,
        f.description,
        f.order,
      );
      savedFeatures.push(feature);
    }

    // Director가 Planner 결과를 검토하고 일정 수립 (PD+PM 역할)
    const directorReview = await this.director.reviewPlannerOutput({
      projectId: this.config.projectId,
      features: savedFeatures,
      specCard: this.config.specCard,
      workingDir: this.config.workingDir,
    });
    this.emit("schedule_updated");

    this.memoryManager.updateProjectStatus(this.config.projectId, "building");
    return { features: savedFeatures, review: directorReview };
  }

  /**
   * Feature 루프: Generator → (Director가 선택한 옵셔널 에이전트) → Evaluator
   * Director는 기능 특성에 따라 옵셔널 에이전트 실행 여부를 로컬 판단 (CLI 호출 없음)
   */
  private async runFeatureLoop(feature: Feature): Promise<boolean> {
    const generatorDef = this.getAgent("generator");
    const evaluatorDef = this.getAgent("evaluator");
    if (!generatorDef || !evaluatorDef) {
      throw new Error("Generator or Evaluator agent not found in preset");
    }

    // Director가 이 기능에 필요한 옵셔널 에이전트를 선택
    const optionalAgents = this.selectOptionalAgents(feature);
    if (optionalAgents.length > 0) {
      this.emit("activity", {
        agentId: "director",
        eventType: "system",
        message: `Director: ${feature.name}에 ${optionalAgents.map(a => a.displayName).join(", ")} 투입 결정`,
      });
      this.emit("feature_agents", {
        featureId: feature.id,
        activeAgentIds: ["generator", ...optionalAgents.map(a => a.id), "evaluator"],
        skippedAgentIds: this.getSkippedAgentIds(optionalAgents),
      });
    }

    let previousFeedback: string | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      this.emit("activity", {
        agentId: "generator",
        eventType: "system",
        message: `${feature.name} 구현중... (시도 ${attempt}/${this.config.maxRetries})`,
      });

      // Generator 실행
      const genPrompt = this.promptAssembler.assemble({
        projectId: this.config.projectId,
        presetId: this.config.presetId,
        agentDef: generatorDef,
        taskContext: `Implement this feature:\n\nName: ${feature.name}\nDescription: ${feature.description}`,
        previousFeedback,
      });

      const genRun = this.memoryManager.createAgentRun(
        this.config.projectId, "generator", feature.id,
      );
      const genResult = await this.runAgent("generator", generatorDef, genPrompt);
      this.memoryManager.completeAgentRun(genRun.id, {
        status: genResult.success ? "completed" : "failed",
        changeSummary: this.extractChangeSummary(genResult.output),
        filesChanged: genResult.filesChanged,
        error: genResult.error,
      });

      // 변경 요약 이벤트
      const changeSummary = this.extractChangeSummary(genResult.output);
      if (changeSummary) {
        this.emit("change_summary", {
          agentId: "generator",
          featureId: feature.id,
          summary: changeSummary,
          filesChanged: genResult.filesChanged,
        });
      }

      // Director가 선택한 옵셔널 에이전트 실행 (Generator 후, Evaluator 전)
      const optionalFeedback: string[] = [];
      for (const optAgent of optionalAgents) {
        const optDef = this.getAgent(optAgent.id);
        if (!optDef) continue;

        this.emit("activity", {
          agentId: optAgent.id,
          eventType: "system",
          message: `${optAgent.displayName}: ${feature.name} 검토중...`,
        });

        const optPrompt = this.promptAssembler.assemble({
          projectId: this.config.projectId,
          presetId: this.config.presetId,
          agentDef: optDef,
          taskContext: `Review the implementation of feature "${feature.name}" from your perspective as ${optDef.role}.
Generator's change summary: ${changeSummary ?? "N/A"}
Files changed: ${genResult.filesChanged.join(", ") || "unknown"}
Provide specific, actionable feedback.`,
        });

        const optRun = this.memoryManager.createAgentRun(
          this.config.projectId, optAgent.id, feature.id,
        );
        const optResult = await this.runAgent(optAgent.id, optDef, optPrompt);
        this.memoryManager.completeAgentRun(optRun.id, {
          status: "completed",
          changeSummary: optResult.output.slice(0, 500),
        });

        this.emit("activity", {
          agentId: optAgent.id,
          eventType: "complete",
          message: `${optAgent.displayName}: ${feature.name} 검토 완료`,
        });

        // 옵셔널 에이전트 피드백을 Evaluator에 전달
        if (optResult.output.trim()) {
          optionalFeedback.push(`[${optAgent.displayName}]: ${optResult.output.slice(0, 300)}`);
        }
      }

      // Generator 결과에서 질문/불명확 사항 감지
      if (genResult.output && /\[질문\]|\[불명확\]|\[확인 필요\]/i.test(genResult.output)) {
        this.emit("activity", {
          agentId: "generator",
          eventType: "system",
          message: `Generator가 확인 사항을 남겼습니다 — 로그를 확인하세요`,
        });
      }

      // Evaluator 실행 (옵셔널 에이전트 피드백 포함)
      this.emit("activity", {
        agentId: "evaluator",
        eventType: "system",
        message: `${feature.name} 검증중...`,
      });

      const evalContext = [
        `Evaluate the implementation of feature "${feature.name}".`,
        `Check if the code builds, runs correctly, and meets the spec requirements.`,
        `Generator's change summary: ${changeSummary ?? "N/A"}`,
        `Files changed: ${genResult.filesChanged.join(", ") || "unknown"}`,
      ];
      if (optionalFeedback.length > 0) {
        evalContext.push(`\n## Specialist Agent Reviews\n${optionalFeedback.join("\n")}`);
      }

      const evalPrompt = this.promptAssembler.assemble({
        projectId: this.config.projectId,
        presetId: this.config.presetId,
        agentDef: evaluatorDef,
        taskContext: evalContext.join("\n"),
      });

      const evalRun = this.memoryManager.createAgentRun(
        this.config.projectId, "evaluator", feature.id,
      );
      const evalResult = await this.runAgent("evaluator", evaluatorDef, evalPrompt);
      const evalOutput = this.parseEvaluatorOutput(evalResult.output);

      this.memoryManager.completeAgentRun(evalRun.id, {
        status: "completed",
        verdict: evalOutput.verdict,
        score: evalOutput.score,
        findings: evalOutput.findings,
        changeSummary: evalOutput.summaryForUser,
      });

      this.emit("activity", {
        agentId: "evaluator",
        eventType: evalOutput.verdict === "pass" ? "complete" : "error",
        message: evalOutput.verdict === "pass"
          ? `${feature.name} 통과! (${evalOutput.score}/100)`
          : `${feature.name} 반려 (${evalOutput.score}/100): ${evalOutput.summaryForUser}`,
        details: evalOutput.findings.length > 0
          ? evalOutput.findings.map(f => `[${f.severity}] ${f.summaryForUser || f.message}`).join("\n")
          : undefined,
      });

      if (evalOutput.verdict === "pass") {
        return true;
      }

      // 반려 — 교훈 추출 + 저장
      this.learningManager.extractAndSave(
        this.config.projectId,
        evalResult.output,
        feature.name,
      );

      // 다음 시도를 위한 피드백 저장
      previousFeedback = evalOutput.retryInstructions ?? evalOutput.summaryForUser;
    }

    return false;
  }

  /**
   * Director 로컬 판단: 기능 특성에 따라 옵셔널 에이전트 선택
   * CLI 호출 없음 — 키워드 매칭으로 빠르게 결정 (토큰 0)
   */
  private selectOptionalAgents(feature: Feature): { id: string; displayName: string }[] {
    const allAgents = this.presetManager.getPreset(this.config.presetId)?.agents ?? [];
    const coreIds = new Set(["director", "planner", "generator", "evaluator"]);
    const optionals = allAgents.filter(a => !coreIds.has(a.id));

    if (optionals.length === 0) return [];

    const featureText = `${feature.name} ${feature.description}`.toLowerCase();
    const hints = this.config.specCard.directorHints;
    const selected: { id: string; displayName: string }[] = [];

    for (const agent of optionals) {
      const role = agent.role.toLowerCase();
      const shouldRun = this.shouldRunAgent(agent, featureText, hints);
      if (shouldRun) {
        selected.push({ id: agent.id, displayName: agent.displayName });
      }
    }

    return selected;
  }

  /** 에이전트가 이 기능에 필요한지 키워드 매칭으로 판단 */
  private shouldRunAgent(
    agent: AgentDefinition,
    featureText: string,
    hints?: import("@shared/types").DirectorHints,
  ): boolean {
    const id = agent.id;
    const role = agent.role.toLowerCase();

    // 게임 에이전트
    if (id === "balance-tester") {
      return /밸런스|난이도|보상|아이템|레벨|전투|체력|데미지|경험치/.test(featureText);
    }
    if (id === "ux-reviewer") {
      return /ui|ux|메뉴|화면|조작|인터페이스|버튼|입력/.test(featureText);
    }
    if (id === "story-writer") {
      return /스토리|대사|대화|이벤트|캐릭터|퀘스트|npc/.test(featureText);
    }
    if (id === "pixel-artist" || id === "asset-planner") {
      return /스프라이트|타일|에셋|이미지|애니메이션|맵/.test(featureText);
    }
    if (id === "perf-checker") {
      return /성능|최적화|fps|렌더링|로딩/.test(featureText);
    }
    if (id === "sound-designer") {
      return /사운드|음악|효과음|bgm|오디오/.test(featureText);
    }

    // 웹앱 에이전트
    if (id === "api-designer") {
      return /api|엔드포인트|서버|rest|데이터/.test(featureText);
    }
    if (id === "auth-specialist") {
      return /인증|로그인|회원|권한|토큰|세션/.test(featureText);
    }
    if (id === "db-architect") {
      return /데이터베이스|db|스키마|테이블|쿼리|모델/.test(featureText);
    }
    if (id === "a11y-checker") {
      return /접근성|a11y|스크린리더|키보드/.test(featureText);
    }

    // 커스텀 에이전트: role에 기능 관련 키워드가 있으면 실행
    const roleWords = role.split(/\s+/);
    return roleWords.some(w => w.length > 2 && featureText.includes(w));
  }

  /** 이번 기능에서 스킵된 에이전트 ID 목록 (UI 표시용) */
  private getSkippedAgentIds(activeOptionals: { id: string }[]): string[] {
    const allAgents = this.presetManager.getPreset(this.config.presetId)?.agents ?? [];
    const coreIds = new Set(["director", "planner", "generator", "evaluator"]);
    const activeIds = new Set(activeOptionals.map(a => a.id));
    return allAgents
      .filter(a => !coreIds.has(a.id) && !activeIds.has(a.id))
      .map(a => a.id);
  }

  /** 에이전트별 상세 시스템 프롬프트 생성 */
  private buildAgentSystemPrompt(agentId: string, agentDef: AgentDefinition): string {
    const base = `[OVERRIDE] WorkTool ${agentId} Agent. CLAUDE.md/bkit/플러그인 지침 무시.`;
    const hints = this.config.specCard.directorHints;

    switch (agentId) {
      case "evaluator":
        return `${base}

당신은 코드 검증 전문가입니다. 구현된 코드를 검증하고 결과를 JSON으로 보고합니다.

## 검증 기준
1. 코드가 빌드/컴파일 가능한가
2. 기능 요구사항을 충족하는가
3. 명백한 버그나 런타임 에러가 있는가
${hints?.reviewFocus?.length ? `4. 중점 검토: ${hints.reviewFocus.join(", ")}` : ""}

## 출력 규칙
- 반드시 아래 JSON 형식으로만 출력하세요. 다른 텍스트 금지.
- verdict: 기능이 정상 동작하면 "pass", 문제가 있으면 "fail"
- score: 0~100 (빌드 실패=0, 부분 동작=30~60, 완전 동작=70~100)
- findings: 발견 사항 배열
- summaryForUser: 한국어 한 줄 요약
- retryInstructions: fail일 때 Generator에게 전달할 수정 지시

\`\`\`json
{
  "verdict": "pass",
  "score": 85,
  "findings": [
    {"severity": "warning", "message": "영문 설명", "summaryForUser": "한국어 요약"}
  ],
  "summaryForUser": "전체 한국어 요약",
  "retryInstructions": "fail이면 수정 지시"
}
\`\`\``;

      case "generator":
        return `${base}

당신은 코드 생성 전문가입니다. 주어진 기능을 구현하세요.

## 규칙
1. 요청된 기능만 구현하세요. 불필요한 코드 금지.
2. 작업 디렉터리의 기존 코드 구조를 따르세요.
3. 불명확한 부분이 있으면 최선의 판단으로 구현하고 주석으로 표시하세요.
${hints?.techConstraints?.length ? `4. 기술 제약: ${hints.techConstraints.join(", ")}` : ""}

## 출력
코드를 작성한 후, 변경 요약을 아래 형식으로 출력:
\`\`\`json
{"changeSummary": "변경 내용 한 줄 요약"}
\`\`\``;

      case "planner":
        return `${base}

당신은 프로젝트 기획 전문가입니다. 스펙을 분석하여 기능 목록을 작성합니다.

## 규칙
1. 구현 가능한 단위로 기능을 분해하세요 (너무 크지도, 작지도 않게)
2. 핵심 기능을 먼저, 부가 기능을 나중에 배치
3. 각 기능에 구체적인 설명 포함

## 출력 형식 (JSON만)
\`\`\`json
{"features": [{"name": "기능명", "description": "구체적 설명", "order": 1}]}
\`\`\``;

      default:
        // 커스텀/옵셔널 에이전트
        return `${base}

역할: ${agentDef.role}
목표: ${agentDef.goal}
${agentDef.guidelines?.length ? `지침:\n${agentDef.guidelines.map(g => `- ${g}`).join("\n")}` : ""}
${agentDef.outputFormat ? `출력 형식: ${agentDef.outputFormat}` : ""}

주어진 작업만 수행하세요. 한국어로 응답하세요.`;
    }
  }

  /** 에이전트 하나 실행하고 결과 반환 (자동 재시도 포함) */
  private async runAgent(
    agentId: string,
    agentDef: AgentDefinition,
    prompt: string,
  ): Promise<CLIResult> {
    return withRetry(
      async () => {
        if (this.aborted) throw new Error("Pipeline aborted");

        const session = this.cliBridge.spawn(prompt, {
          workingDir: this.config.workingDir,
          model: agentDef.model,
          systemPrompt: this.buildAgentSystemPrompt(agentId, agentDef),
          outputFormat: "text",
        });
        this.activeSession = session;

        // 실시간 이벤트 전달
        session.on("event", (event: CLIStreamEvent) => {
          this.emit("activity", {
            agentId,
            eventType: event.type === "tool_use" ? "tool_call" : event.type === "error" ? "error" : "thinking",
            message: event.content.slice(0, 300),
            details: event.content.length > 300 ? event.content : undefined,
            metadata: event.metadata,
          });
        });

        const result = await session.waitForCompletion();
        this.activeSession = null;

        // 중단 체크
        if (this.aborted) throw new Error("Pipeline aborted");

        // 프로세스 크래시 시 에러로 던져서 재시도 트리거
        if (!result.success && result.error) {
          throw new Error(result.error);
        }

        return result;
      },
      { maxRetries: 1, baseDelayMs: 1000, maxDelayMs: 10000 },
      (attempt, delay) => {
        this.emit("activity", {
          agentId,
          eventType: "system",
          message: `Retry ${attempt} in ${Math.round(delay / 1000)}s...`,
        });
      },
    );
  }

  /** 사용자 체크포인트 요청 — autoApprove면 즉시 진행, 아니면 대기 */
  requestCheckpoint(checkpoint: CheckpointRequest): Promise<string> {
    if (this.config.autoApprove) {
      this.emit("activity", {
        agentId: "system",
        eventType: "system",
        message: `자동 승인: ${(checkpoint.data.message as string)?.slice(0, 80) ?? checkpoint.type}`,
      });
      return Promise.resolve("approve");
    }

    this._status = "waiting_checkpoint";
    this.emit("checkpoint", checkpoint);

    return new Promise((resolve) => {
      this.checkpointResolve = resolve;
    });
  }

  /** 사용자가 체크포인트에 응답 */
  respondToCheckpoint(action: string): void {
    if (this.checkpointResolve) {
      this.checkpointResolve(action);
      this.checkpointResolve = null;
      this._status = "running";
      this.emit("status", this._status);
    }
  }

  /** Phase 자동 전환 (P0-04) */
  private advancePhase(phase: string): void {
    try {
      const state = this.memoryManager.getProjectPhaseState(this.config.projectId) as any;
      if (!state) return;

      // 이전 Phase 완료 처리
      if (state.phases[state.currentPhase]) {
        state.phases[state.currentPhase].status = "completed";
        state.phases[state.currentPhase].completedAt = new Date().toISOString();
      }

      // 새 Phase 활성화
      state.currentPhase = phase;
      if (state.phases[phase]) {
        state.phases[phase].status = "active";
        state.phases[phase].startedAt = new Date().toISOString();
      }

      this.memoryManager.updateProjectPhaseState(this.config.projectId, state);
      this.emit("phase_updated", state);
    } catch {
      // Phase 업데이트 실패는 무시 (파이프라인 동작에 영향 없음)
    }
  }

  /** 파이프라인 일시정지 */
  pause(): void {
    this._status = "paused";
    this.emit("status", this._status);
    this.emit("activity", {
      agentId: "system",
      eventType: "system",
      message: "파이프라인 일시정지됨",
    });
  }

  /** 파이프라인 재개 */
  resume(): void {
    if (this._status === "paused") {
      this._status = "running";
      this.emit("status", this._status);
      this.emit("activity", {
        agentId: "system",
        eventType: "system",
        message: "파이프라인 재개됨",
      });
    }
  }

  /** 파이프라인 강제 중단 — 실행 중인 CLI 프로세스도 종료 */
  stop(): void {
    this.aborted = true;

    // 실행중 CLI 세션 종료
    if (this.activeSession) {
      this.activeSession.abort();
      this.activeSession = null;
    }

    // 체크포인트 대기중이면 cancel로 해제
    if (this.checkpointResolve) {
      this.checkpointResolve("cancel");
      this.checkpointResolve = null;
    }

    this._status = "failed";
    this.emit("status", this._status);
    this.emit("activity", {
      agentId: "system",
      eventType: "system",
      message: "파이프라인이 사용자에 의해 중단되었습니다",
    });
  }

  // ── 출력 파싱 헬퍼 ──

  private getAgent(agentId: string): AgentDefinition | null {
    return this.presetManager.getAgent(this.config.presetId, agentId);
  }

  private parsePlannerOutput(output: string): { name: string; description: string; order: number }[] {
    try {
      // JSON 블록 추출 시도
      const jsonMatch = output.match(/\{[\s\S]*"features"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.features)) {
          return parsed.features.map((f: { name: string; description: string }, i: number) => ({
            name: f.name,
            description: f.description ?? "",
            order: i + 1,
          }));
        }
      }

      // JSON 배열 직접 시도
      const arrayMatch = output.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        const arr = JSON.parse(arrayMatch[0]);
        return arr.map((f: { name: string; description: string }, i: number) => ({
          name: f.name ?? `Feature ${i + 1}`,
          description: f.description ?? "",
          order: i + 1,
        }));
      }
    } catch {
      // 파싱 실패 시 기본 기능 1개
    }

    return [{ name: "Core Feature", description: output.slice(0, 500), order: 1 }];
  }

  private parseEvaluatorOutput(output: string): {
    verdict: "pass" | "fail";
    score: number;
    findings: { severity: "error" | "warning" | "info"; message: string; summaryForUser: string }[];
    summaryForUser: string;
    retryInstructions?: string;
  } {
    // 전략 1: ```json 블록에서 추출
    try {
      const codeBlockMatch = output.match(/```(?:json)?\s*(\{[\s\S]*?"verdict"[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        const parsed = JSON.parse(codeBlockMatch[1]);
        return this.normalizeEvalResult(parsed);
      }
    } catch { /* 다음 전략 시도 */ }

    // 전략 2: 가장 작은 verdict-포함 JSON 객체 (탐욕적 매칭 방지)
    try {
      const jsonCandidates = output.match(/\{[^{}]*"verdict"[^{}]*\}/g);
      if (jsonCandidates) {
        for (const candidate of jsonCandidates) {
          try {
            const parsed = JSON.parse(candidate);
            return this.normalizeEvalResult(parsed);
          } catch { continue; }
        }
      }
    } catch { /* 다음 전략 시도 */ }

    // 전략 3: 전체에서 중첩 JSON 시도
    try {
      const jsonMatch = output.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.normalizeEvalResult(parsed);
      }
    } catch { /* 다음 전략 시도 */ }

    // 전략 4: 텍스트에서 pass/fail 키워드 추론
    const lower = output.toLowerCase();
    if (lower.includes("pass") || lower.includes("통과") || lower.includes("성공")) {
      return {
        verdict: "pass",
        score: 70,
        findings: [],
        summaryForUser: "검증 통과 (텍스트 추론)",
      };
    }

    return {
      verdict: "fail",
      score: 0,
      findings: [{ severity: "warning", message: "Could not parse evaluator output", summaryForUser: "검증 결과를 해석할 수 없습니다" }],
      summaryForUser: "검증 결과를 해석할 수 없습니다. 수동 확인이 필요합니다.",
    };
  }

  private normalizeEvalResult(parsed: Record<string, unknown>) {
    return {
      verdict: (parsed.verdict === "pass" ? "pass" : "fail") as "pass" | "fail",
      score: typeof parsed.score === "number" ? parsed.score : 0,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      summaryForUser: String(parsed.summaryForUser ?? parsed.summary ?? ""),
      retryInstructions: parsed.retryInstructions ? String(parsed.retryInstructions) : undefined,
    };
  }

  private extractChangeSummary(output: string): string | null {
    try {
      const jsonMatch = output.match(/\{[\s\S]*"changeSummary"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.changeSummary ?? null;
      }
    } catch {
      // ignore
    }

    // JSON에서 못 찾으면 마지막 200자 사용
    const trimmed = output.trim();
    if (trimmed.length > 200) {
      return trimmed.slice(-200);
    }
    return trimmed || null;
  }
}
