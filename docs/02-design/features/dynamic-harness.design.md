# Dynamic Harness Design Document

> **Feature**: 에이전트 풀 기반 동적 하네스 조합
> **Plan Reference**: `docs/01-plan/features/dynamic-harness.plan.md`
> **Date**: 2026-04-02
> **Status**: Draft

---

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                     Discovery Flow (NEW)                     │
│                                                             │
│  [Chat] → specCard 생성                                     │
│     ↓                                                       │
│  [Auto-Match] AgentPoolManager.recommend(specCard)          │
│     ↓                                                       │
│  [Review] 스펙 + 추천 에이전트 확인 (토글 가능)               │
│     ↓                                                       │
│  [Team Setup] 최종 에이전트 팀 확인 + 커스텀 추가             │
│     ↓                                                       │
│  [Apply] 선택된 에이전트 .md → 프로젝트 .claude/agents/ 복사  │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐     IPC     ┌──────────────────────────┐
│   Renderer       │ ←────────→  │   Main Process           │
│                  │             │                          │
│ discovery-store  │  recommend  │ AgentPoolManager         │
│ DiscoveryPage    │ ──────────→ │   .buildIndex()          │
│ AgentTeamSetup   │             │   .recommend(specCard)   │
│                  │  apply      │   .applyAgents(ids, dir) │
│ App.tsx          │ ──────────→ │                          │
└──────────────────┘             └──────────────────────────┘
                                          ↕ fs
                                 ┌──────────────────┐
                                 │  agent-pool/      │
                                 │  ├── core/ (4)    │
                                 │  ├── game/ (12)   │
                                 │  └── web/ (5)     │
                                 └──────────────────┘
```

---

## 2. 에이전트 .md 파일 스펙

### 2.1 Frontmatter 스키마

```yaml
---
name: combat-designer          # 고유 ID (파일명과 일치)
displayName: "Combat Designer"  # UI 표시명
icon: "⚔️"                     # 이모지 아이콘
description: "게임 전투 시스템 설계. 턴제/액션/스킬/데미지 공식."
tags:                           # 매칭용 태그 (소문자)
  - rpg
  - action
  - shooter
  - fighting
  - combat
category: game                  # "core" | "game" | "web"
trigger: after_planner          # 파이프라인 트리거
model: sonnet                   # opus | sonnet | haiku
---
```

### 2.2 Body 구조 (하네스-100 에이전트 .md와 동일)

```markdown
# {displayName} — {한국어 역할명}

당신은 {역할} 전문가입니다. {한 줄 설명}

## 핵심 역할
1. ...
2. ...

## 작업 원칙
- ...

## 산출물 포맷
`_workspace/{파일명}.md` 파일로 저장한다:
...

## 팀 통신 프로토콜
- **{에이전트}로부터**: ...
- **{에이전트}에게**: ...

## 에러 핸들링
- ...
```

### 2.3 PoolAgent 타입 (TypeScript)

```typescript
// src/shared/types.ts에 추가
export interface PoolAgent {
  id: string;              // frontmatter.name
  displayName: string;
  icon: string;
  description: string;
  tags: string[];
  category: "core" | "game" | "web";
  trigger: string;
  model: string;
  filePath: string;        // agent-pool/ 기준 상대 경로
  // UI 전용 (recommend 결과)
  matchScore?: number;
  matchReason?: string;    // "RPG 전투 시스템과 매칭"
  recommendCategory?: "core" | "recommended" | "optional";
}
```

---

## 3. AgentPoolManager 상세 설계

### 3.1 파일 위치

`src/main/agent-pool-manager.ts`

### 3.2 클래스 설계

```typescript
import fs from "fs";
import path from "path";
import type { SpecCard, PoolAgent } from "@shared/types";

export class AgentPoolManager {
  private pool: PoolAgent[] = [];
  private basePath: string;  // agent-pool/ 절대 경로

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * agent-pool/ 전체 스캔 → PoolAgent[] 인덱스 구축
   * 캐시: .agent-pool-cache.json (HarnessManager 패턴)
   */
  async buildIndex(): Promise<PoolAgent[]>;

  /**
   * 전체 풀 반환 (UI에서 브라우징용)
   */
  getAll(): PoolAgent[];

  /**
   * specCard 기반 자동 매칭
   *
   * 1. specCard에서 키워드 추출
   * 2. projectType으로 category 필터 ("game" 키워드 → game 에이전트 우선)
   * 3. tags 매칭 점수 계산
   * 4. core는 항상 포함, 점수>0 = recommended, 나머지 = optional
   */
  recommend(specCard: SpecCard): {
    core: PoolAgent[];
    recommended: PoolAgent[];
    optional: PoolAgent[];
  };

