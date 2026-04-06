# WorkTool v3 — 태스크 드리븐 아키텍처 설계

> **Feature**: 프로젝트 전체 재설계 — 태스크 분할 + 컨텍스트 관리 + 모델 배치
> **Plan Reference**: `docs/01-plan/features/v3-task-driven.plan.md`
> **Date**: 2026-04-06
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 현재 WorkTool은 하네스/GSD/에이전트 오케스트레이션에 집중. 실제 병목인 "AI에게 얼마나 잘게 쪼개서 명확하게 시키느냐"를 해결하지 못함. 비개발자에게 복잡한 기술 개념(하네스, 에이전트 풀, 파이프라인)을 노출 |
| **Solution** | Opus PM이 프로젝트를 마일스톤→스프린트→태스크로 자동 분할. 태스크 단위로 깨끗한 컨텍스트에서 실행. Handoff로 태스크 간 연결. 난이도별 모델 자동 배치 |
| **Function/UX Effect** | 사용자는 "뭘 만들고 싶다" 말하고 → 트리로 계획 보고 승인 → 자동 실행 지켜보기 → 중간 점검 |
| **Core Value** | "잘게 쪼개서, 명확하게, 깨끗한 컨텍스트에서" — AI를 제대로 쓰는 구조를 도구가 강제 |

---

## 1. 시스템 아키텍처

### 1.1 레이어 구조

```
┌─────────────────────────────────────────────────────────┐
│                    Renderer (React)                       │
│  ┌──────────┐ ┌──────────────┐ ┌────────────┐           │
│  │ Discovery │ │ Project Tree │ │ Task Detail│           │
│  └──────────┘ └──────────────┘ └────────────┘           │
├─────────────────────── IPC ──────────────────────────────┤
│                    Main Process                           │
│  ┌──────────────────────────────────────────────┐        │
│  │              Task Orchestrator                │        │
│  │  ┌────────┐ ┌──────────┐ ┌────────────────┐ │        │
│  │  │ Opus   │ │ Task     │ │ Context        │ │        │
│  │  │ PM     │ │ Runner   │ │ Manager        │ │        │
│  │  └────────┘ └──────────┘ └────────────────┘ │        │
│  │  ┌────────┐ ┌──────────┐ ┌────────────────┐ │        │
│  │  │ Model  │ │ Handoff  │ │ Validation     │ │        │
│  │  │ Router │ │ Manager  │ │ Runner         │ │        │
│  │  └────────┘ └──────────┘ └────────────────┘ │        │
│  └──────────────────────────────────────────────┘        │
│  ┌──────────┐ ┌──────────────┐ ┌────────────────┐       │
│  │ SQLite   │ │ SDK Chat     │ │ Harness Loader │       │
│  │ Database │ │ Engine       │ │ (선택적)        │       │
│  └──────────┘ └──────────────┘ └────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

### 1.2 모듈 책임

| 모듈 | 파일 (예정) | 역할 |
|------|------------|------|
| **Opus PM** | `src/main/opus-pm.ts` | 프로젝트 분할, 태스크 계획, 의존성 설계, 난이도/모델 판정 |
| **Task Runner** | `src/main/task-runner.ts` | 태스크 하나를 실행. 컨텍스트 주입, 모델 호출, 결과 수집 |
| **Context Manager** | `src/main/context-manager.ts` | handoff 조립, 태스크에 필요한 컨텍스트만 선별 주입 |
| **Model Router** | `src/main/model-router.ts` | 난이도→모델 매핑, API 키 관리, 비용 추적 |
| **Handoff Manager** | `src/main/handoff-manager.ts` | handoff CRUD, 의존성 기반 관련 handoff 조회 |
| **Validation Runner** | `src/main/validation-runner.ts` | 태스크/스프린트/마일스톤 단위 자동 검증 실행 |
| **Harness Loader** | `src/main/harness-loader.ts` | 하네스 모드 태스크 실행 시 하네스 로드 (기존 harness-manager 경량화) |

---

## 2. 데이터 모델

### 2.1 DB 스키마 (SQLite)

```sql
-- 프로젝트
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  spec_card_json TEXT,           -- Discovery 결과
  status TEXT DEFAULT 'planning', -- planning | active | paused | completed
  created_at TEXT,
  updated_at TEXT
);

-- 마일스톤
CREATE TABLE milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER,
  status TEXT DEFAULT 'pending', -- pending | active | completed | failed
  validation_strategy TEXT,
  created_at TEXT,
  completed_at TEXT
);

