# Agent Harness Desktop Tool Design Document

> **Summary**: Electron 데스크톱 앱의 기술 설계 — 컴포넌트 구조, 데이터 모델, IPC 통신, 에이전트 실행 엔진
>
> **Project**: Agent Harness Tool
> **Version**: 0.1.0
> **Author**: User + Claude
> **Date**: 2026-03-28
> **Status**: Draft
> **Planning Doc**: [harness-tool.plan.md](../01-plan/features/harness-tool.plan.md)

---

## 1. Overview

### 1.1 Design Goals

1. **비전공자도 10분 내 첫 프로젝트 시작** — Discovery 위저드로 진입 장벽 제거
2. **에이전트 상태를 1초 이내 실시간 반영** — IPC 스트리밍으로 지연 최소화
3. **지침 주입 오버헤드 < 전체 토큰의 10%** — 모듈식 프롬프트 조립으로 효율화
4. **세션 간 맥락 유실 0** — 자동 상태 저장 + 자동 세션 요약

### 1.2 Design Principles

- **관심사 분리**: Electron Main(에이전트 실행) ↔ Renderer(UI) 완전 분리, IPC로만 통신
- **프리셋 확장성**: 코어 엔진은 프리셋에 무관, 프리셋은 설정 파일(YAML)로만 정의
- **Fail-Safe**: 에이전트 충돌/에러 시 Project State는 반드시 보존, 자동 복구 시도
- **토큰 효율**: 필요한 지침만 선택적 주입, 불필요한 컨텍스트 전달 금지

---

## 2. Architecture

### 2.1 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    Electron App                                  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Renderer Process (React + TypeScript)                    │   │
│  │                                                           │   │
│  │  ┌─────────┐ ┌───────────┐ ┌────────┐ ┌──────────────┐  │   │
│  │  │Discovery│ │ Dashboard │ │  Logs  │ │PresetEditor  │  │   │
│  │  │  Page   │ │   Page    │ │  Page  │ │    Page      │  │   │
│  │  └────┬────┘ └─────┬─────┘ └───┬────┘ └──────┬───────┘  │   │
│  │       │             │           │              │          │   │
│  │  ┌────┴─────────────┴───────────┴──────────────┴─────┐   │   │
│  │  │              Zustand Store                         │   │   │
│  │  │  agents[] | project | activities[] | discovery     │   │   │
│  │  └──────────────────────┬─────────────────────────────┘   │   │
│  │                         │ IPC (contextBridge)             │   │
│  └─────────────────────────┼─────────────────────────────────┘   │
│                            │                                     │
│  ┌─────────────────────────┼─────────────────────────────────┐   │
│  │  Main Process (Node.js) │                                 │   │
│  │                         ▼                                 │   │
│  │  ┌──────────────────────────────┐                         │   │
│  │  │       IPC Router             │                         │   │
│  │  └──┬─────────┬─────────┬───────┘                         │   │
│  │     │         │         │                                 │   │
│  │     ▼         ▼         ▼                                 │   │
│  │  ┌──────┐ ┌────────┐ ┌────────┐                          │   │
│  │  │Agent │ │Memory  │ │Preset  │                          │   │
│  │  │Engine│ │Manager │ │Manager │                          │   │
│  │  └──┬───┘ └───┬────┘ └───┬────┘                          │   │
│  │     │         │          │                                │   │
│  │     ▼         ▼          ▼                                │   │
│  │  ┌──────┐ ┌────────┐ ┌────────┐                          │   │
│  │  │CLI   │ │SQLite  │ │YAML    │                          │   │
│  │  │Bridge│ │Store   │ │Files   │                          │   │
│  │  └──┬───┘ └────────┘ └────────┘                          │   │
│  │     │                                                     │   │
│  └─────┼─────────────────────────────────────────────────────┘   │
│        │                                                         │
│        ▼                                                         │
│  ┌──────────┐                                                    │
│  │Claude    │  child_process.spawn                               │
│  │Code CLI  │  stdin/stdout 스트리밍                              │
│  └──────────┘                                                    │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
   ┌──────────┐
   │ 사용자    │
   │ 프로젝트  │  ← 에이전트가 실제로 코드를 수정하는 대상
   │ 폴더     │
   └──────────┘
```

### 2.2 핵심 데이터 흐름

```
1. Discovery 플로우:
   User → [Discovery UI] → IPC → [PromptAssembler] → [CLI Bridge] → Claude Code
   Claude Code → stdout → [IPC Stream] → [Discovery UI] → 질문 표시 → User

