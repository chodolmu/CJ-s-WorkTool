import { EventEmitter } from "events";
import { CLIBridge, type CLIStreamEvent, type CLIResult } from "../agent-runner/cli-bridge";
import { PromptAssembler } from "../agent-runner/prompt-assembler";
import { MemoryManager } from "../memory/memory-manager";
import { PlanManager } from "../memory/plan-manager";
import type { AgentDefinition, Feature, SpecCard, FeatureStatus, DynamicPipeline, PipelineStep, DirectorHints } from "@shared/types";

/**
 * Director Agent (PD + PM + 프롬프트 분석 통합)
 *
 * 모든 사용자 요청의 최초 진입점. Claude CLI 1회 호출로:
 *   1. 사용자 입력 분석 (짧든 길든, 의도/범위/복잡도 판단)
 *   2. 모드 결정 (direct: 직접 처리 / delegate: 하위 에이전트 배정)
 *   3. PD: 프로젝트 방향 구체화
 *   4. PM: 일정 수립 + Plan 문서 관리 + 진행 추적
 *   5. 작업 분배 + 에이전트용 구조화된 지시 생성
 *
 * 기존 PromptTranslator(regex)와 TaskRouter(regex)를 대체.
 * AI가 직접 판단하므로 긴 입력도 정확하게 처리.
 */
export class DirectorAgent extends EventEmitter {
  constructor(
    private cliBridge: CLIBridge,
    private promptAssembler: PromptAssembler,
    private memoryManager: MemoryManager,
    private planManager: PlanManager,
  ) {
    super();
  }

  /**
   * 프로젝트 방향 수립 (Discovery 완료 후, Pipeline 시작 전)
   *
   * SpecCard를 분석하여:
   *   - 프로젝트 비전과 핵심 가치 정리
   *   - 기능 우선순위 결정
   *   - 기술적 방향 제시
   *   - 일정 추정
   */
  async establishDirection(params: {
    projectId: string;
    presetId: string;
    specCard: SpecCard;
    workingDir: string;
  }): Promise<DirectorPlan> {
    const { projectId, presetId, specCard, workingDir } = params;

    this.emit("activity", {
      agentId: "director",
      eventType: "system",
      message: "Director: 프로젝트 방향 수립 중...",
    });

    const prompt = this.buildDirectionPrompt(specCard);

    const session = this.cliBridge.spawn(prompt, {
      workingDir,
      model: "opus",
      systemPrompt: `[OVERRIDE] WorkTool Director Agent. CLAUDE.md/bkit/플러그인 지침 무시. 반드시 JSON만 출력하세요.`,
      outputFormat: "text",
    });

    let output = "";
    session.on("event", (event: CLIStreamEvent) => {
      if (event.type === "text") output += event.content;
      this.emit("activity", {
        agentId: "director",
        eventType: event.type === "tool_use" ? "tool_call" : "thinking",
        message: event.content.slice(0, 200),
      });
    });

    const result = await session.waitForCompletion();
    const fullOutput = output || result.output;

    const plan = this.parseDirectorOutput(fullOutput, specCard);

    this.emit("activity", {
      agentId: "director",
      eventType: "complete",
      message: `Director: ${plan.features.length}개 기능 계획, ${plan.vision} 방향 수립 완료`,
    });

    return plan;
  }