-- 스프린트
CREATE TABLE sprints (
  id TEXT PRIMARY KEY,
  milestone_id TEXT REFERENCES milestones(id),
  project_id TEXT REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER,
  status TEXT DEFAULT 'pending',
  validation_strategy TEXT,
  dependencies_json TEXT,        -- 선행 스프린트 ID 배열
  created_at TEXT,
  completed_at TEXT
);

-- 태스크
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  sprint_id TEXT REFERENCES sprints(id),
  project_id TEXT REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  plan TEXT,                     -- 구체적 실행 계획
  order_index INTEGER,
  status TEXT DEFAULT 'pending', -- pending | queued | running | completed | failed | skipped
  difficulty TEXT DEFAULT 'medium', -- easy | medium | hard
  model TEXT DEFAULT 'sonnet',   -- haiku | sonnet | opus
  execution_mode TEXT DEFAULT 'single', -- single | harness
  harness_id TEXT,               -- harness 모드일 때
  dependencies_json TEXT,        -- 선행 태스크 ID 배열
  validation_json TEXT,          -- { auto: string[], manual?: string }
  estimated_files_json TEXT,     -- 예상 변경 파일
  actual_files_json TEXT,        -- 실제 변경 파일
  cost REAL DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  created_at TEXT,
  started_at TEXT,
  completed_at TEXT
);

-- 핸드오프
CREATE TABLE handoffs (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) UNIQUE,
  project_id TEXT REFERENCES projects(id),
  summary TEXT,
  files_changed_json TEXT,
  design_decisions_json TEXT,
  known_issues_json TEXT,
  next_task_notes TEXT,
  created_at TEXT
);

-- 검증 결과
CREATE TABLE validations (
  id TEXT PRIMARY KEY,
  target_type TEXT,              -- task | sprint | milestone
  target_id TEXT,
  passed INTEGER,
  results_json TEXT,             -- [{ check: "build", passed: true, message: "" }]
  validated_by TEXT,             -- auto | opus | user
  created_at TEXT
);

-- 실행 로그 (간략)
CREATE TABLE task_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT REFERENCES tasks(id),
  event_type TEXT,               -- start | thinking | tool_call | output | error | complete
  message TEXT,
  timestamp TEXT
);
```

### 2.2 TypeScript 타입

```typescript
// === 핵심 도메인 타입 ===

interface Project {
  id: string;
  name: string;
  description: string;
  specCard: SpecCard;
  status: "planning" | "active" | "paused" | "completed";
  createdAt: string;
  updatedAt: string;
}

interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  orderIndex: number;
  status: "pending" | "active" | "completed" | "failed";
  validationStrategy: string;
  sprints: Sprint[];           // 조인 시
}

interface Sprint {
  id: string;
  milestoneId: string;
  projectId: string;
  name: string;
  description: string;
  orderIndex: number;
  status: "pending" | "active" | "completed" | "failed";
  validationStrategy: string;
  dependencies: string[];
  tasks: Task[];               // 조인 시
}

interface Task {
  id: string;
  sprintId: string;
  projectId: string;
  name: string;
  description: string;
  plan: string;
  orderIndex: number;
  status: TaskStatus;
  difficulty: "easy" | "medium" | "hard";
  model: "haiku" | "sonnet" | "opus";
  executionMode: "single" | "harness";
  harnessId?: string;
  dependencies: string[];
  validation: TaskValidation;
  estimatedFiles: string[];
  actualFiles: string[];
  cost: number;
  durationMs: number;
  retryCount: number;
}

type TaskStatus = "pending" | "queued" | "running" | "completed" | "failed" | "skipped";

interface TaskValidation {
  auto: string[];              // ["build", "typecheck", "lint"]
  manual?: string;             // "점프 높이가 자연스러운지 확인"
}

interface TaskHandoff {
  id: string;
  taskId: string;
  projectId: string;
  summary: string;
  filesChanged: string[];
  designDecisions: string[];
  knownIssues: string[];
  nextTaskNotes?: string;
}

interface ValidationResult {
  id: string;
  targetType: "task" | "sprint" | "milestone";
  targetId: string;
  passed: boolean;
  results: ValidationCheck[];
  validatedBy: "auto" | "opus" | "user";
}