2. 오케스트레이션 루프:
   Spec Card → [Orchestrator]
     → [PromptAssembler: Planner 지침 조립] → [CLI Bridge: Planner 실행]
     → Planner 결과 → [PromptAssembler: Generator 지침 조립] → [CLI Bridge: Generator 실행]
     → Generator 결과 → [PromptAssembler: Evaluator 지침 조립] → [CLI Bridge: Evaluator 실행]
     → Evaluator 결과 → 통과? → Yes: 다음 기능 / No: Generator 재실행

3. 상태 업데이트:
   Agent stdout → [Agent Engine: 파싱] → [IPC Stream] → [Zustand Store 업데이트] → [React 리렌더]
   동시에: [Memory Manager: SQLite project state 갱신]
```

### 2.3 모듈 의존성

| 모듈 | 의존 대상 | 역할 |
|------|----------|------|
| IPC Router | Agent Engine, Memory Manager, Preset Manager | Main↔Renderer 라우팅 |
| Agent Engine | CLI Bridge, Prompt Assembler, Memory Manager | 에이전트 생명주기 관리 |
| CLI Bridge | child_process, Node.js | Claude Code CLI 실행/통신 |
| Prompt Assembler | Memory Manager, Preset Manager | 모듈식 프롬프트 조립 |
| Memory Manager | SQLite | 3단계 기억 시스템 관리 (프로젝트 상태/세션/보고서는 SQLite 단일 소스) |
| Preset Manager | YAML Files | 프리셋/에이전트 정의 CRUD |
| Orchestrator | Agent Engine, Memory Manager | Planner→Generator→Evaluator 루프 |

---

## 3. Data Model

### 3.1 핵심 타입 정의

```typescript
// ============================================
// 프로젝트
// ============================================
interface Project {
  id: string;                    // UUID
  name: string;                  // "My Retro Game"
  presetId: string;              // "game" | "webapp" | "custom-xxx"
  specCard: SpecCard;            // Discovery 결과
  features: Feature[];           // 기능 목록 (Planner가 생성)
  status: ProjectStatus;         // "discovery" | "planning" | "building" | "completed"
  createdAt: string;             // ISO 8601
  updatedAt: string;
}

type ProjectStatus = "discovery" | "planning" | "building" | "paused" | "completed";

// ============================================
// Discovery 스펙 카드
// ============================================
interface SpecCard {
  projectType: string;           // "2D 플랫포머 게임"
  coreDecisions: CoreDecision[]; // 사용자가 결정한 핵심 사항
  expansions: Expansion[];       // AI 제안 확장 (체크/해제)
  techStack: string[];           // ["React", "Canvas API", "TypeScript"]
  rawAnswers: DiscoveryAnswer[]; // Discovery 질문/답변 원본
}

interface CoreDecision {
  key: string;                   // "genre"
  label: string;                 // "장르"
  value: string;                 // "플랫포머"
  source: "user" | "ai";
}

interface Expansion {
  id: string;
  label: string;                 // "보스전"
  enabled: boolean;              // 사용자가 체크/해제
  suggestedBy: "ai";
}

interface DiscoveryAnswer {
  questionId: string;
  question: string;
  selectedOption: string | null;
  freeText: string | null;
}

// ============================================
// 기능 (Planner가 생성)
// ============================================
interface Feature {
  id: string;
  name: string;                  // "로그인 기능"
  description: string;           // 기술 명세
  order: number;                 // 구현 순서
  status: FeatureStatus;
  generatorRuns: GeneratorRun[];
  evaluatorRuns: EvaluatorRun[];
}

type FeatureStatus = "pending" | "in_progress" | "evaluating" | "completed" | "failed";

// ============================================
// 에이전트 실행 기록
// ============================================
interface AgentRun {
  id: string;
  agentId: string;               // "planner" | "generator" | "evaluator" | custom
  featureId: string | null;
  status: AgentStatus;
  startedAt: string;
  completedAt: string | null;
  tokenUsage: { input: number; output: number };
  changeSummary: string | null;  // 비전공자 변경 요약
  filesChanged: string[];
  error: string | null;
}

type AgentStatus = "queued" | "running" | "completed" | "failed" | "paused";

interface GeneratorRun extends AgentRun {
  agentId: "generator";
  changeSummary: string;         // "로그인 화면을 만들었습니다"
  filesChanged: string[];
}

interface EvaluatorRun extends AgentRun {
  agentId: "evaluator";
  verdict: "pass" | "fail";
  score: number;                 // 0-100
  findings: Finding[];
  retryInstructions: string | null;
}

