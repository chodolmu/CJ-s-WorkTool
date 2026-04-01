# Design: UX Enhancement — 선제적 가이드 + 비용 최적화 + 대시보드 강화

> Plan 문서: `docs/01-plan/features/ux-enhancement.plan.md`

---

## 1. Feature 4: Dashboard 강화 (실시간 에이전트 상태)

### 1-1. 문제 분석

**현재 이벤트 흐름** (이미 작동하는 부분):
```
pipeline.ts runAgent()
  → session.on("event") → this.emit("activity", { agentId, eventType: "thinking"|"tool_call" })
  → index.ts: activePipeline.on("activity") → mainWindow.send("agent:activity")
  → useIpcEvents.ts: on("agent:activity") → updateAgentStatus(agentId, "running")
```

**문제**: `useIpcEvents.ts:77-79`에서 `system/thinking/tool_call` 이벤트가 오면 `running`으로 바꾸는 코드가 이미 있음. 하지만:
1. Pipeline의 `runAgent()`가 시작할 때 `system` 이벤트를 emit하지만, CLI 프로세스가 spawn되고 첫 이벤트가 올 때까지 에이전트 상태가 초기화되지 않음
2. `step_started` 이벤트에서 에이전트 상태를 `running`으로 명시적으로 바꾸지 않음
3. SmartOrchestrator에서도 동일한 패턴 — `activity` 이벤트만 emit하고 명시적 `agent:status` 이벤트 없음

### 1-2. 설계: 명시적 에이전트 상태 이벤트 추가

**새 IPC 이벤트**: `agent:status-change`

```typescript
// 새로운 이벤트 (index.ts에서 broadcast)
interface AgentStatusChangeEvent {
  agentId: string;
  status: AgentStatus;          // "running" | "completed" | "failed" | "queued"
  substatus?: "thinking" | "tool_call" | "idle";  // running 세부 상태
  currentFeature?: string;      // 현재 처리 중인 기능명
}
```

**수정 포인트**:

#### A. `pipeline.ts` — runAgent() 시작/종료 시 명시적 상태 emit

```typescript
// runAgent() 내부, CLI spawn 직전
this.emit("agent_status", { agentId, status: "running", currentFeature: feature?.name });

// session.on("event") 내부 — substatus 업데이트
this.emit("agent_status", {
  agentId,
  status: "running",
  substatus: event.type === "tool_use" ? "tool_call" : "thinking",
});

// 완료/실패 시
this.emit("agent_status", { agentId, status: result.success ? "completed" : "failed" });
```

#### B. `pipeline.ts` — Feature 루프 시작 시 에이전트 상태 초기화

```typescript
// runFeatureLoop() 시작 시 — 관련 에이전트를 queued→running으로
this.emit("agent_status", { agentId: "generator", status: "queued", currentFeature: feature.name });
this.emit("agent_status", { agentId: "evaluator", status: "queued", currentFeature: feature.name });
```

#### C. `smart-orchestrator.ts` — 동일 패턴 적용

```typescript
// step 실행 전
this.emit("agent_status", { agentId: step.agentId, status: "running" });

// step 완료 후
this.emit("agent_status", { agentId: step.agentId, status: result.success ? "completed" : "failed" });
```

#### D. `index.ts` — 새 이벤트 broadcast 추가

```typescript
// Pipeline 이벤트 연결 부분 (~line 523)
activePipeline.on("agent_status", (data: unknown) =>
  mainWindow?.webContents.send("agent:status-change", data)
);

// Orchestrator 이벤트도 동일하게
orchestrator.on("agent_status", (data: unknown) =>
  mainWindow?.webContents.send("agent:status-change", data)
);
```

#### E. `useIpcEvents.ts` — 새 이벤트 수신

```typescript
// 기존 agent:activity 핸들러의 상태 추적 로직은 유지 (폴백)
// 새로운 명시적 상태 이벤트 추가
cleanups.push(
  window.harness.on("agent:status-change", (data: {
    agentId: string;
    status: AgentStatus;
    substatus?: string;
    currentFeature?: string;
  }) => {
    updateAgentStatus(data.agentId, data.status, data.currentFeature);
    // substatus는 store에 새 필드로 저장
    if (data.substatus) {
      updateAgentSubstatus(data.agentId, data.substatus);
    }
  }),
);
```

#### F. `app-store.ts` — substatus 필드 추가

