# WorkTool Design Document (v2)

> **Summary**: P0 8항목의 기술 설계 — 프리셋/스킬 번들링, 스펙-기능 검증, Plan 문서 자동관리, PhaseTracker, 폴더 선택, 패키징
>
> **Project**: WorkTool
> **Version**: 0.2.0
> **Author**: User + Claude
> **Date**: 2026-03-29
> **Status**: Active
> **Plan Reference**: `docs/01-plan/features/tool.plan.md` (v0.3)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 프리셋/스킬 0개로 즉시 사용 불가, 계획 문서 없이 변경 추적 불가, PhaseTracker 미연결, 네이티브 기능 미활용 |
| **Solution** | 5종 프리셋 + 10종 스킬 번들, PlanManager 자동 문서 관리, Pipeline↔Phase 연동, Electron dialog API |
| **Function/UX Effect** | 설치 즉시 Discovery 가능, 변경사항 자동 기록, Phase 실시간 추적, 네이티브 폴더 선택 |
| **Core Value** | "설치하면 바로 쓸 수 있는" 완성품 수준의 Alpha 릴리즈 |

---

## 1. Implementation Order

```
P0-05 (폴더 선택)        ← Quick Win, 의존성 없음
  ↓
P0-01 (프리셋 5종)       ← 데이터 작성
P0-02 (스킬 10종)        ← 데이터 작성 (P0-01과 병렬)
  ↓
P0-04 (PhaseTracker)     ← Pipeline 수정
P0-08 (Plan 자동관리)    ← Schema v6 + PlanManager
  ↓
P0-03 (스펙-기능 검증)   ← P0-08 PlanManager 연동
  ↓
P0-06 (E2E 테스트)       ← 전체 통합 검증
  ↓
P0-07 (패키징)           ← 최종
```

---

## 2. P0-05: Electron 폴더 선택 다이얼로그

### 2.1 변경 파일

| File | Action | Description |
|------|--------|-------------|
| `src/main/index.ts` | Modify | `dialog:select-folder` IPC 핸들러 추가 |
| `src/preload/index.ts` | Modify | `dialog.selectFolder()` API 추가 |
| `src/renderer/pages/Discovery/DiscoveryChat.tsx` | Modify | 폴더 선택 버튼 UI 추가 |

### 2.2 IPC 핸들러

```typescript
// src/main/index.ts
import { dialog } from "electron";

ipcMain.handle("dialog:select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory", "createDirectory"],
    title: "프로젝트 폴더 선택",
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
```

### 2.3 Preload API

```typescript
// src/preload/index.ts > api 객체에 추가
dialog: {
  selectFolder: () => ipcRenderer.invoke("dialog:select-folder"),
},
```

### 2.4 UI 변경

DiscoveryChat에서 workingDir 입력 필드 옆에 "폴더 선택" 버튼 추가. 클릭 시 네이티브 다이얼로그 열림.

---

## 3. P0-01: 기본 프리셋 5종 번들링

### 3.1 변경 파일

| File | Action | Description |
|------|--------|-------------|
| `resources/presets/game/preset.yaml` | Create | 게임 프리셋 정의 |
| `resources/presets/game/agents/*.yaml` | Create | 게임 에이전트 5개 |
| `resources/presets/webapp/preset.yaml` | Create | 웹앱 프리셋 |
| `resources/presets/webapp/agents/*.yaml` | Create | 웹앱 에이전트 5개 |
| `resources/presets/mobile/preset.yaml` | Create | 모바일 프리셋 |
| `resources/presets/mobile/agents/*.yaml` | Create | 모바일 에이전트 5개 |
| `resources/presets/api-server/preset.yaml` | Create | API 서버 프리셋 |
| `resources/presets/api-server/agents/*.yaml` | Create | API 에이전트 5개 |
| `resources/presets/desktop/preset.yaml` | Create | 데스크톱 프리셋 |
| `resources/presets/desktop/agents/*.yaml` | Create | 데스크톱 에이전트 5개 |
| `src/main/index.ts` | Modify | PresetManager 초기화 시 builtinDir 경로 설정 |

### 3.2 프리셋 YAML 구조