  /**
   * 선택된 에이전트 .md를 프로젝트 .claude/agents/에 복사
   * - 기존 .claude/agents/ 백업 (있으면)
   * - .claude/ 디렉토리 없으면 생성
   * - frontmatter 포함 전체 .md 복사
   */
  applyAgents(
    agentIds: string[],
    projectDir: string
  ): { success: boolean; appliedAgents: string[]; error?: string };
}
```

### 3.3 매칭 알고리즘 상세

```
입력: SpecCard {
  projectType: "2D 횡스크롤 RPG 게임"
  coreDecisions: [
    { key: "genre", value: "RPG" },
    { key: "view", value: "2D 횡스크롤" },
    { key: "combat", value: "턴제" },
    { key: "economy", value: "상점 + 장비 강화" }
  ]
  expansions: [
    { id: "multiplayer", enabled: false },
    { id: "story-mode", enabled: true }
  ]
  techStack: ["JavaScript", "Phaser 3"]
}

Step 1 — 키워드 추출:
  projectType 토큰화: ["2d", "횡스크롤", "rpg", "게임"]
  coreDecisions values: ["rpg", "2d", "횡스크롤", "턴제", "상점", "장비", "강화"]
  enabled expansions: ["story-mode"]
  techStack: ["javascript", "phaser"]
  → keywords = Set {"2d", "횡스크롤", "rpg", "게임", "턴제", "상점",
                     "장비", "강화", "story-mode", "javascript", "phaser"}

Step 2 — 카테고리 감지:
  keywords에 ["게임", "game", "phaser", "unity", "godot", "rpg",
              "platformer", "shooter", "puzzle"] 중 하나 포함?
  → domain = "game"
  → game/ 에이전트 풀 사용 (web/ 제외)

Step 3 — 태그 매칭:
  각 game/ 에이전트에 대해:
    score = agent.tags ∩ keywords 의 크기
    + 부분 매칭 보너스 (tag가 keyword에 포함되거나 반대)

  combat-designer    tags:[rpg,action,shooter,fighting,combat]  → rpg 매칭 = 1
  progression-designer tags:[rpg,roguelike,idle]                → rpg 매칭 = 1
  economy-designer   tags:[rpg,simulation,strategy,idle]        → rpg 매칭 = 1
  narrative-designer tags:[rpg,visual-novel,adventure]          → rpg + story 매칭 = 2
  level-designer     tags:[platformer,puzzle,shooter,rpg]       → rpg 매칭 = 1
  balance-auditor    tags:[rpg,shooter,strategy,fighting]       → rpg 매칭 = 1
  physics-designer   tags:[platformer,racing,sports]            → 매칭 없음 = 0
  puzzle-mechanic    tags:[puzzle,adventure,rpg]                → rpg 매칭 = 1
  ux-reviewer        tags:[all]                                 → 항상 매칭 = 1
  sound-planner      tags:[all]                                 → 항상 매칭 = 1
  asset-planner      tags:[all]                                 → 항상 매칭 = 1
  ai-designer        tags:[strategy,simulation,rpg,shooter]     → rpg 매칭 = 1

Step 4 — 분류:
  score > 0   → recommended (자동 선택됨)
  score === 0 → optional (선택 해제 상태)

Step 5 — matchReason 생성:
  combat-designer: "RPG 전투 시스템과 매칭"
  economy-designer: "RPG 경제 시스템과 매칭"
  narrative-designer: "RPG + 스토리 모드와 매칭 (2점)"

결과:
  core: [director, planner, generator, evaluator]
  recommended: [combat, progression, economy, narrative, level,
                balance, puzzle, ux, sound, asset, ai]  — 11개
  optional: [physics]  — 1개
```

### 3.4 applyAgents 동작

```
applyAgents(["combat-designer", "economy-designer", ...], "C:/Projects/my-rpg")

1. targetDir = "C:/Projects/my-rpg/.claude/agents/"
2. if .claude/agents/ 존재:
     backup → .claude/agents-backup-{timestamp}/
3. mkdir -p .claude/agents/
4. 각 agentId에 대해:
     src = agent-pool/{category}/{id}.md
     dest = .claude/agents/{id}.md
     fs.copyFileSync(src, dest)
5. return { success: true, appliedAgents: [...ids] }
```

---

## 4. IPC 인터페이스

### 4.1 Main Process 핸들러 (index.ts 추가)

```typescript
// ── Agent Pool ──
ipcMain.handle("agent-pool:get-all", async () => {
  return agentPoolManager.getAll();
});