interface Finding {
  severity: "error" | "warning" | "info";
  message: string;
  summaryForUser: string;        // 비전공자 언어
}

// ============================================
// 에이전트 정의 (프리셋에서 로드)
// ============================================
interface AgentDefinition {
  id: string;                    // "generator"
  displayName: string;           // "개발자"
  icon: string;                  // "💻"
  role: string;                  // "풀스택 개발자"
  goal: string;
  constraints: string[];
  model: "opus" | "sonnet" | "haiku";
  trigger: "manual" | "after_planner" | "after_generator" | "after_evaluator";
  guidelines: string[];          // 에이전트 전용 추가 지침
  outputFormat: string;          // JSON 템플릿
}

// ============================================
// 프리셋
// ============================================
interface Preset {
  id: string;                    // "game"
  name: string;                  // "🎮 게임"
  description: string;
  discoveryQuestions: DiscoveryQuestion[];
  agents: AgentDefinition[];     // 기본 3 + 추가 에이전트
  evaluatorCriteria: string[];   // 평가 기준
  baseGuidelines: string;        // 프리셋 공통 규칙 (markdown)
}

interface DiscoveryQuestion {
  id: string;
  question: string;              // "어떤 장르의 게임인가요?"
  options: QuestionOption[];     // 2~4개
  allowFreeText: boolean;
  order: number;
  conditional?: {                // 조건부 표시
    dependsOn: string;           // 이전 질문 ID
    showWhen: string[];          // 해당 답변일 때만 표시
  };
}

interface QuestionOption {
  label: string;                 // "플랫포머"
  value: string;
  description?: string;
}

// ============================================
// 활동 로그
// ============================================
interface ActivityEntry {
  id: string;
  timestamp: string;
  agentId: string | "user" | "system";
  eventType: ActivityEventType;
  message: string;
  details?: string;              // 접기/펼치기용 상세 내용
  featureId?: string;
}

type ActivityEventType =
  | "thinking"      // 에이전트가 사고 중
  | "tool_call"     // 파일 읽기/쓰기/명령 실행
  | "complete"      // 작업 완료
  | "error"         // 에러 발생
  | "checkpoint"    // 사용자 확인 요청
  | "user_action"   // 사용자 행동 (승인/거부 등)
  | "system";       // 시스템 이벤트

// ============================================
// 세션
// ============================================
interface Session {
  id: string;
  projectId: string;
  startedAt: string;
  endedAt: string | null;
  summary: string | null;        // 자동 생성 요약
  agentRuns: AgentRun[];
  activitiesCount: number;
}
```

### 3.2 SQLite 스키마

```sql
-- 프로젝트 (모든 상태는 SQLite 단일 소스 — 파일 기반 동기화 불필요)
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  preset_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'discovery',
  spec_card_json TEXT,           -- SpecCard JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 기능 목록
CREATE TABLE features (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  order_num INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 에이전트 실행 기록
CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  feature_id TEXT REFERENCES features(id),
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  token_input INTEGER DEFAULT 0,
  token_output INTEGER DEFAULT 0,
  change_summary TEXT,
  files_changed_json TEXT,       -- string[] JSON
  verdict TEXT,                  -- evaluator만: "pass" | "fail"
  score INTEGER,                 -- evaluator만: 0-100
  findings_json TEXT,            -- evaluator만: Finding[] JSON
  error TEXT
);

-- 활동 로그
CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  timestamp TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  feature_id TEXT
);
CREATE INDEX idx_activities_project_time ON activities(project_id, timestamp DESC);

-- 세션
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  summary TEXT
);
```

### 3.3 파일시스템 구조 (harness_data/)

```
harness_data/                          ← Electron userData 폴더 내
  ├─ db.sqlite                         ← SQLite 데이터베이스
  ├─ presets/                          ← 프리셋 정의
  │   ├─ _builtin/                     ← 내장 프리셋 (업데이트 시 덮어쓰기)
  │   │   ├─ game/
  │   │   │   ├─ preset.yaml
  │   │   │   ├─ agents/
  │   │   │   │   ├─ planner.yaml
  │   │   │   │   ├─ generator.yaml
  │   │   │   │   ├─ evaluator.yaml
  │   │   │   │   └─ balance-tester.yaml
  │   │   │   └─ guidelines/
  │   │   │       └─ rules.md
  │   │   └─ webapp/
  │   │       ├─ preset.yaml
  │   │       ├─ agents/...
  │   │       └─ guidelines/...
  │   └─ custom/                       ← 사용자 생성 프리셋
  │       └─ my-preset/
  │           ├─ preset.yaml
  │           ├─ agents/...
  │           └─ guidelines/...
  ├─ guidelines/                       ← Layer 1: 글로벌 지침
  │   └─ base.md                       ← 모든 프로젝트 공통 규칙
  └─ (projects/ 폴더 불필요 — 프로젝트 상태, 결정사항, 보고서, 세션 모두 SQLite에 저장)
      ← 이유: 파일+DB 이중 저장 시 동기화 버그 위험, UI가 있어 파일 직접 열 일 없음
      ← guidelines/와 presets/만 파일 기반 유지 (사람이 읽고 편집 가능해야 하므로)