```yaml
# resources/presets/{id}/preset.yaml
id: game
name: "게임"
description: "2D/3D 게임 개발 프리셋"
discoveryQuestions:
  - id: genre
    question: "어떤 장르의 게임을 만드시나요?"
    options:
      - { label: "플랫포머", value: "platformer", description: "점프와 이동 중심" }
      - { label: "RPG", value: "rpg", description: "캐릭터 성장과 스토리" }
      - { label: "퍼즐", value: "puzzle", description: "논리적 문제 해결" }
      - { label: "액션", value: "action", description: "빠른 전투와 반응" }
    allowFreeText: true
    order: 1
  # ... (7개 질문)
evaluatorCriteria:
  - "빌드 에러 없이 실행 가능"
  - "게임 루프가 정상 동작 (시작→플레이→종료)"
  - "사용자 입력에 반응 (키보드/마우스)"
  - "기본 그래픽 렌더링 정상"
baseGuidelines: |
  이 프로젝트는 게임입니다. 게임 개발의 핵심 원칙을 따르세요:
  - 게임 루프(update → render)를 명확히 분리
  - 프레임 독립적 움직임 (deltaTime 사용)
  - 충돌 감지는 간단한 AABB부터 시작
```

### 3.3 에이전트 YAML 구조 (프리셋 공통)

각 프리셋은 core 3개 + specialized 2개 = 5개 에이전트:

```yaml
# resources/presets/{id}/agents/planner.yaml
id: planner
displayName: "Planner"
icon: "🔧"
role: "기술 설계자"
goal: "스펙 카드를 기능 목록으로 확장하고 구현 순서를 결정"
constraints:
  - "코드 작성 금지, 기획과 설계만"
  - "기능당 예상 복잡도를 포함"
model: opus
trigger: manual
guidelines:
  - "JSON 형태로 features 배열 출력"
  - "각 feature에 name, description, order 포함"
outputFormat: '{"features": [{"name": "...", "description": "...", "order": 1}]}'
```

### 3.4 프리셋별 전문 에이전트

| Preset | Agent 1 | Agent 2 |
|--------|---------|---------|
| game | `balance-tester` (밸런스 검증) | `ux-reviewer` (게임 UX 리뷰) |
| webapp | `api-designer` (API 설계) | `a11y-checker` (접근성 검사) |
| mobile | `platform-adapter` (플랫폼 호환) | `offline-handler` (오프라인 지원) |
| api-server | `security-auditor` (보안 검사) | `doc-generator` (API 문서 생성) |
| desktop | `native-integrator` (네이티브 연동) | `installer-builder` (설치 패키지) |

### 3.5 PresetManager 초기화 변경

```typescript
// src/main/index.ts — app.whenReady() 내부
const builtinPresetsDir = app.isPackaged
  ? path.join(process.resourcesPath, "presets")
  : path.join(__dirname, "../../resources/presets");

presetManager = new PresetManager(builtinPresetsDir, customPresetsDir);
```

---

## 4. P0-02: 기본 스킬 10종 내장

### 4.1 변경 파일

| File | Action | Description |
|------|--------|-------------|
| `resources/skills/*.json` | Create | 10개 스킬 정의 파일 |
| `src/main/memory/memory-manager.ts` | Modify | `seedDefaultSkills()` 메서드 추가 |
| `src/main/index.ts` | Modify | 앱 시작 시 seed 호출 |

### 4.2 스킬 JSON 구조

```json
// resources/skills/handoff.json
{
  "id": "handoff",
  "name": "인수인계",
  "description": "에이전트 간 작업 인수인계 + 컨텍스트 전달. 이전 에이전트의 결과를 요약하여 다음 에이전트에게 전달합니다.",
  "pattern": "에이전트 전환 시 자동 트리거",
  "template": "이전 에이전트({previousAgent})의 작업 결과:\n{summary}\n\n변경된 파일: {files}\n\n다음 작업을 이어서 진행하세요.",
  "category": "workflow",
  "trigger": "agent_transition",
  "isBuiltin": true
}
```

### 4.3 seedDefaultSkills() 구현

```typescript
// src/main/memory/memory-manager.ts
seedDefaultSkills(projectId: string): void {
  // 이미 seed된 프로젝트인지 확인
  const existing = this.getSkills(projectId);
  if (existing.some(s => s.name === "인수인계")) return; // 이미 있음

  const skillsDir = app.isPackaged
    ? path.join(process.resourcesPath, "skills")
    : path.join(__dirname, "../../../resources/skills");

  if (!fs.existsSync(skillsDir)) return;

  for (const file of fs.readdirSync(skillsDir)) {
    if (!file.endsWith(".json")) continue;
    const skill = JSON.parse(fs.readFileSync(path.join(skillsDir, file), "utf-8"));
    this.addSkill(projectId, skill.name, skill.description, skill.pattern, skill.template);
  }
}
```