interface ValidationCheck {
  check: string;               // "build", "typecheck", "test", etc.
  passed: boolean;
  message: string;
}

// === SpecCard (Discovery 결과, 기존 유지) ===

interface SpecCard {
  projectName: string;
  projectType: string;
  description: string;
  coreDecisions: string[];
  techStack: string[];
  features: string[];
}
```

---

## 3. Opus PM 상세 설계

### 3.1 프롬프트 전략

Opus PM은 Claude Agent SDK를 통해 호출. 시스템 프롬프트:

```
너는 소프트웨어 프로젝트 매니저다.
사용자가 제공한 프로젝트 정의(SpecCard)를 기반으로,
프로젝트를 마일스톤 → 스프린트 → 태스크로 분할하라.

## 분할 원칙
- 태스크 하나 = AI 에이전트가 한 세션에서 완료할 수 있는 크기
- 태스크 하나 = 한 파일~몇 파일 수준 변경
- 태스크 하나 = "~하면 끝" 한 문장으로 완료 조건 정의 가능
- 의존성은 최소화하여 병렬 실행 가능하게
- 마일스톤은 배포/데모 가능한 단위
- 스프린트는 검증 가능한 단위

## 난이도 판정
- easy (haiku): 보일러플레이트, 설정, 단순 복사/이동, CSS 수정
- medium (sonnet): 일반 기능 구현, 버그 수정, 리팩토링
- hard (opus): 아키텍처 설계, 복잡한 알고리즘, 다중 파일 연쇄 변경

## 실행 방식 판정
- single: 하나의 관점으로 충분한 태스크 (기본)
- harness: 여러 전문 관점의 협업이 필요한 태스크
  ※ 업무에서 필요가 생겨야만 harness. 하네스를 위한 업무를 만들지 않는다.

## 검증 방법
- 태스크: auto 배열에 자동 검증 항목 (build, typecheck, lint 등)
- 스프린트: validationStrategy에 통합 검증 방법 기술
- 마일스톤: validationStrategy에 QA 방법 기술

## 출력 형식
JSON으로 출력. ProjectPlan 스키마를 따를 것.
```

### 3.2 분할 프로세스

```
[1] SpecCard 입력
      ↓
[2] Opus가 마일스톤 도출 (큰 덩어리)
      ↓
[3] 마일스톤별 스프린트 도출 (검증 단위)
      ↓
[4] 스프린트별 태스크 도출 (실행 단위)
      ↓
[5] 태스크별 속성 결정:
    - 계획 (plan): 구체적으로 뭘 어떻게
    - 난이도 → 모델 배치
    - 실행 방식 (단독/하네스)
    - 의존성
    - 검증 방법
    - 예상 변경 파일
      ↓
[6] JSON 반환 → DB 저장 → 트리 뷰 표시
      ↓
[7] 사용자 승인/수정
```

### 3.3 계획 갱신 (스프린트 완료 시)

스프린트 완료 후, Opus가 후속 계획을 갱신:

```
입력:
  - 완료된 스프린트의 모든 handoff
  - 남은 태스크/스프린트 목록
  - 원래 계획

출력:
  - 갱신된 후속 태스크 plan 필드
  - 필요시 태스크 추가/삭제/수정
  - 변경 사유
```

---

## 4. Task Runner 상세 설계

### 4.1 실행 흐름

```
태스크 실행 요청
  ↓
[1] Context Manager에서 컨텍스트 조립
    - 태스크 plan
    - 관련 handoff (의존 태스크의 handoff만)
    - 프로젝트 파일 트리 요약
    - 검증 조건
  ↓
[2] Model Router에서 모델 선택
    - task.model → API 엔드포인트 결정
  ↓
[3] 실행 방식 분기
    ├─ single: SDK Chat으로 직접 실행
    └─ harness: Harness Loader로 하네스 실행
  ↓
[4] 실행 중 이벤트 스트리밍
    - thinking, tool_call, output → task_logs에 기록
    - renderer에 실시간 전송
  ↓
[5] 완료 시
    - Handoff Manager가 handoff 생성 요청
    - Validation Runner가 자동 검증 실행
    - 결과를 DB에 저장
    - 상태 업데이트 → renderer에 전송
```

### 4.2 컨텍스트 조립 (Context Manager)

```typescript
interface TaskContext {
  // 이 태스크가 해야 할 일
  taskPlan: string;
  
  // 관련된 이전 작업 결과만
  relevantHandoffs: TaskHandoff[];
  