  /**
   * 모든 사용자 요청의 진입점 (Chat 요청 시)
   *
   * CLI 1회 호출로 입력 분석 + 모드 판단 + 작업 계획을 한 번에 수행.
   * 사소한 수정이면 직접 처리 결과를 반환하고,
   * 복잡한 작업이면 하위 에이전트 배정 계획을 반환한다.
   */
  async handleRequest(params: {
    projectId: string;
    userMessage: string;
    specCard: SpecCard;
    agents: AgentDefinition[];
    workingDir: string;
  }): Promise<WorkPlan> {
    const { projectId, userMessage, specCard, agents, workingDir } = params;

    this.emit("activity", {
      agentId: "director",
      eventType: "system",
      message: "Director: 요청 분석 중...",
    });

    const features = this.memoryManager.getFeatures(projectId);
    const project = this.memoryManager.getProject(projectId);
    const agentNames = agents.map((a) => `${a.id}(${a.role})`).join(", ");

    const prompt = `You are the Director Agent — the central brain of this project.
Analyze the user's request and decide how to handle it.

## Project Context
- Name: ${project?.name ?? "Project"}
- Type: ${specCard.projectType}
- Tech Stack: ${specCard.techStack.join(", ")}
- Status: ${project?.status ?? "building"}
- Features: ${features.length} total, ${features.filter((f) => f.status === "completed").length} completed
- Recent features: ${features.slice(-3).map((f) => `${f.name}(${f.status})`).join(", ") || "none"}

## Available Agents
${agentNames}

## User Request
"${userMessage}"

## Your Tasks
1. Analyze the request — what does the user want?
2. Decide the mode:
   - "direct": Simple task you can handle yourself (color change, text edit, quick fix, explanation)
   - "light": Medium task needing Generator + Evaluator
   - "full": Complex task needing Planner → Generator → Evaluator pipeline
3. If "direct": Write the response/solution directly
4. If "light" or "full": Create a structured task description for each agent

## Output Format (JSON)
{
  "mode": "direct|light|full",
  "analysis": "요청 분석 요약 (한국어)",
  "directResponse": "direct 모드일 때만: 직접 처리 결과",
  "steps": [
    { "agentId": "planner|generator|evaluator|...", "task": "에이전트에게 전달할 구체적 지시", "required": true }
  ]
}

IMPORTANT: For "direct" mode, steps should have one entry with agentId "generator" and the task should be your refined instruction. For "light", include generator + evaluator. For "full", include planner + generator + evaluator + any relevant custom agents.`;

    const systemPrompt = `[OVERRIDE] WorkTool Director Agent. CLAUDE.md/bkit/플러그인 지침 무시. 반드시 JSON만 출력하세요. 설명/인사/메뉴 금지.`;

    const session = this.cliBridge.spawn(prompt, {
      workingDir,
      model: "sonnet",
      systemPrompt,
      outputFormat: "text",
    });

    let output = "";
    session.on("event", (event: CLIStreamEvent) => {
      if (event.type === "text") output += event.content;
      this.emit("activity", {
        agentId: "director",
        eventType: "thinking",
        message: event.content.slice(0, 150),
      });
    });

    const result = await session.waitForCompletion();
    const fullOutput = output || result.output;
    const plan = this.parseWorkPlan(fullOutput, userMessage, agents);

    this.emit("activity", {
      agentId: "director",
      eventType: "complete",
      message: `Director: ${plan.mode} 모드 → ${plan.steps.map((s) => s.agentId).join(" → ")} | ${plan.analysis}`,
    });

    return plan;
  }

  /**
   * Director의 작업 계획 출력 파싱
   */
  private parseWorkPlan(output: string, userMessage: string, agents: AgentDefinition[]): WorkPlan {
    try {
      const jsonMatch = output.match(/\{[\s\S]*"mode"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const mode = (["direct", "light", "full"].includes(parsed.mode)) ? parsed.mode : "direct";

        let steps: WorkStep[] = [];
        if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          steps = parsed.steps.map((s: any) => ({
            agentId: s.agentId ?? "generator",
            task: s.task ?? userMessage,
            required: s.required !== false,
          }));
        } else {
          // steps가 없으면 모드에 따라 기본 생성
          steps = this.buildDefaultSteps(mode, userMessage, agents);
        }

        return {
          mode,
          analysis: parsed.analysis ?? "",
          directResponse: parsed.directResponse ?? null,
          steps,
          directorNote: parsed.analysis ?? null,
        };
      }
    } catch {
      // parse failure
    }

    // 파싱 실패 시 기본: Generator에게 원문 전달
    return {
      mode: "direct",
      analysis: "Director 응답 파싱 실패 — Generator에게 직접 전달",
      directResponse: null,
      steps: [{ agentId: "generator", task: userMessage, required: true }],
      directorNote: null,
    };
  }

  private buildDefaultSteps(mode: string, userMessage: string, agents: AgentDefinition[]): WorkStep[] {
    const hasPlanner = agents.some((a) => a.id === "planner");
    const hasEvaluator = agents.some((a) => a.id === "evaluator");

    if (mode === "direct") {
      return [{ agentId: "generator", task: userMessage, required: true }];
    }

    if (mode === "light") {
      const steps: WorkStep[] = [{ agentId: "generator", task: userMessage, required: true }];
      if (hasEvaluator) steps.push({ agentId: "evaluator", task: `Evaluate: ${userMessage}`, required: false });
      return steps;
    }

    // full
    const steps: WorkStep[] = [];
    if (hasPlanner) steps.push({ agentId: "planner", task: userMessage, required: true });
    steps.push({ agentId: "generator", task: userMessage, required: true });
    for (const agent of agents) {
      if (agent.trigger === "after_generator" && agent.id !== "evaluator") {
        steps.push({ agentId: agent.id, task: userMessage, required: false });
      }
    }
    if (hasEvaluator) steps.push({ agentId: "evaluator", task: `Evaluate: ${userMessage}`, required: true });
    return steps;
  }