```

---

## 4. 핵심 모듈 상세 설계

### 4.1 CLI Bridge — Claude Code 통신

```typescript
// src/main/agent-runner/cli-bridge.ts

interface CLIBridgeOptions {
  workingDir: string;          // 사용자 프로젝트 폴더
  model?: "opus" | "sonnet";
  systemPrompt?: string;       // 조립된 프롬프트
  maxTurns?: number;
}

interface CLIStreamEvent {
  type: "thinking" | "text" | "tool_use" | "tool_result" | "complete" | "error";
  content: string;
  timestamp: string;
  metadata?: {
    toolName?: string;
    filePath?: string;
    tokenUsage?: { input: number; output: number };
  };
}

class CLIBridge {
  // Claude Code CLI를 child_process로 실행
  // --print 모드 + JSON 스트리밍으로 구조화된 출력 수신
  spawn(prompt: string, options: CLIBridgeOptions): CLISession;
}

class CLISession {
  id: string;
  process: ChildProcess;
  status: "running" | "completed" | "failed";

  // stdout을 파싱하여 구조화된 이벤트로 변환
  onEvent(callback: (event: CLIStreamEvent) => void): void;

  // 프로세스 종료 대기
  waitForCompletion(): Promise<CLIResult>;

  // 강제 중지 (사용자 일시정지)
  abort(): void;

  // stdin으로 추가 입력 (대화형)
  sendInput(text: string): void;
}

interface CLIResult {
  success: boolean;
  output: string;
  tokenUsage: { input: number; output: number };
  filesChanged: string[];
  error?: string;
}
```

### 4.2 Prompt Assembler — 모듈식 프롬프트 조립

```typescript
// src/main/agent-runner/prompt-assembler.ts

class PromptAssembler {
  constructor(
    private memoryManager: MemoryManager,
    private presetManager: PresetManager,
  ) {}

  /**
   * 에이전트 호출 시 프롬프트를 자동 조립
   *
   * 조립 순서:
   *   1. base.md (글로벌 규칙)               ~500 토큰
   *   2. preset rules.md (프리셋 규칙)        ~300 토큰
   *   3. agent role.yaml (에이전트 역할)       ~200 토큰
   *   4. project_state 요약                   ~500 토큰
   *   5. task context (이번 태스크 맥락)       ~300 토큰
   *   6. output format (출력 형식)             ~100 토큰
   *   ────────────────────────────────────
   *   총 오버헤드: ~1,900 토큰 (~5%)
   */
  assemble(params: AssembleParams): string;
}

interface AssembleParams {
  projectId: string;
  agentDef: AgentDefinition;     // 어떤 에이전트인지
  taskContext: string;           // 이번에 할 일 (기능 명세 등)
  previousReport?: string;      // Evaluator 반려 시 이전 피드백
}
```

### 4.3 Orchestrator — 실행 루프

```typescript
// src/main/orchestrator/pipeline.ts

class Orchestrator {
  constructor(
    private agentEngine: AgentEngine,
    private memoryManager: MemoryManager,
    private ipcSender: IPCSender,
  ) {}

  /**
   * 전체 파이프라인 실행
   *
   * Discovery 스펙 → Planner → [사용자 확인]
   *   → Feature별: Generator → Evaluator → (반려 시 재시도 최대 3회)
   *   → [사용자 체크포인트] → 다음 Feature
   */
  async runPipeline(project: Project): Promise<void> {
    // 1. Planner 실행
    const planResult = await this.runPlanner(project);

    // 2. 사용자 확인 체크포인트
    await this.requestCheckpoint("planner_complete", {
      message: "기능 목록이 준비됐습니다. 이 순서로 진행할까요?",
      features: planResult.features,
    });

    // 3. Feature별 Generator → Evaluator 루프
    for (const feature of planResult.features) {
      await this.runFeatureLoop(project, feature);

      // 4. 기능 완료 시 사용자 체크포인트
      await this.requestCheckpoint("feature_complete", {
        message: `${feature.name} 완료. 확인하시겠어요?`,
        changeSummary: feature.latestChangeSummary,
      });
    }
  }