  // 현재 프로젝트 파일 구조 (트리)
  projectFileTree: string;
  
  // 검증 조건
  validationCriteria: string[];
  
  // 프로젝트 워킹 디렉토리
  workingDir: string;
}
```

**핵심: 필요한 것만 넣는다.** 전체 히스토리, 다른 태스크 상세, 이전 대화 로그 — 전부 제외.

### 4.3 Handoff 자동 생성

태스크 완료 후, 실행한 모델에게 handoff를 생성하도록 요청:

```
태스크가 완료되었다. 다음 정보로 handoff를 작성하라:

1. summary: 무엇을 했는지 1-3문장
2. filesChanged: 변경한 파일 목록
3. designDecisions: 설계 결정 사항 (후속 태스크에 영향주는 것만)
4. knownIssues: 알려진 문제점
5. nextTaskNotes: 다음 태스크 담당자에게 전할 말
```

---

## 5. 검증 시스템

### 5.1 Validation Runner

```typescript
class ValidationRunner {
  // 태스크 완료 후 자동 검증
  async validateTask(task: Task, workingDir: string): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];
    
    for (const checkType of task.validation.auto) {
      switch (checkType) {
        case "build":
          checks.push(await this.runBuild(workingDir));
          break;
        case "typecheck":
          checks.push(await this.runTypeCheck(workingDir));
          break;
        case "lint":
          checks.push(await this.runLint(workingDir));
          break;
        case "test":
          checks.push(await this.runTest(workingDir));
          break;
      }
    }
    
    return {
      targetType: "task",
      targetId: task.id,
      passed: checks.every(c => c.passed),
      results: checks,
      validatedBy: "auto"
    };
  }
  
  // 스프린트 완료 후 통합 검증 (Sonnet)
  async validateSprint(sprint: Sprint, workingDir: string): Promise<ValidationResult>;
  
  // 마일스톤 완료 후 QA (Opus)
  async validateMilestone(milestone: Milestone, workingDir: string): Promise<ValidationResult>;
}
```

### 5.2 실패 처리

```
태스크 검증 실패 (retry < 2):
  → task.retryCount++
  → handoff에 실패 원인 추가
  → 같은 태스크 재실행

태스크 검증 2회 실패:
  → status = "failed"
  → 사용자 알림: "이 태스크가 실패했습니다. [재시도] [건너뛰기] [직접 수정]"

스프린트 검증 실패:
  → Opus PM에게 실패 내용 전달
  → Opus가 수정 태스크 생성 (sprint에 추가)
  → 수정 태스크 실행 → 재검증

마일스톤 검증 실패:
  → Opus가 전체 리뷰
  → 필요시 수정 스프린트 추가
  → 사용자 확인 후 진행
```

---

## 6. IPC API 설계

### 6.1 Discovery (간소화)

```typescript
// 기존 유지
"discovery:start"    → 프리셋 기반 질문 시작
"discovery:complete" → SpecCard + 프로젝트 생성

// 삭제
// harness:get-catalog, harness:apply 등 하네스 관련 → 삭제
// agentPool:getAll, agentPool:recommend 등 에이전트 풀 관련 → 삭제
```

### 6.2 Planning (신규)

```typescript
// Opus PM에게 프로젝트 분할 요청
"planning:generate"(projectId: string) → ProjectPlan

// 사용자가 계획 수정
"planning:update-task"(taskId: string, changes: Partial<Task>) → Task
"planning:add-task"(sprintId: string, task: Partial<Task>) → Task
"planning:remove-task"(taskId: string) → void
"planning:reorder"(sprintId: string, taskIds: string[]) → void

// 계획 승인
"planning:approve"(projectId: string) → void

// 스프린트 완료 후 계획 갱신
"planning:refresh"(sprintId: string) → ProjectPlan  // Opus가 후속 계획 갱신
```

### 6.3 Execution (신규)

```typescript
// 실행 제어
"execution:start"(projectId: string) → void           // 다음 실행 가능 태스크부터 시작
"execution:pause"(projectId: string) → void
"execution:resume"(projectId: string) → void
"execution:retry-task"(taskId: string) → void
"execution:skip-task"(taskId: string) → void

// 상태 조회
"execution:get-status"(projectId: string) → ExecutionStatus
"execution:get-task-log"(taskId: string) → TaskLog[]