ipcMain.handle("agent-pool:recommend", async (_event, { specCard }) => {
  return agentPoolManager.recommend(specCard);
});

ipcMain.handle("agent-pool:apply", async (_event, { agentIds, projectDir }) => {
  return agentPoolManager.applyAgents(agentIds, projectDir);
});
```

### 4.2 Preload API (preload/index.ts 추가)

```typescript
agentPool: {
  getAll: () => ipcRenderer.invoke("agent-pool:get-all"),
  recommend: (specCard: SpecCard) =>
    ipcRenderer.invoke("agent-pool:recommend", { specCard }),
  apply: (agentIds: string[], projectDir: string) =>
    ipcRenderer.invoke("agent-pool:apply", { agentIds, projectDir }),
},
```

---

## 5. Discovery 플로우 변경

### 5.1 discovery-store.ts 변경

```typescript
// BEFORE
phase: "harness_select" | "chat" | "review" | "team_setup" | "confirmed"
// 초기값: "harness_select"

// AFTER
phase: "chat" | "review" | "team_setup" | "confirmed"
// 초기값: "chat"

// 새 액션 추가
setRecommendedAgents: (result: {
  core: PoolAgent[];
  recommended: PoolAgent[];
  optional: PoolAgent[];
}) => void;
```

**confirmSpec() 변경**:

```typescript
// BEFORE: agent-catalog.ts의 getRecommendedAgents() 호출
confirmSpec: () => {
  const catalog = getRecommendedAgents(presetId, specCard);
  // ...
}

// AFTER: IPC로 agent-pool:recommend 호출
confirmSpec: async () => {
  const result = await window.harness.agentPool.recommend(specCard);
  // result.core/recommended/optional을 catalogAgents로 변환
  const allAgents = [
    ...result.core.map(a => ({ ...a, category: "core" as const, reason: "필수 에이전트" })),
    ...result.recommended.map(a => ({ ...a, category: "recommended" as const, reason: a.matchReason })),
    ...result.optional.map(a => ({ ...a, category: "optional" as const, reason: a.description })),
  ];
  const selectedIds = new Set([
    ...result.core.map(a => a.id),
    ...result.recommended.map(a => a.id),
  ]);
  set({ phase: "team_setup", catalogAgents: allAgents, selectedAgentIds: selectedIds });
}
```

### 5.2 DiscoveryPage.tsx 변경

```diff
- {store.phase === "harness_select" && (
-   <HarnessSelectStep ... />
- )}

  {store.phase === "chat" && (
    <DiscoveryChat onSpecReady={() => {}} />
  )}
```

**진행률 인디케이터**: 4단계 → 3단계

```diff
- const phaseIndex = ["harness_select", "chat", "review", "team_setup"].indexOf(store.phase);
- const totalPhases = 4;
+ const phaseIndex = ["chat", "review", "team_setup"].indexOf(store.phase);
+ const totalPhases = 3;
```

### 5.3 goBack() 변경

```typescript
// BEFORE
goBack: () => {
  if (phase === "team_setup") set({ phase: "review" });
  else if (phase === "review") set({ phase: "chat" });
  else if (phase === "chat") set({ phase: "harness_select" });
}

// AFTER
goBack: () => {
  if (phase === "team_setup") set({ phase: "review" });
  else if (phase === "review") set({ phase: "chat" });
  // chat이 첫 단계이므로 더 이상 뒤로 갈 수 없음
}
```

### 5.4 App.tsx handleDiscoveryComplete 변경

```typescript
// BEFORE: 하네스 apply + GSD init
if (harnessId && window.harness.harness100) {
  await window.harness.harness100.apply(harnessId, workingDir, "ko");
}

// AFTER: agent-pool apply + GSD init
if (window.harness.agentPool) {
  const agentIds = selectedAgents.map(a => a.id);
  await window.harness.agentPool.apply(agentIds, workingDir);
}
```

### 5.5 AgentTeamSetup.tsx 변경

**CatalogAgent 타입 → PoolAgent 타입**으로 전환.

```diff
- import type { CatalogAgent } from "../../data/agent-catalog";
+ import type { PoolAgent } from "@shared/types";
```

기존 UI 구조 (core/recommended/optional 섹션, 토글 카드, 커스텀 에이전트 추가)는 **그대로 유지**. 데이터 소스만 agent-catalog → agent-pool로 변경.

---

## 6. Electron 번들링

### 6.1 electron-builder.yml 추가

```yaml
extraResources:
  # 기존...
  - from: agent-pool
    to: agent-pool
    filter:
      - "**/*.md"