  private async runFeatureLoop(
    project: Project,
    feature: Feature,
    maxRetries: number = 3,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Generator 실행
      const genResult = await this.agentEngine.run("generator", {
        projectId: project.id,
        featureId: feature.id,
        taskContext: feature.description,
        previousFeedback: attempt > 1 ? lastEvalResult.retryInstructions : undefined,
      });

      // Evaluator 실행
      const evalResult = await this.agentEngine.run("evaluator", {
        projectId: project.id,
        featureId: feature.id,
        taskContext: genResult.output,
      });

      if (evalResult.verdict === "pass") return;

      // 3회 실패 시 사용자에게 알림
      if (attempt === maxRetries) {
        await this.requestCheckpoint("feature_failed", {
          message: `${feature.name}이 ${maxRetries}회 시도 후에도 통과하지 못했습니다.`,
          findings: evalResult.findings,
        });
      }
    }
  }

  /**
   * 사용자 확인 체크포인트
   * IPC로 Renderer에 체크포인트 UI 표시 요청 → 사용자 응답 대기
   */
  private async requestCheckpoint(
    type: string,
    data: Record<string, unknown>,
  ): Promise<CheckpointResponse> {
    return this.ipcSender.requestAndWait("checkpoint:request", { type, data });
  }
}
```

### 4.4 Agent Guideline Generator — AI 지침 자동 작성 (FR-27~29)

```typescript
// src/main/agent-runner/guideline-generator.ts

class GuidelineGenerator {
  constructor(
    private cliBridge: CLIBridge,
    private memoryManager: MemoryManager,
    private presetManager: PresetManager,
  ) {}

  /**
   * 사용자의 대략적 역할 설명 → AI가 세부 지침 자동 생성
   *
   * 1. 프로젝트 맥락 수집 (스펙 카드, 기존 에이전트, 프리셋)
   * 2. Claude에게 지침 생성 요청
   * 3. 불명확 시 추가 질문 반환
   * 4. 최종 지침 반환
   */
  async generate(params: GuidelineGenParams): Promise<GuidelineGenResult> {
    const context = await this.gatherContext(params.projectId);
    const existingAgents = await this.presetManager.getAgents(params.presetId);

    const prompt = this.buildGuidelinePrompt({
      userDescription: params.roughDescription,  // "게임 밸런스를 검증하는 역할"
      projectSpec: context.specCard,
      existingAgents: existingAgents,
      presetRules: context.presetRules,
    });

    const result = await this.cliBridge.spawn(prompt, {
      workingDir: context.projectDir,
      model: "opus",  // 지침 생성은 Opus가 적합
    }).waitForCompletion();

    return this.parseResult(result);
  }
}

interface GuidelineGenParams {
  projectId: string;
  presetId: string;
  roughDescription: string;        // 사용자가 입력한 대략적 설명
}

interface GuidelineGenResult {
  needsClarification: boolean;     // 추가 질문 필요 여부
  clarificationQuestions?: ClarificationQuestion[];  // Discovery 스타일 질문
  generatedAgent?: AgentDefinition;  // 생성된 에이전트 정의 (지침 포함)
}

interface ClarificationQuestion {
  question: string;
  options: { label: string; value: string }[];
  allowFreeText: boolean;
}
```

### 4.5 Memory Manager — 3단계 기억 시스템

```typescript
// src/main/memory/memory-manager.ts

class MemoryManager {
  constructor(
    private db: Database,          // better-sqlite3
    private dataDir: string,       // harness_data/
  ) {}

  // ──── Layer 1: Guidelines ────

  /** 글로벌 기본 지침 로드 */
  loadBaseGuidelines(): string;

  /** 프리셋 지침 로드 */
  loadPresetGuidelines(presetId: string): string;

  /** 에이전트별 역할 지침 로드 */
  loadAgentGuidelines(presetId: string, agentId: string): AgentDefinition;

  // ──── Layer 2: Project State ────

  /** 프로젝트 상태 저장 (매 에이전트 완료 시) */
  saveProjectState(projectId: string, state: ProjectState): void;

  /** 프로젝트 상태 로드 (세션 시작 시) */
  loadProjectState(projectId: string): ProjectState;

  /** 에이전트 보고서 저장 */
  saveAgentReport(projectId: string, report: AgentReport): void;

  /** 주요 결정사항 추가 */
  addDecision(projectId: string, decision: Decision): void;