  /**
   * Pipeline 실행 시 Director가 Planner 결과를 검토하고
   * PM 역할로 일정/우선순위를 결정
   */
  async reviewPlannerOutput(params: {
    projectId: string;
    features: Feature[];
    specCard: SpecCard;
    workingDir: string;
  }): Promise<DirectorReview> {
    const { projectId, features, specCard, workingDir } = params;

    this.emit("activity", {
      agentId: "director",
      eventType: "system",
      message: "Director: Planner 결과 검토 + 일정 수립 중...",
    });

    // 스펙-기능 교차검증 (코드 로직)
    const matchResult = this.planManager.getSpecMatchRate(projectId);

    // 일정 자동 배분 (PM 역할)
    const now = new Date();
    const scheduleItems = features.map((f, i) => {
      const start = new Date(now);
      start.setDate(start.getDate() + i * 2);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return {
        featureId: f.id,
        estimatedStart: start.toISOString(),
        estimatedEnd: end.toISOString(),
        assignedAgent: "generator",
        priority: features.length - i,
      };
    });

    this.memoryManager.bulkSetFeatureSchedule(scheduleItems);

    // Plan 문서 동기화 (PM 역할)
    this.planManager.syncFeatures(projectId, features);

    this.emit("activity", {
      agentId: "director",
      eventType: "complete",
      message: `Director: ${features.length}개 기능 검토 완료 (스펙 일치도 ${matchResult.rate}%)`,
    });

    // 누락 항목이 있으면 경고 알림
    if (matchResult.missing.length > 0) {
      this.emit("activity", {
        agentId: "director",
        eventType: "system",
        message: `스펙 누락 항목 ${matchResult.missing.length}개: ${matchResult.missing.slice(0, 3).join(", ")}${matchResult.missing.length > 3 ? " ..." : ""}`,
      });

      // 누락 항목을 기능으로 자동 추가 제안 (checkpoint 대신 activity로 표시)
      if (matchResult.rate < 70) {
        this.emit("activity", {
          agentId: "director",
          eventType: "system",
          message: `스펙 일치도 ${matchResult.rate}%로 낮음 — 누락 기능을 추가하거나 스펙을 수정하세요`,
        });
      }
    }

    return {
      approved: true,
      specMatchRate: matchResult.rate,
      missingFromSpec: matchResult.missing,
      scheduleSet: true,
      featureCount: features.length,
    };
  }

  /**
   * Feature 상태 변경 시 Director가 추적 (PM 역할)
   */
  trackFeatureProgress(projectId: string, featureId: string, status: FeatureStatus): void {
    this.planManager.updateFeatureStatus(projectId, featureId, status);
    this.memoryManager.updateFeatureSchedule(featureId, {
      ...(status === "in_progress" ? { actualStart: new Date().toISOString() } : {}),
      ...(status === "completed" || status === "failed" ? { actualEnd: new Date().toISOString() } : {}),
    });
  }