### 4.4 호출 시점

Discovery 완료 → 프로젝트 생성 직후 `seedDefaultSkills(projectId)` 호출:

```typescript
// src/main/index.ts > discovery:complete 핸들러 내부
const project = memoryManager.createProject(projectName, presetId, workingDir, agents);
memoryManager.seedDefaultSkills(project.id); // ← 추가
```

---

## 5. P0-04: PhaseTracker 실제 연결

### 5.1 변경 파일

| File | Action | Description |
|------|--------|-------------|
| `src/main/orchestrator/pipeline.ts` | Modify | Phase 상태 전환 로직 추가 |
| `src/main/index.ts` | Modify | Pipeline 이벤트 → Phase 업데이트 연동 |
| `src/renderer/pages/ProjectView.tsx` | Modify | PhaseTracker 컴포넌트 와이어링 |

### 5.2 Pipeline → Phase 매핑

```typescript
// pipeline.ts 에 추가할 Phase 전환 로직
private updatePhase(phase: ProjectPhase, checkItems?: string[]): void {
  const currentState = this.memoryManager.getProjectPhaseState(this.config.projectId);
  if (!currentState) return;

  // Phase 전환
  if (currentState.currentPhase !== phase) {
    currentState.phases[currentState.currentPhase].status = "completed";
    currentState.phases[currentState.currentPhase].completedAt = new Date().toISOString();
    currentState.currentPhase = phase;
    currentState.phases[phase].status = "active";
    currentState.phases[phase].startedAt = new Date().toISOString();
  }

  // 체크리스트 자동 완료
  if (checkItems) {
    for (const itemId of checkItems) {
      const item = currentState.phases[phase].checklist.find(c => c.id === itemId);
      if (item) item.completed = true;
    }
  }

  this.memoryManager.updateProjectPhaseState(this.config.projectId, currentState);
  this.emit("phase_updated", currentState);
}
```

### 5.3 전환 시점

| Pipeline 이벤트 | Phase 전환 | 체크리스트 |
|-----------------|-----------|-----------|
| `runPlanner()` 시작 | → `design` | - |
| `runPlanner()` 완료 | → `implement` | `tech-stack` 완료 |
| Feature 구현 완료 (Generator pass) | - | `core-feature` 완료 |
| Evaluator 통과 | - | `build-pass` 완료 |
| 전체 Pipeline 완료 | → `test` | - |

### 5.4 IPC 이벤트 전달

```typescript
// src/main/index.ts
activePipeline.on("phase_updated", (state: unknown) => {
  mainWindow?.webContents.send("phase:updated", state);
});
```

---

## 6. P0-08: 프로젝트 계획 문서 자동 관리

### 6.1 변경 파일

| File | Action | Description |
|------|--------|-------------|
| `src/main/memory/database.ts` | Modify | Schema v6: `project_plans` 테이블 |
| `src/main/memory/plan-manager.ts` | Create | PlanManager 클래스 |
| `src/shared/types.ts` | Modify | PlanDocument, PlanChangeLog 타입 |
| `src/preload/index.ts` | Modify | `plan:get`, `plan:match-rate` IPC |
| `src/main/index.ts` | Modify | Plan IPC 핸들러 + 기존 훅 삽입 |
| `src/main/orchestrator/pipeline.ts` | Modify | Feature 변경 시 Plan 업데이트 호출 |
| `src/renderer/pages/PlanPage.tsx` | Create | 계획 탭 UI |
| `src/renderer/pages/ProjectView.tsx` | Modify | 계획 서브탭 추가 |

### 6.2 Schema v6

```sql
-- src/main/memory/database.ts > initSchema()
if (version < 6) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_plans (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      content_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_plans_project ON project_plans(project_id);
  `);
  db.pragma(`user_version = 6`);
}
```

### 6.3 Types

```typescript
// src/shared/types.ts

export interface PlanDocument {
  overview: string;
  specSummary: {
    projectType: string;
    coreDecisions: { key: string; label: string; value: string }[];
    techStack: string[];
    expansions: { label: string; enabled: boolean }[];
  };
  features: PlanFeatureEntry[];
  agentTeam: { id: string; displayName: string; icon: string; role: string }[];
  changeLog: PlanChangeLog[];
}