  // ──── Layer 3: Session Logs ────

  /** 세션 요약 자동 생성 (세션 종료 시) */
  generateSessionSummary(sessionId: string): Promise<string>;

  /** 세션 로그 저장 */
  saveSessionLog(session: Session): void;
}

interface ProjectState {
  features: { name: string; status: FeatureStatus }[];
  completedCount: number;
  totalCount: number;
  lastActivity: string;
  keyDecisions: string[];        // 주요 결정사항 요약 (최근 10개)
}
```

---

## 5. IPC 통신 설계

### 5.1 채널 정의

```typescript
// src/shared/ipc-channels.ts

// ──── Renderer → Main (요청) ────
type IPCInvoke = {
  // Discovery
  "discovery:start":          { presetId: string } => DiscoveryQuestion[];
  "discovery:answer":         { questionId: string; answer: string } => DiscoveryQuestion | null;
  "discovery:complete":       { answers: DiscoveryAnswer[] } => SpecCard;

  // 오케스트레이션
  "pipeline:start":           { projectId: string } => void;
  "pipeline:pause":           { projectId: string } => void;
  "pipeline:resume":          { projectId: string } => void;
  "checkpoint:respond":       { checkpointId: string; action: "approve" | "modify" | "cancel" } => void;

  // 프로젝트
  "project:create":           { name: string; presetId: string } => Project;
  "project:list":             {} => Project[];
  "project:load":             { projectId: string } => Project;

  // 프리셋/에이전트
  "preset:list":              {} => Preset[];
  "preset:save":              { preset: Preset } => void;
  "agent:generate-guidelines":{ projectId: string; presetId: string; description: string }
                              => GuidelineGenResult;
  "agent:save":               { presetId: string; agent: AgentDefinition } => void;
  "agent:delete":             { presetId: string; agentId: string } => void;

  // 활동 로그
  "activities:list":          { projectId: string; limit: number; offset: number;
                                filter?: ActivityEventType[] } => ActivityEntry[];
};

// ──── Main → Renderer (이벤트 스트림) ────
type IPCEvents = {
  "agent:status-changed":     { agentId: string; status: AgentStatus; featureId?: string };
  "agent:activity":           ActivityEntry;
  "agent:change-summary":     { agentId: string; summary: string; filesChanged: string[] };
  "checkpoint:request":       { checkpointId: string; type: string; data: unknown };
  "pipeline:progress":        { completedFeatures: number; totalFeatures: number };
  "pipeline:complete":        { projectId: string };
  "pipeline:error":           { projectId: string; error: string };
};
```

### 5.2 보안 (contextBridge)

```typescript
// src/main/preload.ts
// Renderer에서 접근 가능한 API만 노출 (보안)

