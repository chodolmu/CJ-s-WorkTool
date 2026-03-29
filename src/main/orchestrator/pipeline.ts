import { EventEmitter } from "events";
import { CLIBridge, type CLIStreamEvent, type CLIResult } from "../agent-runner/cli-bridge";
import { PromptAssembler } from "../agent-runner/prompt-assembler";
import { MemoryManager } from "../memory/memory-manager";
import { PresetManager } from "../preset/preset-manager";
import { LearningManager } from "../memory/learning-manager";
import { PlanManager } from "../memory/plan-manager";
import { withRetry, classifyError } from "../agent-runner/error-handler";
import type { AgentDefinition, Feature, SpecCard } from "@shared/types";

export interface PipelineConfig {
  projectId: string;
  presetId: string;
  workingDir: string;
  specCard: SpecCard;
  maxRetries: number;
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
  }

  get status() {
    return this._status;
  }

  /** 파이프라인 전체 실행 */
  async run(): Promise<void> {
    this._status = "running";
    this.emit("status", this._status);

    try {
      // Phase → design (설계 단계)
      this.advancePhase("design");

      // 1. Planner 실행
      this.emit("activity", { agentId: "planner", eventType: "system", message: "Planner starting..." });
      const features = await this.runPlanner();

      // Phase → implement (구현 단계)
      this.advancePhase("implement");

      // 2. 스펙-기능 교차 검증 (P0-03)
      const matchResult = this.planManager.getSpecMatchRate(this.config.projectId);

      // 3. 사용자 확인
      const plannerAction = await this.requestCheckpoint({
        id: `cp-planner-${Date.now()}`,
        type: "planner_complete",
        data: {
          message: `${features.length}개 기능을 계획했습니다. 이 순서로 진행할까요?`,
          features: features.map((f) => ({ name: f.name, description: f.description })),
          specMatchRate: matchResult.rate,
          missingFromSpec: matchResult.missing,
        },
      });

      if (plannerAction === "cancel") {
        this._status = "failed";
        this.emit("status", this._status);
        return;
      }

      // 3. Feature별 Generator → Evaluator 루프
      for (let i = 0; i < features.length; i++) {
        const feature = features[i];
        this.memoryManager.updateFeatureStatus(feature.id, "in_progress");
        // 실제 시작 시간 기록
        this.memoryManager.updateFeatureSchedule(feature.id, { actualStart: new Date().toISOString() });
        this.emit("progress", { completed: i, total: features.length, current: feature.name });

        const success = await this.runFeatureLoop(feature);

        if (success) {
          this.memoryManager.updateFeatureStatus(feature.id, "completed");
          this.planManager.updateFeatureStatus(this.config.projectId, feature.id, "completed");
        } else {
          this.memoryManager.updateFeatureStatus(feature.id, "failed");
          this.planManager.updateFeatureStatus(this.config.projectId, feature.id, "failed");
        }
        // 실제 종료 시간 기록
        this.memoryManager.updateFeatureSchedule(feature.id, { actualEnd: new Date().toISOString() });
        this.emit("schedule_updated");

        // 기능 완료 체크포인트
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

      // Phase → test (테스트/검증 단계)
      this.advancePhase("test");

      // 4. 완료
      this.memoryManager.updateProjectStatus(this.config.projectId, "completed");
      this.advancePhase("polish");
      this._status = "completed";
      this.emit("status", this._status);
      this.emit("progress", { completed: features.length, total: features.length, current: null });

    } catch (err) {
      // 어떤 에러든 프로젝트 상태는 보존
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

  /** Planner 에이전트 실행 → 기능 목록 생성 */
  private async runPlanner(): Promise<Feature[]> {
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

    // Plan 문서에 Feature 목록 동기화
    this.planManager.syncFeatures(this.config.projectId, savedFeatures);

    // 일정 자동 설정: 각 피처에 순차적 예상 일정 배분
    const now = new Date();
    const scheduleItems = savedFeatures.map((f, i) => {
      const start = new Date(now);
      start.setDate(start.getDate() + i * 2); // 피처당 2일 간격 기본 추정
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return {
        featureId: f.id,
        estimatedStart: start.toISOString(),
        estimatedEnd: end.toISOString(),
        assignedAgent: "generator",
        priority: savedFeatures.length - i, // 순서대로 우선순위
      };
    });
    this.memoryManager.bulkSetFeatureSchedule(scheduleItems);
    this.emit("schedule_updated");

    this.memoryManager.updateProjectStatus(this.config.projectId, "building");
    return savedFeatures;
  }

  /** Generator → Evaluator 루프 (한 기능) */
  private async runFeatureLoop(feature: Feature): Promise<boolean> {
    const generatorDef = this.getAgent("generator");
    const evaluatorDef = this.getAgent("evaluator");
    if (!generatorDef || !evaluatorDef) {
      throw new Error("Generator or Evaluator agent not found in preset");
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

      // Evaluator 실행
      this.emit("activity", {
        agentId: "evaluator",
        eventType: "system",
        message: `${feature.name} 검증중...`,
      });

      const evalPrompt = this.promptAssembler.assemble({
        projectId: this.config.projectId,
        presetId: this.config.presetId,
        agentDef: evaluatorDef,
        taskContext: `Evaluate the implementation of feature "${feature.name}".
Check if the code builds, runs correctly, and meets the spec requirements.
Generator's change summary: ${changeSummary ?? "N/A"}
Files changed: ${genResult.filesChanged.join(", ") || "unknown"}`,
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
          ? `✅ ${feature.name} 통과! (${evalOutput.score}/100)`
          : `❌ ${feature.name} 반려 (${evalOutput.score}/100): ${evalOutput.summaryForUser}`,
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

  /** 에이전트 하나 실행하고 결과 반환 (자동 재시도 포함) */
  private async runAgent(
    agentId: string,
    agentDef: AgentDefinition,
    prompt: string,
  ): Promise<CLIResult> {
    return withRetry(
      async () => {
        const session = this.cliBridge.spawn(prompt, {
          workingDir: this.config.workingDir,
          model: agentDef.model,
          systemPrompt: undefined,
        });

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

        // 프로세스 크래시 시 에러로 던져서 재시도 트리거
        if (!result.success && result.error) {
          throw new Error(result.error);
        }

        return result;
      },
      { maxRetries: 1, baseDelayMs: 3000, maxDelayMs: 30000 },
      (attempt, delay) => {
        this.emit("activity", {
          agentId,
          eventType: "system",
          message: `Retry ${attempt} in ${Math.round(delay / 1000)}s...`,
        });
      },
    );
  }

  /** 사용자 체크포인트 요청 — resolve될 때까지 대기 */
  requestCheckpoint(checkpoint: CheckpointRequest): Promise<string> {
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
  }

  /** 파이프라인 재개 */
  resume(): void {
    if (this._status === "paused") {
      this._status = "running";
      this.emit("status", this._status);
    }
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
    try {
      const jsonMatch = output.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          verdict: parsed.verdict === "pass" ? "pass" : "fail",
          score: parsed.score ?? 0,
          findings: parsed.findings ?? [],
          summaryForUser: parsed.summaryForUser ?? parsed.summary ?? "",
          retryInstructions: parsed.retryInstructions,
        };
      }
    } catch {
      // 파싱 실패
    }

    // 기본: 빌드 결과를 판단 불가 → fail로 처리
    return {
      verdict: "fail",
      score: 0,
      findings: [{ severity: "warning", message: "Could not parse evaluator output", summaryForUser: "검증 결과를 해석할 수 없습니다" }],
      summaryForUser: "검증 결과를 해석할 수 없습니다. 수동 확인이 필요합니다.",
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