```typescript
// AgentCardData 확장 (AgentCard.tsx에서도 import)
interface AgentCardData {
  // ...기존 필드
  substatus?: "thinking" | "tool_call" | "idle";  // NEW
}

// 새 액션
updateAgentSubstatus: (agentId: string, substatus: string) => void;
```

#### G. `AgentCard.tsx` — running 세부 상태 표시

```tsx
// running 상태일 때 substatus에 따라 다른 표시
{agent.status === "running" && (
  <div className="flex items-center gap-1.5 text-[10px]">
    {agent.substatus === "thinking" && (
      <><span className="text-accent animate-pulse">...</span> 생각 중</>
    )}
    {agent.substatus === "tool_call" && (
      <><span className="text-status-info">▸</span> 도구 실행 중</>
    )}
    {!agent.substatus && (
      <><span className="text-status-success animate-pulse">●</span> 실행 중</>
    )}
  </div>
)}
```

#### H. `StatusDot.tsx` — 변경 불필요
이미 `running`에 `pulse: true`, `bg-status-success` 정의됨. 그대로 사용.

#### I. `preload/index.ts` — 새 이벤트 등록

```typescript
// on() 메서드가 이벤트명을 제한하지 않으므로 자동 작동
// 단, TypeScript 타입에 "agent:status-change" 추가 필요
```

### 1-3. 수정 파일 요약

| 파일 | 변경 내용 | LOC 예상 |
|---|---|---|
| `src/main/orchestrator/pipeline.ts` | `agent_status` emit 추가 (runAgent, runFeatureLoop) | +20 |
| `src/main/orchestrator/smart-orchestrator.ts` | `agent_status` emit 추가 | +8 |
| `src/main/index.ts` | `agent_status` → `agent:status-change` broadcast | +6 |
| `src/renderer/hooks/useIpcEvents.ts` | `agent:status-change` 수신 | +12 |
| `src/renderer/stores/app-store.ts` | `substatus` 필드 + `updateAgentSubstatus` 액션 | +15 |
| `src/renderer/components/AgentCard.tsx` | running substatus 표시 | +15 |
| `src/shared/types.ts` | `AgentSubstatus` 타입 추가 | +2 |

---

## 2. Feature 3: Worker Agent (Sonnet 실행 에이전트)

### 2-1. 현재 흐름 분석

```
Director.handleRequest() [sonnet, line 158]
  → mode: "direct" → steps: [{ agentId: "generator", task }]
  → SmartOrchestrator가 Generator(모델 가변)로 실행
```

Director 자체는 이미 sonnet을 사용 (line 158). 문제는 `direct` 모드에서도 `generator`를 지정하고, Generator의 model은 프리셋에 따라 다름 (opus일 수도 있음).

### 2-2. 설계: Worker Agent 추가

#### A. Worker 에이전트 정의

모든 프리셋에 `worker.yaml` 추가:

```yaml
# resources/presets/{all}/agents/worker.yaml
id: worker
displayName: "Worker"
icon: "⚡"
role: "범용 실행 에이전트 — 간단~중간 복잡도 작업 처리"
goal: "Director의 지시를 받아 코드 수정, 버그 픽스, 설명 등 실행"
constraints:
  - "한 번에 하나의 작업만 처리"
  - "불확실한 부분은 최선의 판단으로 처리"
model: sonnet
trigger: manual  # Director만 호출
guidelines:
  - "기존 코드 구조를 따를 것"
  - "최소한의 변경으로 목표 달성"
outputFormat: '{"changeSummary": "...", "filesChanged": ["..."]}'
```

#### B. Director.handleRequest() 라우팅 변경

```typescript
// director-agent.ts handleRequest() 내부
// 현재: direct → generator, light → generator+evaluator
// 변경: direct → worker, light → worker+evaluator

private buildDefaultSteps(mode: string, userMessage: string, agents: AgentDefinition[]): WorkStep[] {
  const hasWorker = agents.some(a => a.id === "worker");
  const hasEvaluator = agents.some(a => a.id === "evaluator");

  if (mode === "direct") {
    // Worker가 있으면 Worker 사용, 없으면 Generator 폴백
    const executor = hasWorker ? "worker" : "generator";
    return [{ agentId: executor, task: userMessage, required: true }];
  }

  if (mode === "light") {
    const executor = hasWorker ? "worker" : "generator";
    const steps: WorkStep[] = [{ agentId: executor, task: userMessage, required: true }];
    if (hasEvaluator) steps.push({ agentId: "evaluator", task: `Evaluate: ${userMessage}`, required: false });
    return steps;
  }

  // full — 기존 로직 유지 (Generator 사용)
  // ...기존 코드
}
```