contextBridge.exposeInMainWorld("harness", {
  // invoke 함수들
  discovery: {
    start: (presetId: string) => ipcRenderer.invoke("discovery:start", { presetId }),
    answer: (questionId: string, answer: string) => ipcRenderer.invoke("discovery:answer", { questionId, answer }),
    complete: (answers: DiscoveryAnswer[]) => ipcRenderer.invoke("discovery:complete", { answers }),
  },
  pipeline: {
    start: (projectId: string) => ipcRenderer.invoke("pipeline:start", { projectId }),
    pause: (projectId: string) => ipcRenderer.invoke("pipeline:pause", { projectId }),
    // ...
  },
  // event listeners
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
});
```

---

## 6. UI/UX 설계

### 6.1 페이지 구조

```
App
├── WelcomePage             ← 첫 실행 / 프로젝트 없을 때
│   └── "새 프로젝트 시작"
├── DiscoveryPage           ← 프리셋 선택 → 질문 위저드 → 스펙 카드
│   ├── PresetSelector
│   ├── QuestionWizard
│   └── SpecCardReview
├── DashboardPage           ← 메인 화면 (3패널)
│   ├── Sidebar             ← 네비게이션
│   ├── MainPanel           ← 에이전트 카드 / 진행률
│   │   ├── AgentCardGrid
│   │   ├── ProgressBar
│   │   └── FeatureList
│   ├── DetailPanel         ← 선택한 에이전트 상세
│   │   ├── AgentDetail
│   │   ├── ChangeSummary
│   │   └── FindingsList
│   └── ActivityPanel       ← 하단 활동 로그 (접기 가능)
│       └── ActivityFeed
├── PresetEditorPage        ← 프리셋/에이전트 관리
│   ├── PresetList
│   ├── AgentList
│   ├── AgentEditorSimple   ← 간편 모드 (AI 지침 자동 작성)
│   └── AgentEditorAdvanced ← 상세 모드
├── SettingsPage            ← 앱 설정
└── CheckpointModal         ← 사용자 확인 오버레이 (어디서든 팝업)
```

### 6.2 핵심 컴포넌트 목록

| 컴포넌트 | 위치 | 역할 | 참고 레퍼런스 |
|----------|------|------|-------------|
| `AgentCard` | Dashboard | 에이전트 상태 카드 (아이콘, 상태, 진행률, 비용) | Linear 이슈 카드 |
| `StatusDot` | 공통 | 상태 표시 (●○✓⊘ + 애니메이션) | Linear 상태 아이콘 |
| `ActivityFeed` | Dashboard | 시간순 로그 (필터, 접기/펼치기) | Vercel 빌드 로그 |
| `QuestionWizard` | Discovery | 단계별 질문 (진행 바, 선택지, 기타 입력) | Vercel 프로젝트 셋업 |
| `SpecCard` | Discovery | 스펙 요약 (핵심/확장/기술스택, 항목별 수정) | — |
| `ChangeSummary` | Dashboard | 비전공자 변경 요약 ("뭐가 바뀌었는지") | — |
| `CheckpointModal` | 오버레이 | 사용자 확인 요청 (승인/수정/취소) | — |
| `AgentEditorSimple` | PresetEditor | "뭘 하는지 한 줄 입력" → AI가 지침 생성 | — |
| `AgentEditorAdvanced` | PresetEditor | 역할/목표/제약/지침 직접 편집 | CrewAI 에이전트 설정 |
| `ProgressBar` | Dashboard | 전체 기능 진행률 | Vercel 빌드 단계 |
| `DesktopNotification` | 시스템 | 에이전트 완료/오류 알림 (Electron API) | Discord 알림 |

### 6.3 Zustand Store 구조

```typescript
// src/renderer/stores/index.ts

interface AppStore {
  // ── 현재 프로젝트 ──
  currentProject: Project | null;
  features: Feature[];

  // ── 에이전트 상태 (실시간) ──
  agents: Map<string, {
    definition: AgentDefinition;
    status: AgentStatus;
    currentFeature: string | null;
    progress: { current: number; total: number } | null;
    lastActivity: string;
  }>;

  // ── 활동 로그 ──
  activities: ActivityEntry[];       // 최근 100개 유지 (스크롤 시 추가 로드)

  // ── 파이프라인 상태 ──
  pipeline: {
    status: "idle" | "running" | "paused" | "completed";
    completedFeatures: number;
    totalFeatures: number;
  };

  // ── 체크포인트 ──
  pendingCheckpoint: {
    id: string;
    type: string;
    data: unknown;
  } | null;

  // ── Discovery ──
  discovery: {
    step: number;
    totalSteps: number;
    answers: DiscoveryAnswer[];
    specCard: SpecCard | null;
  };

  // ── UI 상태 ──
  ui: {
    selectedAgentId: string | null;
    activityPanelOpen: boolean;
    activityFilter: ActivityEventType[] | null;
  };
}
```

### 6.4 다크 테마 디자인 토큰

```typescript
// src/renderer/styles/tokens.ts
// Tailwind CSS로 구현, shadcn/ui 테마 오버라이드