export interface PlanFeatureEntry {
  featureId: string;
  name: string;
  description: string;
  status: FeatureStatus;
  estimatedStart: string | null;
  estimatedEnd: string | null;
  assignedAgent: string | null;
}

export interface PlanChangeLog {
  date: string;
  action: "plan_created" | "feature_added" | "feature_removed" | "feature_status_changed"
    | "feature_completed" | "schedule_updated" | "agent_changed" | "feature_requested";
  detail: string;
  trigger: "system" | "pipeline" | "user";
}
```

### 6.4 PlanManager 클래스

```typescript
// src/main/memory/plan-manager.ts
export class PlanManager {
  constructor(private db: any) {}

  /** Discovery 완료 시 Plan 자동 생성 */
  createFromSpecCard(
    projectId: string,
    specCard: SpecCard,
    agents: AgentDefinition[],
  ): void {
    const plan: PlanDocument = {
      overview: specCard.projectType,
      specSummary: {
        projectType: specCard.projectType,
        coreDecisions: specCard.coreDecisions,
        techStack: specCard.techStack,
        expansions: specCard.expansions.map(e => ({ label: e.label, enabled: e.enabled })),
      },
      features: [],
      agentTeam: agents.map(a => ({
        id: a.id, displayName: a.displayName, icon: a.icon, role: a.role,
      })),
      changeLog: [{
        date: new Date().toISOString(),
        action: "plan_created",
        detail: `프로젝트 "${specCard.projectType}" 계획 생성`,
        trigger: "system",
      }],
    };

    this.db.prepare(
      `INSERT INTO project_plans (id, project_id, version, content_json, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?, ?)`
    ).run(uuid(), projectId, JSON.stringify(plan), new Date().toISOString(), new Date().toISOString());
  }

  /** Feature 목록 동기화 (Planner 완료 후, Feature 추가/삭제 시) */
  syncFeatures(projectId: string, features: Feature[]): void {
    const plan = this.getPlan(projectId);
    if (!plan) return;

    const oldNames = plan.features.map(f => f.name);
    const newNames = features.map(f => f.name);

    // 추가된 항목 감지
    const added = features.filter(f => !oldNames.includes(f.name));
    for (const f of added) {
      plan.changeLog.push({
        date: new Date().toISOString(),
        action: "feature_added",
        detail: `기능 "${f.name}" 추가`,
        trigger: "pipeline",
      });
    }

    // 삭제된 항목 감지
    const removed = plan.features.filter(f => !newNames.includes(f.name));
    for (const f of removed) {
      plan.changeLog.push({
        date: new Date().toISOString(),
        action: "feature_removed",
        detail: `기능 "${f.name}" 제거`,
        trigger: "pipeline",
      });
    }

    plan.features = features.map(f => ({
      featureId: f.id,
      name: f.name,
      description: f.description,
      status: f.status,
      estimatedStart: f.estimatedStart,
      estimatedEnd: f.estimatedEnd,
      assignedAgent: f.assignedAgent,
    }));

    this.savePlan(projectId, plan);
  }

  /** 변경 로그 추가 */
  addChangeLog(projectId: string, action: PlanChangeLog["action"], detail: string, trigger: PlanChangeLog["trigger"]): void {
    const plan = this.getPlan(projectId);
    if (!plan) return;
    plan.changeLog.push({ date: new Date().toISOString(), action, detail, trigger });
    this.savePlan(projectId, plan);
  }

  /** Feature 상태 업데이트 반영 */
  updateFeatureStatus(projectId: string, featureId: string, status: FeatureStatus): void {
    const plan = this.getPlan(projectId);
    if (!plan) return;
    const entry = plan.features.find(f => f.featureId === featureId);
    if (entry) {
      entry.status = status;
      plan.changeLog.push({
        date: new Date().toISOString(),
        action: status === "completed" ? "feature_completed" : "feature_status_changed",
        detail: `"${entry.name}" 상태 → ${status}`,
        trigger: "pipeline",
      });
      this.savePlan(projectId, plan);
    }
  }