#### C. Director 프롬프트에 Worker 안내 추가

```typescript
// handleRequest() 프롬프트 내
## Available Agents
${agentNames}

## Mode Selection Rules
- "direct": Simple task → assign to "worker" (NOT generator)
- "light": Medium task → "worker" + "evaluator"
- "full": Complex task → "planner" + "generator" + "evaluator"
- Use "generator" only in "full" mode for complex implementation
```

#### D. SmartOrchestrator — Worker 실행 (변경 최소)

SmartOrchestrator는 이미 `agents.find(a => a.id === step.agentId)`로 에이전트를 찾으므로, Worker가 프리셋에 있으면 자동으로 찾아서 실행됨. `buildAgentPrompt()`도 범용적이라 변경 불필요.

#### E. Pipeline — core 에이전트 보호 목록에 Worker 추가

```typescript
// worker는 core 에이전트가 아닌 준-core로 분류
// selectOptionalAgents()에서 제외 (pipeline이 직접 호출하지 않음)
const coreIds = new Set(["director", "planner", "generator", "evaluator", "worker"]);
```

#### F. pipeline.ts — buildAgentSystemPrompt()에 Worker 추가

```typescript
case "worker":
  return `${base}

당신은 범용 실행 에이전트입니다. Director의 지시를 받아 작업을 수행합니다.

## 규칙
1. 요청된 작업만 수행하세요
2. 기존 코드 구조를 따르세요
3. 간결하고 정확하게 작업하세요
${hints?.techConstraints?.length ? `4. 기술 제약: ${hints.techConstraints.join(", ")}` : ""}