const tokens = {
  colors: {
    bg: {
      base:    "#0a0a0a",   // Level 0
      card:    "#1a1a1a",   // Level 1
      hover:   "#252525",   // Level 2
      active:  "#2a2a2a",   // Level 3
    },
    border: {
      subtle:  "#2e2e2e",
      strong:  "#404040",
    },
    text: {
      primary:   "#e5e5e5",
      secondary: "#888888",
      muted:     "#555555",
    },
    status: {
      success: "#22c55e",
      warning: "#eab308",
      error:   "#ef4444",
      info:    "#3b82f6",
      neutral: "#6b7280",
    },
    accent: "#8b5cf6",       // 보라 (브랜드)
  },
  spacing: {
    panel: "16px",
    card:  "12px",
    gap:   "8px",
  },
  radius: {
    card: "8px",
    button: "6px",
    badge: "4px",
  },
  font: {
    sans: "'Inter', -apple-system, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
};
```

---

## 7. 에러 처리

### 7.1 에러 분류 및 대응

| 에러 유형 | 원인 | 자동 대응 | 사용자 알림 |
|-----------|------|----------|------------|
| CLI 프로세스 크래시 | Claude Code 비정상 종료 | project_state 저장 → 자동 재시작 시도 (1회) | "에이전트가 중단되었습니다. 재시작 중..." |
| Rate Limit | API 속도 제한 | 30초 대기 후 자동 재시도 | 활동 로그에 "속도 제한, 30초 후 재시도" |
| Evaluator 3회 실패 | 코드 품질 미달 | 루프 중단 | 체크포인트 팝업 "3회 시도 실패" |
| 빌드 실패 | 컴파일 에러 | Evaluator가 에러 내용을 Generator에게 전달 | "빌드 실패: [에러 요약]" |
| 파일 충돌 | 에이전트가 같은 파일 동시 수정 | 순차 실행으로 방지 (설계상 발생 안 함) | — |
| 네트워크 끊김 | 인터넷 연결 실패 | 1분 간격 재시도 (최대 5회) | "인터넷 연결을 확인해주세요" |
| 디스크 부족 | 저장 공간 부족 | — | "저장 공간이 부족합니다" |

### 7.2 상태 보존 원칙

```
어떤 에러가 발생하든:
  1. project_state.json은 반드시 마지막 안정 상태로 저장
  2. 진행 중이던 feature는 "failed" 상태로 마킹 (rollback 아님)
  3. 활동 로그에 에러 기록
  4. 다음 세션에서 "failed" 상태의 feature부터 재시작 가능
```

---

## 8. 테스트 계획

| 유형 | 대상 | 도구 | 우선순위 |
|------|------|------|---------|
| Unit | PromptAssembler, MemoryManager, Preset YAML 파싱 | Vitest | High |
| Unit | Zustand Store 상태 변이 | Vitest | Medium |
| Integration | CLI Bridge ↔ Claude Code CLI 통신 | Vitest + mock process | High |
| Integration | IPC Main↔Renderer 메시지 흐름 | Electron test utilities | High |
| E2E | Discovery → Spec Card 생성 전체 플로우 | Playwright + Electron | Medium |
| E2E | Generator → Evaluator 루프 1회전 | Playwright + Electron | Medium |

---

## 9. 구현 순서

### Phase 1: 뼈대 (Week 1)

1. [ ] Electron + React + Vite + Tailwind + shadcn/ui 프로젝트 셋업
2. [ ] 다크 테마 디자인 토큰 적용
3. [ ] 3패널 레이아웃 셸 (Sidebar + Main + Detail + Bottom Panel)
4. [ ] IPC 기본 구조 (preload.ts + contextBridge)
5. [ ] SQLite 스키마 생성 + MemoryManager 기본 CRUD

### Phase 2: Discovery (Week 2)

6. [ ] PresetManager — YAML 프리셋 로드/저장
7. [ ] Discovery 위저드 UI (QuestionWizard + SpecCard)
8. [ ] 게임 프리셋 1개 하드코딩 (질문 5~8개)
9. [ ] SpecCard 확인/수정 UI

### Phase 3: 에이전트 실행 (Week 3)

10. [ ] CLIBridge — Claude Code CLI spawn + stdout 파싱
11. [ ] PromptAssembler — 모듈식 프롬프트 조립
12. [ ] AgentEngine — 에이전트 생명주기 관리
13. [ ] Orchestrator — Planner → Generator → Evaluator 기본 루프
14. [ ] 체크포인트 모달 (CheckpointModal)

### Phase 4: 대시보드 (Week 4)

15. [ ] AgentCard 컴포넌트 (StatusDot + 진행률 + 비용)
16. [ ] ActivityFeed 컴포넌트 (실시간 로그 스트리밍)
17. [ ] ChangeSummary 컴포넌트 (비전공자 변경 요약)
18. [ ] ProgressBar (전체 기능 진행률)
19. [ ] 데스크톱 알림 (Notification API)

### Phase 5: 기억 + 프리셋 (Week 5)

20. [ ] 세션 요약 자동 생성 (세션 종료 시)
21. [ ] Project State 자동 로드 (앱 시작 시)
22. [ ] GuidelineGenerator — AI 지침 자동 작성
23. [ ] AgentEditorSimple + AgentEditorAdvanced UI
24. [ ] 프리셋 관리 화면 (생성/복제/편집)

### Phase 6: 안정화 (Week 6)

25. [ ] 에러 처리 + 자동 복구
26. [ ] 상태 보존 검증
27. [ ] Evaluator 반려 → Generator 재시도 루프 안정화
28. [ ] electron-builder 패키징 + 설치 테스트

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-28 | Initial design — 아키텍처, 데이터모델, IPC, 핵심모듈, UI구조 | User + Claude |