  /** 스펙 ↔ 기능 일치도 (P0-03 연동) */
  getSpecMatchRate(projectId: string): { rate: number; missing: string[]; extra: string[] } {
    const plan = this.getPlan(projectId);
    if (!plan) return { rate: 100, missing: [], extra: [] };

    const specKeywords = this.extractSpecKeywords(plan.specSummary);
    const featureKeywords = plan.features.map(f => f.name.toLowerCase());

    const missing = specKeywords.filter(k => !featureKeywords.some(fk => fk.includes(k)));
    const rate = specKeywords.length === 0 ? 100
      : Math.round(((specKeywords.length - missing.length) / specKeywords.length) * 100);

    return { rate, missing, extra: [] };
  }

  /** Plan 조회 */
  getPlan(projectId: string): PlanDocument | null {
    const row = this.db.prepare(
      "SELECT content_json FROM project_plans WHERE project_id = ? ORDER BY version DESC LIMIT 1"
    ).get(projectId) as { content_json: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.content_json);
  }

  private savePlan(projectId: string, plan: PlanDocument): void {
    this.db.prepare(
      "UPDATE project_plans SET content_json = ?, version = version + 1, updated_at = ? WHERE project_id = ?"
    ).run(JSON.stringify(plan), new Date().toISOString(), projectId);
  }

  private extractSpecKeywords(spec: PlanDocument["specSummary"]): string[] {
    const keywords: string[] = [];
    for (const d of spec.coreDecisions) {
      keywords.push(d.value.toLowerCase());
    }
    for (const e of spec.expansions) {
      if (e.enabled) keywords.push(e.label.toLowerCase());
    }
    return keywords;
  }
}
```

### 6.5 자동 업데이트 훅 삽입 위치

| 기존 코드 위치 | 추가할 호출 |
|---------------|------------|
| `index.ts` > `discovery:complete` | `planManager.createFromSpecCard(project.id, specCard, agents)` |
| `pipeline.ts` > `runPlanner()` Feature 저장 후 | `planManager.syncFeatures(projectId, savedFeatures)` |
| `pipeline.ts` > `updateFeatureStatus()` 호출 시 | `planManager.updateFeatureStatus(projectId, featureId, status)` |
| `memory-manager.ts` > `updateFeatureSchedule()` | `planManager.addChangeLog(projectId, "schedule_updated", ...)` |

### 6.6 IPC API

```typescript
// src/preload/index.ts
plan: {
  get: (projectId: string) => ipcRenderer.invoke("plan:get", { projectId }),
  getMatchRate: (projectId: string) => ipcRenderer.invoke("plan:match-rate", { projectId }),
},

// src/main/index.ts
ipcMain.handle("plan:get", (_event, { projectId }) => planManager.getPlan(projectId));
ipcMain.handle("plan:match-rate", (_event, { projectId }) => planManager.getSpecMatchRate(projectId));
```

### 6.7 PlanPage UI 컴포넌트

```
ProjectView > "계획" 탭
├── PlanHeader (프로젝트 개요 + 기술 스택 뱃지)
├── SpecMatchBadge (일치도 %, P0-03 연동)
├── FeatureTable (기능 목록 + 상태별 색상 + 진행률 바)
├── AgentTeamSummary (에이전트 팀 구성 아이콘)
└── ChangeLogTimeline (변경 이력 시간순)
```

### 6.8 ProjectView 탭 추가

```typescript
// src/renderer/pages/ProjectView.tsx
type ProjectTab = "overview" | "plan" | "chat" | "agents" | "pipeline" | "specs" | "logs";

const tabs = [
  { id: "overview", label: "개요", icon: "📊" },
  { id: "plan", label: "계획", icon: "📝" },  // ← 추가
  { id: "chat", label: "채팅", icon: "💬" },
  // ...
];
```

---

## 7. P0-03: 스펙-기능 교차 검증

### 7.1 변경 파일

| File | Action | Description |
|------|--------|-------------|
| `src/main/orchestrator/pipeline.ts` | Modify | Planner 후 교차 검증 로직 |
| `src/renderer/components/CheckpointModal.tsx` | Modify | 누락 기능 경고 UI |

### 7.2 검증 로직

`pipeline.ts` > `runPlanner()` 후, `requestCheckpoint()` 전에 삽입:

```typescript
// Planner 결과와 SpecCard 비교
const matchResult = this.planManager.getSpecMatchRate(this.config.projectId);