// 이벤트 (renderer가 수신)
"execution:task-started"   → { taskId, model }
"execution:task-progress"  → { taskId, eventType, message }
"execution:task-completed" → { taskId, handoff, validation }
"execution:task-failed"    → { taskId, error, retryCount }
"execution:sprint-completed" → { sprintId, validation }
"execution:milestone-completed" → { milestoneId, validation }
"execution:needs-input"    → { taskId, question }     // 사용자 입력 필요 시
```

### 6.4 Data (신규)

```typescript
// 프로젝트 트리 조회
"data:get-project-tree"(projectId: string) → ProjectTree  // 마일스톤+스프린트+태스크 전체
"data:get-task-detail"(taskId: string) → TaskDetail        // 태스크+handoff+validation+logs
"data:get-handoff"(taskId: string) → TaskHandoff | null
"data:get-project-stats"(projectId: string) → ProjectStats // 진행률, 비용, 시간
```

---

## 7. Renderer 설계

### 7.1 페이지 구조

```
App.tsx
  ├─ DiscoveryPage        — 프로젝트 정의 (간소화)
  ├─ PlanReviewPage       — Opus PM 결과 트리 뷰 + 수정/승인
  ├─ ProjectPage          — 메인: 트리 뷰 + 태스크 상세 + 실행 제어
  └─ SettingsPage         — API 키, 기본 설정
```

### 7.2 Zustand Store

```typescript
interface AppStore {
  // 프로젝트 목록
  projects: Project[];
  currentProjectId: string | null;
  
  // 프로젝트 트리 (현재 프로젝트)
  milestones: Milestone[];
  sprints: Sprint[];
  tasks: Task[];
  
  // 실행 상태
  executionStatus: "idle" | "running" | "paused";
  activeTaskId: string | null;
  
  // 선택된 항목
  selectedTaskId: string | null;
  
  // 비용/진행률
  totalCost: number;
  completedTasks: number;
  totalTasks: number;
  
  // Actions
  loadProject: (id: string) => void;
  startExecution: () => void;
  pauseExecution: () => void;
  selectTask: (id: string) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
}
```

### 7.3 핵심 컴포넌트

```
ProjectPage
  ├─ ProjectHeader          — 프로젝트명, 진행률 바, 비용, [시작/일시정지]
  ├─ ProjectTree            — 마일스톤/스프린트/태스크 트리
  │   ├─ MilestoneNode      — 접기/펴기, 진행률, 상태 아이콘
  │   ├─ SprintNode         — 접기/펴기, 진행률, 상태 아이콘
  │   └─ TaskNode           — 상태 아이콘, 모델 뱃지, 난이도 뱃지
  ├─ TaskDetailPanel        — 선택된 태스크의 상세 정보
  │   ├─ TaskPlan           — 계획 표시
  │   ├─ TaskHandoff        — handoff 내용
  │   ├─ TaskValidation     — 검증 결과
  │   └─ TaskLog            — 실행 로그 (접을 수 있음)
  └─ ExecutionBar           — 하단: 현재 실행 중인 태스크 정보
```

### 7.4 트리 뷰 상태 표현

```
상태 아이콘:
  ⏳ pending    — 아직 시작 안 함
  📋 queued     — 실행 대기열에 들어감
  🔄 running    — 실행 중
  ✅ completed  — 완료
  ❌ failed     — 실패
  ⏭️ skipped    — 건너뜀

모델 뱃지:
  [H] haiku   — 회색
  [S] sonnet  — 파란색  
  [O] opus    — 보라색

난이도:
  ● easy      — 초록
  ●● medium   — 노랑
  ●●● hard    — 빨강