## 출력
작업 완료 후 변경 요약:
\`\`\`json
{"changeSummary": "변경 내용 한 줄 요약"}
\`\`\``;
```

### 2-3. 수정 파일 요약

| 파일 | 변경 내용 | LOC 예상 |
|---|---|---|
| `resources/presets/*/agents/worker.yaml` | Worker 에이전트 정의 (5개 프리셋) | 5 x 15 |
| `src/main/orchestrator/director-agent.ts` | buildDefaultSteps에서 direct/light → worker 라우팅 + 프롬프트 수정 | +15 |
| `src/main/orchestrator/pipeline.ts` | coreIds에 worker 추가 + buildAgentSystemPrompt worker case | +20 |
| `src/shared/types.ts` | 변경 불필요 (AgentDefinition 그대로 사용) | 0 |

---

## 3. Feature 1: Phase Coach (선제적 가이드 시스템)

### 3-1. 설계 원칙

```
Touch Level 정의:
  HIGH   = Phase 전환 시 가이드 메시지 + 구조화된 입력 요청
  MEDIUM = Phase 전환 시 가이드 메시지 + 간단한 확인
  AUTO   = 자동 진행, 진행률 알림만
  LIGHT  = 완료 시 결과 요약 + 수정 여부 확인
```

### 3-2. 타입 정의

```typescript
// src/shared/types.ts

export type TouchLevel = "high" | "medium" | "auto" | "light";

export interface PhaseCoachMessage {
  phase: string;                    // "planning" | "design" | "implement" | "test" | "polish"
  touchLevel: TouchLevel;
  title: string;                    // "기능 목록을 검토해주세요"
  description: string;              // 상세 안내
  actions?: PhaseCoachAction[];     // 사용자가 할 수 있는 액션
  autoAdvance: boolean;             // true면 사용자 입력 없이 자동 진행
}

export interface PhaseCoachAction {
  id: string;
  label: string;                    // "승인", "수정", "건너뛰기"
  type: "approve" | "edit" | "skip";
}
```

### 3-3. Phase별 Touch Level 매핑

```typescript
// src/main/orchestrator/phase-coach.ts (신규)

const PHASE_TOUCH_MAP: Record<string, { touchLevel: TouchLevel; template: PhaseCoachTemplate }> = {
  planning: {
    touchLevel: "high",
    template: {
      title: "기능 목록을 검토해주세요",
      description: "Director가 {featureCount}개 기능으로 나눴습니다. 우선순위와 범위를 확인해주세요.",
      actions: [
        { id: "approve", label: "이대로 진행", type: "approve" },
        { id: "edit", label: "수정하기", type: "edit" },
      ],
      autoAdvance: false,
    },
  },
  design: {
    touchLevel: "medium",
    template: {
      title: "설계 방향을 확인합니다",
      description: "핵심 아키텍처 결정을 진행합니다. 큰 방향만 확인해주세요.",
      actions: [
        { id: "approve", label: "확인", type: "approve" },
      ],
      autoAdvance: false,
    },
  },
  implement: {
    touchLevel: "auto",
    template: {
      title: "구현을 시작합니다",
      description: "{featureCount}개 기능을 순차적으로 구현합니다. 완료되면 알려드릴게요.",
      actions: [],
      autoAdvance: true,
    },
  },
  test: {
    touchLevel: "auto",
    template: {
      title: "검증 진행 중",
      description: "Evaluator가 각 기능을 검증하고 있습니다.",
      actions: [],
      autoAdvance: true,
    },
  },
  polish: {
    touchLevel: "light",
    template: {
      title: "결과를 확인해주세요",
      description: "모든 기능이 완료되었습니다. 수정이 필요한 부분이 있으면 알려주세요.",
      actions: [
        { id: "approve", label: "완료", type: "approve" },
        { id: "edit", label: "수정 요청", type: "edit" },
      ],
      autoAdvance: false,
    },
  },
};
```

### 3-4. Pipeline 통합

```typescript
// pipeline.ts run() 내부 — Phase 전환 시 Coach 메시지 emit

private emitPhaseCoach(phase: string, context: Record<string, unknown>): void {
  const config = PHASE_TOUCH_MAP[phase];
  if (!config) return;

  const message: PhaseCoachMessage = {
    phase,
    touchLevel: config.touchLevel,
    title: this.interpolate(config.template.title, context),
    description: this.interpolate(config.template.description, context),
    actions: config.template.actions,
    autoAdvance: config.template.autoAdvance,
  };

  this.emit("phase_coach", message);

  // AUTO 레벨이 아니면 체크포인트로 대기
  if (!message.autoAdvance) {
    // 기존 requestCheckpoint를 활용
  }
}
```

### 3-5. UI: PhaseCoachBanner 컴포넌트

```tsx
// src/renderer/components/PhaseCoachBanner.tsx (신규)

interface PhaseCoachBannerProps {
  message: PhaseCoachMessage;
  onAction: (actionId: string) => void;
}

// 채팅 화면 상단에 표시되는 배너
// touchLevel에 따라 스타일 차등:
//   HIGH   → 전체 화면 오버레이, 큰 카드
//   MEDIUM → 상단 배너, 중간 크기
//   AUTO   → 작은 알림 바 (자동 사라짐)
//   LIGHT  → 하단 배너, 액션 버튼 포함
```

### 3-6. IPC 이벤트 추가

```typescript
// index.ts
activePipeline.on("phase_coach", (msg: unknown) =>
  mainWindow?.webContents.send("phase:coach", msg)
);

// useIpcEvents.ts
window.harness.on("phase:coach", (data: PhaseCoachMessage) => {
  setPhaseCoach(data);  // 새 store 필드
});

// preload/index.ts — phase:coach 응답 핸들러
ipcMain.handle("phase:coach-respond", (_e, { actionId }) => {
  // pipeline의 checkpoint에 응답 전달
});
```

### 3-7. 수정 파일 요약

| 파일 | 변경 내용 | LOC 예상 |
|---|---|---|
| `src/main/orchestrator/phase-coach.ts` | (신규) Phase Coach 로직 + Touch Level 매핑 | ~80 |
| `src/main/orchestrator/pipeline.ts` | `emitPhaseCoach()` 호출 추가 (각 Phase 전환 시) | +15 |
| `src/main/index.ts` | `phase_coach` 이벤트 broadcast + respond 핸들러 | +10 |
| `src/renderer/components/PhaseCoachBanner.tsx` | (신규) 가이드 배너 UI | ~100 |
| `src/renderer/hooks/useIpcEvents.ts` | `phase:coach` 수신 | +8 |
| `src/renderer/stores/app-store.ts` | `phaseCoach` 필드 + setter | +10 |
| `src/renderer/pages/ChatPage.tsx` | PhaseCoachBanner 통합 | +10 |
| `src/shared/types.ts` | TouchLevel, PhaseCoachMessage 타입 | +20 |
| `src/preload/index.ts` | coach-respond IPC 추가 | +5 |

---

## 4. Feature 2: Smart Input (구조화된 사용자 입력)

### 4-1. 동작 흐름

```
Phase Coach (HIGH/MEDIUM) → "입력 필요" 판단
  → Director.generateSmartQuestions(context) [sonnet, 1회 호출]
  → SmartInputRequest { questions[] } 생성
  → UI에 SmartInputForm 렌더링
  → 사용자 응답 수집
  → 파이프라인에 주입 (checkpoint respond와 동일 메커니즘)
```

### 4-2. 타입 정의

```typescript
// src/shared/types.ts

export interface SmartQuestion {
  id: string;
  question: string;               // "이 기능들의 우선순위를 조정하시겠습니까?"
  type: "select" | "multiselect" | "text" | "confirm";
  options?: { label: string; value: string; description?: string }[];
  defaultValue?: string;
  required: boolean;
}

export interface SmartInputRequest {
  id: string;
  phase: string;                   // 어떤 Phase에서 요청됐는지
  context: string;                 // 사용자에게 보여줄 맥락 설명
  questions: SmartQuestion[];
}

export interface SmartInputResponse {
  requestId: string;
  answers: Record<string, string>; // questionId → value
}
```

### 4-3. Director.generateSmartQuestions()

```typescript
// director-agent.ts

async generateSmartQuestions(params: {
  phase: string;
  specCard: SpecCard;
  features?: Feature[];
  currentState: string;  // 현재 상태 요약
}): Promise<SmartQuestion[]> {
  const prompt = `You are the Director. Generate 2-4 focused questions for the user.

## Current Phase: ${params.phase}
## Project: ${params.specCard.projectType}
## State: ${params.currentState}
${params.features ? `## Features: ${params.features.map(f => f.name).join(", ")}` : ""}

Generate questions that help clarify the user's intent for this phase.
Keep questions simple — prefer "select" and "confirm" types over "text".

Output JSON:
{ "questions": [{ "id": "q1", "question": "...", "type": "select|confirm|text", "options": [...], "required": true }] }`;

  // sonnet으로 호출 (비용 절감)
  const session = this.cliBridge.spawn(prompt, {
    workingDir: ".",
    model: "sonnet",
    systemPrompt: "[OVERRIDE] WorkTool Director. JSON만 출력.",
    outputFormat: "text",
  });

  // ... 파싱 후 SmartQuestion[] 반환
}
```

### 4-4. 적용 시점 (Phase Coach 연동)

```typescript
// phase-coach.ts

// HIGH Touch 단계에서만 Smart Input 활성화
if (touchLevel === "high") {
  const questions = await director.generateSmartQuestions({
    phase,
    specCard: this.config.specCard,
    features,
    currentState: this.buildStateContext(),
  });

  if (questions.length > 0) {
    this.emit("smart_input", {
      id: `si-${phase}-${Date.now()}`,
      phase,
      context: coachMessage.description,
      questions,
    });

    // 사용자 응답 대기
    const response = await this.waitForSmartInput();
    // response를 다음 에이전트 프롬프트에 주입
  }
}

// MEDIUM Touch → Smart Input 없음, 단순 확인만
// AUTO → 스킵
// LIGHT → 선택적 (결과 수정 요청 시에만)
```

### 4-5. UI: SmartInputForm 컴포넌트

```tsx
// src/renderer/components/SmartInputForm.tsx (신규)

interface SmartInputFormProps {
  request: SmartInputRequest;
  onSubmit: (response: SmartInputResponse) => void;
  onSkip: () => void;
}

// 채팅 영역에 인라인으로 표시
// 질문 타입별 렌더링:
//   select     → 라디오 버튼 그룹
//   multiselect → 체크박스 그룹
//   text       → 텍스트 입력
//   confirm    → 예/아니오 버튼
//
// 하단: [제출] [건너뛰기] 버튼
// 건너뛰기 시 AI가 기본값으로 진행
```

### 4-6. 수정 파일 요약

| 파일 | 변경 내용 | LOC 예상 |
|---|---|---|
| `src/main/orchestrator/director-agent.ts` | `generateSmartQuestions()` 메서드 | +40 |
| `src/main/orchestrator/phase-coach.ts` | Smart Input 통합 (HIGH Touch에서 호출) | +25 |
| `src/main/index.ts` | `smart_input` broadcast + respond 핸들러 | +15 |
| `src/renderer/components/SmartInputForm.tsx` | (신규) 동적 질문 폼 | ~120 |
| `src/renderer/pages/ChatPage.tsx` | SmartInputForm 렌더링 | +15 |
| `src/renderer/hooks/useIpcEvents.ts` | `smart-input:request` 수신 | +8 |
| `src/renderer/stores/app-store.ts` | `smartInputRequest` 필드 | +10 |
| `src/shared/types.ts` | SmartQuestion, SmartInputRequest/Response | +25 |
| `src/preload/index.ts` | smart-input IPC | +8 |

---

## 5. 구현 순서 (상세)

### Phase 1: Dashboard 강화

```
Step 1: types.ts — AgentSubstatus 타입 추가
Step 2: pipeline.ts — agent_status emit 추가 (runAgent, runFeatureLoop)
Step 3: smart-orchestrator.ts — agent_status emit 추가
Step 4: index.ts — agent:status-change broadcast 연결
Step 5: app-store.ts — substatus 필드 + updateAgentSubstatus
Step 6: useIpcEvents.ts — agent:status-change 수신
Step 7: AgentCard.tsx — running substatus 표시
```

### Phase 2: Worker Agent

```
Step 1: resources/presets/*/agents/worker.yaml — 5개 프리셋에 Worker 정의
Step 2: director-agent.ts — buildDefaultSteps에서 direct/light → worker
Step 3: director-agent.ts — handleRequest 프롬프트에 Worker 안내 추가
Step 4: pipeline.ts — coreIds에 worker 추가 + buildAgentSystemPrompt
Step 5: 빌드 확인
```

### Phase 3: Phase Coach

```
Step 1: types.ts — TouchLevel, PhaseCoachMessage 타입
Step 2: phase-coach.ts — (신규) Touch Level 매핑 + 메시지 생성
Step 3: pipeline.ts — Phase 전환 시 emitPhaseCoach() 호출
Step 4: index.ts — phase_coach broadcast + respond 핸들러
Step 5: preload/index.ts — coach IPC 추가
Step 6: app-store.ts — phaseCoach 필드
Step 7: useIpcEvents.ts — phase:coach 수신
Step 8: PhaseCoachBanner.tsx — (신규) UI 컴포넌트
Step 9: ChatPage.tsx — 배너 통합
```

### Phase 4: Smart Input

```
Step 1: types.ts — SmartQuestion, SmartInputRequest/Response
Step 2: director-agent.ts — generateSmartQuestions()
Step 3: phase-coach.ts — HIGH Touch에서 Smart Input 호출
Step 4: index.ts — smart_input broadcast + respond
Step 5: preload/index.ts — smart-input IPC
Step 6: app-store.ts — smartInputRequest 필드
Step 7: useIpcEvents.ts — smart-input:request 수신
Step 8: SmartInputForm.tsx — (신규) 동적 폼 컴포넌트
Step 9: ChatPage.tsx — SmartInputForm 렌더링
```

---

## 6. 전체 수정 파일 목록

| 파일 | Phase | 신규/수정 |
|---|---|---|
| `src/shared/types.ts` | 1,3,4 | 수정 |
| `src/main/orchestrator/pipeline.ts` | 1,2,3 | 수정 |
| `src/main/orchestrator/smart-orchestrator.ts` | 1 | 수정 |
| `src/main/orchestrator/director-agent.ts` | 2,4 | 수정 |
| `src/main/orchestrator/phase-coach.ts` | 3,4 | **신규** |
| `src/main/index.ts` | 1,3,4 | 수정 |
| `src/preload/index.ts` | 1,3,4 | 수정 |
| `src/renderer/stores/app-store.ts` | 1,3,4 | 수정 |
| `src/renderer/hooks/useIpcEvents.ts` | 1,3,4 | 수정 |
| `src/renderer/components/AgentCard.tsx` | 1 | 수정 |
| `src/renderer/components/PhaseCoachBanner.tsx` | 3 | **신규** |
| `src/renderer/components/SmartInputForm.tsx` | 4 | **신규** |
| `src/renderer/pages/ChatPage.tsx` | 3,4 | 수정 |
| `resources/presets/*/agents/worker.yaml` | 2 | **신규** (x5) |

**합계**: 신규 3파일 + Worker YAML 5개, 수정 11파일