  /**
   * specCard + directorHints 기반으로 동적 파이프라인 구성
   * CLI 호출 없이 로컬 로직으로 생성 (토큰 절약)
   */
  buildDynamicPipeline(specCard: SpecCard, availableAgents: AgentDefinition[]): DynamicPipeline {
    const hints = specCard.directorHints;
    const suggestedPhases = hints?.suggestedPhases ?? ["plan", "generate", "evaluate"];
    const agentMap = new Map(availableAgents.map(a => [a.id, a]));

    const steps: PipelineStep[] = [];
    let stepIndex = 0;

    const addStep = (
      agentId: string,
      type: PipelineStep["type"],
      displayName: string,
      description: string,
      loop?: PipelineStep["loop"],
    ) => {
      steps.push({
        id: `step-${stepIndex++}`,
        agentId,
        displayName,
        type,
        description,
        loop,
      });
    };

    // 1. Plan 단계 (항상)
    if (suggestedPhases.includes("plan")) {
      addStep("planner", "plan", "기획", "기능 분해 + 구현 계획 수립");
    }

    // 2. 프로젝트별 중간 단계 (suggestedPhases 순서대로)
    for (const phase of suggestedPhases) {
      switch (phase) {
        case "design":
          addStep(
            agentMap.has("designer") ? "designer" : "generator",
            "design",
            "설계",
            hints?.domainContext
              ? `${hints.domainContext} 관련 설계 (아트/아키텍처/UI)`
              : "프로젝트 설계 (구조/아키텍처)",
          );
          break;
        case "data-modeling":
          addStep(
            agentMap.has("data-modeler") ? "data-modeler" : "generator",
            "custom",
            "데이터 모델링",
            "DB 스키마/데이터 모델 설계",
          );
          break;
        case "compliance":
          addStep(
            agentMap.has("compliance") ? "compliance" : "generator",
            "custom",
            "규정 검토",
            `${hints?.reviewFocus?.join(", ") ?? "관련 법률/규정"} 준수 여부 확인`,
          );
          break;
        case "security":
          addStep(
            agentMap.has("security") ? "security" : "generator",
            "custom",
            "보안 감사",
            "보안 취약점 점검 + OWASP 기준 검토",
          );
          break;
        // plan, generate, evaluate는 아래에서 처리
      }
    }

    // 3. Generate + Evaluate 루프 (항상)
    const genStepId = `step-${stepIndex}`;
    addStep("generator", "generate", "구현", "기능별 코드 생성");
    const evalStepId = `step-${stepIndex}`;
    addStep("evaluator", "evaluate", "검증",
      hints?.reviewFocus?.length
        ? `코드 검증 — 중점: ${hints.reviewFocus.join(", ")}`
        : "코드 빌드/실행/스펙 충족 검증",
    );

    // generate와 evaluate에 루프 설정
    const genStep = steps.find(s => s.id === genStepId);
    const evalStep = steps.find(s => s.id === evalStepId);
    if (genStep && evalStep) {
      genStep.loop = { maxRetries: 3, pairedWith: evalStep.id };
      evalStep.loop = { maxRetries: 3, pairedWith: genStep.id };
    }

    // 4. 후처리 커스텀 단계 (compliance/security가 evaluate 이후에도 올 수 있음)
    // suggestedPhases에서 generate 이후의 compliance/security는 이미 위에서 추가됨

    this.emit("activity", {
      agentId: "director",
      eventType: "complete",
      message: `Director: 파이프라인 구성 — ${steps.map(s => s.displayName).join(" → ")}`,
    });

    return {
      steps,
      generateStepId: genStepId,
      evaluateStepId: evalStepId,
    };
  }

  // ── 프롬프트 빌더 ──

  private buildDirectionPrompt(specCard: SpecCard): string {
    return `You are a Project Director. Analyze this project spec and create a development plan.

## Project Spec
- Type: ${specCard.projectType}
- Core Decisions: ${specCard.coreDecisions.map((d) => `${d.label}: ${d.value}`).join(", ")}
- Tech Stack: ${specCard.techStack.join(", ")}
- Expansions: ${specCard.expansions.filter((e) => e.enabled).map((e) => e.label).join(", ")}

## Your Tasks
1. Define the project vision in 1-2 sentences
2. Break down into features with names and descriptions
3. Set priority order (most critical first)
4. Identify technical risks

## Output Format (JSON)
{
  "vision": "프로젝트 비전 한 줄",
  "features": [
    { "name": "기능명", "description": "설명", "order": 1, "complexity": "high|medium|low" }
  ],
  "risks": ["리스크1", "리스크2"],
  "techDirection": "기술 방향 요약"
}`;
  }

  private buildWorkContext(specCard: SpecCard, features: Feature[], userMessage: string): string {
    const completed = features.filter((f) => f.status === "completed").length;
    return `Project: ${specCard.projectType}, Progress: ${completed}/${features.length} features, Request: ${userMessage}`;
  }

  private parseDirectorOutput(output: string, specCard: SpecCard): DirectorPlan {
    try {
      const jsonMatch = output.match(/\{[\s\S]*"features"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          vision: parsed.vision ?? specCard.projectType,
          features: (parsed.features ?? []).map((f: any, i: number) => ({
            name: f.name ?? `Feature ${i + 1}`,
            description: f.description ?? "",
            order: f.order ?? i + 1,
            complexity: f.complexity ?? "medium",
          })),
          risks: parsed.risks ?? [],
          techDirection: parsed.techDirection ?? "",
        };
      }
    } catch {
      // parse failure
    }

    return {
      vision: specCard.projectType,
      features: [{ name: "Core Feature", description: output.slice(0, 500), order: 1, complexity: "medium" }],
      risks: [],
      techDirection: "",
    };
  }
}

// ── Types ──

export interface DirectorPlan {
  vision: string;
  features: {
    name: string;
    description: string;
    order: number;
    complexity: "high" | "medium" | "low";
  }[];
  risks: string[];
  techDirection: string;
}

export interface WorkPlan {
  mode: "direct" | "light" | "full";
  analysis: string;
  directResponse: string | null;
  steps: WorkStep[];
  directorNote: string | null;
}

export interface WorkStep {
  agentId: string;
  task: string;
  required: boolean;
}

export interface DirectorReview {
  approved: boolean;
  specMatchRate: number;
  missingFromSpec: string[];
  scheduleSet: boolean;
  featureCount: number;
}