```

---

## 8. 파일 구조 (예정)

```
src/
  main/
    index.ts                    — IPC 핸들러 (대폭 간소화)
    opus-pm.ts                  — Opus PM 모듈 (분할 + 갱신)
    task-runner.ts              — 태스크 실행기
    context-manager.ts          — 컨텍스트 조립
    model-router.ts             — 모델 배치 + 비용 추적
    handoff-manager.ts          — handoff CRUD
    validation-runner.ts        — 검증 실행
    harness-loader.ts           — 하네스 모드 실행 (경량)
    database.ts                 — SQLite (스키마 변경)
    agent-runner/
      sdk-chat.ts               — 기존 유지
  
  renderer/
    App.tsx                     — 라우팅 (간소화)
    pages/
      DiscoveryPage.tsx         — 프로젝트 정의 (간소화)
      PlanReviewPage.tsx        — 계획 트리 + 승인 (신규)
      ProjectPage.tsx           — 메인 트리 뷰 (신규)
      SettingsPage.tsx          — 설정 (간소화)
    components/
      tree/
        ProjectTree.tsx         — 트리 뷰 (신규)
        MilestoneNode.tsx       — 마일스톤 노드 (신규)
        SprintNode.tsx          — 스프린트 노드 (신규)
        TaskNode.tsx            — 태스크 노드 (신규)
      detail/
        TaskDetailPanel.tsx     — 태스크 상세 (신규)
        TaskPlan.tsx            — 계획 표시 (신규)
        TaskHandoff.tsx         — handoff 표시 (신규)
        TaskValidation.tsx      — 검증 결과 (신규)
        TaskLog.tsx             — 실행 로그 (신규)
      ExecutionBar.tsx          — 하단 실행 상태 (신규)
      ProjectHeader.tsx         — 프로젝트 헤더 (신규)
    stores/
      app-store.ts              — 전면 재작성
    hooks/
      useIpcEvents.ts           — 이벤트 핸들링 (수정)
  
  shared/
    types.ts                    — 전면 재작성
  
  preload/
    index.ts                    — IPC 채널 업데이트
```

---

## 9. 삭제 대상

| 파일/디렉토리 | 이유 |
|---------------|------|
| `src/main/gsd-bridge.ts` | GSD 파이프라인 엔진 불필요 |
| `src/main/harness-manager.ts` | 카탈로그 브라우징 → harness-loader로 경량 대체 |
| `src/main/agent-pool-manager.ts` | PM이 자동 판단 |
| `src/main/orchestration-generator.ts` | CLAUDE.md 생성 불필요 |
| `src/main/orchestrator/` | GSD 승인 플로우 불필요 |
| `src/main/preset/` | 프리셋 시스템 불필요 |
| `src/main/memory/plan-manager.ts` | 새 계획 시스템으로 대체 |
| `src/main/memory/learning-manager.ts` | 불필요 |
| `src/renderer/pages/OrchestrationPage.tsx` | 파이프라인 시각화 삭제 |
| `src/renderer/pages/HarnessPage.tsx` | 하네스 브라우저 삭제 |
| `src/renderer/pages/SchedulePage.tsx` | 트리 뷰로 대체 |
| `src/renderer/components/discovery/HarnessBrowseStep.tsx` | 하네스 선택 삭제 |
| `src/renderer/components/discovery/ModeSelectStep.tsx` | 모드 선택 삭제 |
| `src/renderer/components/discovery/AgentTeamSetup.tsx` | 에이전트 팀 구성 삭제 |
| `src/renderer/components/AgentCard.tsx` | 에이전트 카드 삭제 |
| `src/renderer/components/PhaseTracker.tsx` | 고정 페이즈 삭제 |
| `src/renderer/components/PhaseChat.tsx` | 페이즈 채팅 삭제 |
| `src/renderer/components/DecisionModal.tsx` | GSD 승인 삭제 |
| `src/renderer/components/CheckpointModal.tsx` | 체크포인트 삭제 |
| `src/renderer/components/SkillsLibrary.tsx` | 스킬 라이브러리 삭제 |
| `src/renderer/stores/discovery-store.ts` | 간소화 후 재작성 |
| `src/shared/phase-definitions.ts` | 고정 페이즈 삭제 |
| `vendor/gsd/` | GSD SDK 삭제 |

---

## 10. 위험 요소 및 대응

| 위험 | 영향 | 대응 |
|------|------|------|
| Opus PM의 분할 품질이 낮을 경우 | 전체 프로젝트 품질 저하 | 프롬프트 반복 개선 + 사용자 수정 기회 제공 |
| 태스크가 너무 잘게 쪼개져 오버헤드 증가 | 비용/시간 낭비 | 분할 가이드라인에 "최소 단위" 기준 명시 |
| Handoff 정보가 부족해 후속 태스크 실패 | 연쇄 실패 | handoff 품질 검증 + 실패 시 Opus가 보완 |
| 하네스 모드 태스크에서 기존 하네스가 안 맞을 경우 | 하네스 실행 실패 | 단독 모드 fallback |
| 비개발자가 계획 트리를 이해 못할 경우 | UX 실패 | 각 항목에 쉬운 설명 + 진행률 시각화에 집중 |