```

### 6.2 AgentPoolManager 경로 해석

```typescript
// 개발 모드: 프로젝트 루트/agent-pool/
// 패키지 모드: resources/agent-pool/
const basePath = app.isPackaged
  ? path.join(process.resourcesPath, "agent-pool")
  : path.join(__dirname, "..", "..", "agent-pool");
```

---

## 7. 에이전트 풀 목록

### 7.1 core/ (4개)

| 파일명 | displayName | icon | trigger | model |
|--------|-------------|------|---------|-------|
| director.md | Director | 🎬 | manual | opus |
| planner.md | Planner | 🔧 | manual | opus |
| generator.md | Generator | 💻 | after_planner | sonnet |
| evaluator.md | Evaluator | 🔍 | after_generator | opus |

### 7.2 game/ (12개)

| 파일명 | displayName | icon | tags | trigger |
|--------|-------------|------|------|---------|
| combat-designer.md | Combat Designer | ⚔️ | rpg, action, shooter, fighting | after_planner |
| progression-designer.md | Progression Designer | 📈 | rpg, roguelike, idle, growth | after_planner |
| level-designer.md | Level Designer | 🗺️ | platformer, puzzle, shooter, rpg | after_planner |
| physics-designer.md | Physics Designer | 🎱 | platformer, racing, sports, physics | after_planner |
| economy-designer.md | Economy Designer | 💰 | rpg, simulation, strategy, idle, economy | after_planner |
| ai-designer.md | AI Designer | 🧠 | strategy, simulation, rpg, shooter, ai | after_planner |
| narrative-designer.md | Narrative Designer | 📖 | rpg, visual-novel, adventure, story | after_planner |
| puzzle-mechanic.md | Puzzle Mechanic | 🧩 | puzzle, adventure, rpg, logic | after_planner |
| balance-auditor.md | Balance Auditor | ⚖️ | rpg, shooter, strategy, fighting, balance | after_generator |
| ux-reviewer.md | UX Reviewer | 🎯 | all | after_generator |
| sound-planner.md | Sound Planner | 🔊 | all | after_planner |
| asset-planner.md | Asset Planner | 🎨 | all | after_planner |

### 7.3 web/ (5개)

| 파일명 | displayName | icon | tags | trigger |
|--------|-------------|------|------|---------|
| api-designer.md | API Designer | 🔗 | dashboard, saas, ecommerce, social, api | after_planner |
| auth-specialist.md | Auth Specialist | 🔐 | saas, social, ecommerce, auth, login | after_planner |
| db-architect.md | DB Architect | 🗃️ | saas, ecommerce, social, database | after_planner |
| a11y-checker.md | Accessibility Checker | ♿ | saas, dashboard, social, a11y | after_generator |
| responsive-checker.md | Responsive Checker | 📱 | ecommerce, social, saas, mobile | after_generator |

---

## 8. 삭제 대상

| 파일 | 이유 |
|------|------|
| `src/renderer/data/agent-catalog.ts` | agent-pool로 완전 대체 |
| `src/renderer/components/discovery/HarnessSelectStep.tsx` | Discovery 첫 단계 제거 |

**유지 (변경 없음)**:
- `HarnessBrowser.tsx` — 하네스 탭에서 계속 사용
- `HarnessManager` — 하네스 탭의 수동 적용용
- `PresetsPage` — 에이전트 편집기

---

## 9. 구현 순서 (의존성 기반)

```
Phase A: agent-pool/ .md 파일 작성 (21개)
  ↓ (선행 필요 — 백엔드가 스캔할 파일)
Phase B: AgentPoolManager + IPC
  ↓ (선행 필요 — 프론트에서 호출할 API)
Phase C: Discovery 플로우 변경 + agent-catalog 제거
  ↓
Phase D: electron-builder.yml + 빌드 확인
```

---

## 10. 테스트 체크리스트

- [ ] `agent-pool:get-all` → 21개 에이전트 반환
- [ ] `agent-pool:recommend` + RPG specCard → combat, progression, economy 등 recommended
- [ ] `agent-pool:recommend` + 웹앱 specCard → api-designer, auth 등 recommended
- [ ] `agent-pool:apply` → 프로젝트 `.claude/agents/`에 .md 복사 확인
- [ ] Discovery: chat 시작 → specCard → 자동 추천 → team_setup → apply
- [ ] 기존 하네스 탭: HarnessBrowser 정상 동작
- [ ] 빌드: `npm run build` 성공
- [ ] 패키지: extraResources에 agent-pool 포함 확인