const checkpointData = {
  message: `${features.length}개 기능을 계획했습니다. 이 순서로 진행할까요?`,
  features: features.map(f => ({ name: f.name, description: f.description })),
  // P0-03: 누락 기능 경고
  specMatchRate: matchResult.rate,
  missingFromSpec: matchResult.missing,
};
```

### 7.3 CheckpointModal UI

누락 항목이 있을 때 경고 섹션 표시:

```
⚠️ 스펙에 있지만 기능 목록에 없는 항목 (2개)
  - "일정 관리" → [추가] [무시]
  - "알림 시스템" → [추가] [무시]
```

"추가" 클릭 시 해당 이름으로 Feature를 생성하고 Pipeline에 포함.

---

## 8. P0-06: E2E 엔진 테스트

### 8.1 테스트 체크리스트

| # | 시나리오 | 검증 항목 | Pass 기준 |
|---|---------|----------|----------|
| 1 | Direct 모드 채팅 | CLIBridge 호출 성공, agent_runs 기록 | 응답 반환 + UI 표시 |
| 2 | Light 모드 | Generator+Evaluator 순차 실행 | 검증 결과(pass/fail) 표시 |
| 3 | Full Pipeline | Planner→Generator→Evaluator 전체 루프 | Feature 목록 생성 + 코드 작성 |
| 4 | Discovery 대화 | AI 응답 → 스펙 카드 생성 | SpecCard에 coreDecisions 존재 |
| 5 | Plan 자동 생성 | Discovery 완료 → Plan 문서 자동 생성 | project_plans 테이블에 레코드 |
| 6 | Schedule 자동 반영 | Pipeline Feature 생성 → 일정 자동 배분 | features.estimated_start 존재 |
| 7 | Phase 전환 | Pipeline 실행 → Phase 자동 변경 | PhaseTracker UI 반영 |

### 8.2 수동 테스트 절차

```bash
# 1. 환경 확인
claude --version  # Claude Code CLI 설치 확인
cd C:/GameMaking/Tool && npm run dev

# 2. Discovery 테스트
# 앱에서 "새 프로젝트" → 게임 프리셋 → 대화 → 스펙 카드 생성 확인

# 3. Pipeline 테스트
# ProjectView → 파이프라인 탭 → "시작" 버튼 → Planner 실행 확인

# 4. Chat 테스트
# ProjectView → 채팅 탭 → "버튼 색상 변경" 입력 → Direct 모드 응답 확인
```

---

## 9. P0-07: Windows 패키징

### 9.1 변경 파일

| File | Action | Description |
|------|--------|-------------|
| `electron-builder.yml` | Modify | 리소스 포함 + 네이티브 모듈 설정 |
| `package.json` | Modify | build scripts 확인 |

### 9.2 electron-builder 설정

```yaml
# electron-builder.yml
appId: com.worktool.app
productName: WorkTool
directories:
  output: dist
files:
  - out/**/*
  - resources/**/*
extraResources:
  - from: resources/presets
    to: presets
  - from: resources/skills
    to: skills
win:
  target:
    - target: nsis
      arch: [x64]
  icon: resources/icon.png
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
```

### 9.3 네이티브 모듈 처리

better-sqlite3는 `electron-rebuild`로 빌드된 `.node` 파일이 필요:

```json
// package.json > scripts
"package": "electron-vite build && electron-builder --win",
"prepackage": "npx electron-rebuild -f -w better-sqlite3"
```

---

## 10. 전체 타입 변경 요약

```typescript
// src/shared/types.ts 에 추가할 타입들

// P0-08
export interface PlanDocument { ... }        // 6.3 참조
export interface PlanFeatureEntry { ... }    // 6.3 참조
export interface PlanChangeLog { ... }       // 6.3 참조
```

---

## 11. 전체 IPC 추가 요약

| Channel | Direction | P0 | Description |
|---------|-----------|-----|-------------|
| `dialog:select-folder` | invoke | P0-05 | 네이티브 폴더 선택 |
| `plan:get` | invoke | P0-08 | Plan 문서 조회 |
| `plan:match-rate` | invoke | P0-03/08 | 스펙-기능 일치도 |
| `phase:updated` | send | P0-04 | Phase 상태 변경 알림 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-28 | Initial design (Session 1) | User + Claude |
| 0.2 | 2026-03-29 | Full re-design for P0 8항목. PlanManager, 프리셋/스킬 번들링, PhaseTracker 연결, 폴더 선택, 패키징 설계 추가. | User + Claude |
