# Dynamic Harness Design Document v2

> **Feature**: 하이브리드 하네스 — 프리셋 + 동적 에이전트 풀 + 오케스트레이션 자동생성
> **Plan Reference**: `docs/01-plan/features/dynamic-harness.plan.md`
> **Date**: 2026-04-03 (v2 — v1 대비 오케스트레이션 생성 추가, 하네스 프리셋 복원)
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | v1은 에이전트 개별 조합만 지원. 하네스의 핵심인 "에이전트 협업 지침(CLAUDE.md)"이 없어서 개별 에이전트가 독립 실행됨 → 하네스 대비 효율 저하 |
| **Solution** | 하네스 프리셋 선택 + agent-pool 자유 조합 하이브리드. 어떤 경로든 최종적으로 CLAUDE.md(오케스트레이션)를 자동 생성하여 팀 협업 규칙 보장 |
| **Function/UX Effect** | Discovery에서 "하네스 사용 / 직접 구성" 선택 → 하네스 경로면 검증된 패키지 + 에이전트 추가/제거 가능, 직접 구성이면 agent-pool 추천 → 둘 다 CLAUDE.md 자동 생성 |
| **Core Value** | 하네스의 구조화된 워크플로우 + agent-pool의 자유 조합 + 동적 오케스트레이션 — "프리셋의 안정성과 커스텀의 유연성을 동시에" |

---

## 1. 아키텍처 개요

### 1.1 v1 → v2 변경점

| 항목 | v1 | v2 |
|------|----|----|
| Discovery 첫 단계 | chat (하네스 선택 제거) | **선택지: 하네스 프리셋 / 직접 구성** |
| 하네스 사용 | 불가 (HarnessPage에서 수동만) | **Discovery 내에서 선택 가능** |
| core 4 강제 | 항상 필수 | **하네스 경로: 하네스 에이전트 존중, 직접 구성: core 4 포함** |
| 오케스트레이션 | 없음 | **CLAUDE.md 자동 생성** |
| 에이전트 커스텀 | agent-pool 추천만 | **하네스 + agent-pool 혼합 가능** |

### 1.2 전체 플로우

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Discovery Flow v2                                 │
│                                                                     │
│  [1. 선택] 하네스 프리셋 사용  |  직접 구성                          │
│       │                        │                                    │
│       ▼                        ▼                                    │
│  [2a. Harness]            [2b. Chat]                                │
│  하네스 목록 검색/선택     대화로 프로젝트 파악                       │
│       │                        │                                    │
│       ▼                        ▼                                    │
│  [3a. Harness+Pool]       [3b. Auto-Match]                          │
│  하네스 에이전트 표시      agent-pool 자동 추천                       │
│  + agent-pool에서 추가     core + recommended                       │
│       │                        │                                    │
│       └────────┬───────────────┘                                    │
│                ▼                                                    │
│  [4. Review] 스펙 + 에이전트 팀 확인/수정 (토글 가능)                │
│                │                                                    │
│                ▼                                                    │
│  [5. Orchestration] 선택된 에이전트 기반 CLAUDE.md 자동 생성          │
│                │                                                    │
│                ▼                                                    │
│  [6. Apply] .claude/agents/ + .claude/CLAUDE.md 복사                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Discovery 플로우 상세

### 2.1 Phase 변경

```typescript
// v1
phase: "chat" | "review" | "team_setup" | "confirmed"

// v2
phase: "mode_select" | "harness_browse" | "chat" | "team_setup" | "confirmed"
```

| Phase | 설명 |
|-------|------|
| `mode_select` | "하네스 프리셋" / "직접 구성" 선택 |
| `harness_browse` | 하네스 프리셋 경로: 하네스 검색/선택 |
| `chat` | 직접 구성 경로: 대화로 specCard 생성 → review 통합 |
| `team_setup` | 에이전트 팀 최종 확인 (양쪽 경로 합류) |
| `confirmed` | 완료 |

### 2.2 mode_select 단계

```
┌──────────────────────────────────────────┐
│         어떻게 시작할까요?                  │
│                                          │
│  ┌────────────────┐ ┌────────────────┐   │
│  │ 🎯 하네스 프리셋 │ │ 🛠️ 직접 구성   │   │
│  │                │ │                │   │
│  │ 검증된 에이전트  │ │ 대화로 프로젝트  │   │
│  │ 팀 + 워크플로우  │ │ 파악 후 AI가    │   │
│  │ 100개 프리셋    │ │ 맞춤 팀 추천    │   │
│  │ 에이전트 추가/   │ │                │   │
│  │ 제거 가능       │ │                │   │
│  └────────────────┘ └────────────────┘   │
└──────────────────────────────────────────┘
```

### 2.3 하네스 프리셋 경로 (harness_browse → team_setup)

1. HarnessBrowser로 하네스 검색/선택 (기존 컴포넌트 재사용)
2. 선택한 하네스의 에이전트 목록을 team_setup에 표시
3. **추가**: agent-pool에서 에이전트 추가 가능 (하네스에 없는 에이전트 보충)
4. **제거**: 하네스 에이전트도 토글 가능 (core 강제 X)
5. specCard는 하네스 메타데이터에서 자동 생성 or 간단 질문

### 2.4 직접 구성 경로 (chat → team_setup)

1. 기존 DiscoveryChat으로 대화 → specCard 생성
2. `agent-pool:recommend(specCard)` → core + recommended + optional
3. team_setup에서 확인/수정

---

## 3. 오케스트레이션 자동 생성

### 3.1 왜 필요한가

하네스-100의 CLAUDE.md 예시:
```
하네스 = agents/ (5개 에이전트) + skills/ (4개 스킬) + CLAUDE.md (오케스트레이션)
```

CLAUDE.md에는:
- 에이전트 팀 구조 (누가 뭘 하는지)
- 실행 순서 (worldbuilder → quest-designer → dialogue-writer → ...)
- 산출물 흐름 (각 에이전트의 output → 다음 에이전트의 input)
- 산출물 디렉토리 (`_workspace/`)
- 품질 기준

agent-pool로 에이전트를 자유 조합하면 이 **협업 지침이 없음** → 효율 저하

### 3.2 CLAUDE.md 자동 생성 스펙

**입력**:
- 선택된 에이전트 목록 (id, displayName, role, trigger)
- specCard (projectType, coreDecisions, techStack)
- 소스 경로 (하네스 or agent-pool)

**출력**: `.claude/CLAUDE.md` 파일

**생성 방법**: AI (Claude) 호출로 동적 생성

```typescript
// src/main/orchestration-generator.ts

export class OrchestrationGenerator {
  /**
   * 선택된 에이전트 + specCard → CLAUDE.md 내용 생성
   * 
   * AI에게 프롬프트로 전달:
   * - 에이전트 목록 (이름, 역할, trigger)
   * - 프로젝트 설명 (specCard)
   * - 생성 규칙 (아래 템플릿)
   */
  async generate(params: {
    agents: SelectedAgent[];
    specCard: SpecCard;
    projectDir: string;
  }): Promise<string>;
}

interface SelectedAgent {
  id: string;
  displayName: string;
  description: string;
  trigger: string;
  model: string;
  source: "harness" | "agent-pool" | "custom";
}
```

### 3.3 CLAUDE.md 생성 템플릿

AI에게 전달할 프롬프트 구조:

```
당신은 AI 에이전트 팀의 오케스트레이션 문서를 작성합니다.

## 프로젝트
- 유형: {specCard.projectType}
- 기술 스택: {specCard.techStack}
- 핵심 결정: {specCard.coreDecisions}

## 에이전트 팀
{agents 목록 - id, displayName, description, trigger}

## 작성 규칙
1. "# {projectType} Harness" 제목
2. 한 줄 설명
3. "## 구조" — agents/ 디렉토리 트리
4. "## 워크플로우" — trigger 기반 실행 순서
   - manual → planner 계열 먼저
   - after_planner → 설계 에이전트들
   - after_generator → 검증 에이전트들
5. "## 산출물 흐름" — 각 에이전트가 뭘 만들고 누가 받는지
   - 모든 산출물은 `_workspace/` 에 저장
6. "## 품질 기준" — 평가 에이전트의 검증 항목
7. 한국어로 작성
```

### 3.4 하네스 경로에서의 오케스트레이션

하네스 프리셋 선택 시:
1. 하네스 원본 CLAUDE.md를 **기반으로** 사용
2. 사용자가 에이전트를 추가/제거했으면 → CLAUDE.md를 **재생성**
3. 변경 없으면 → 하네스 원본 CLAUDE.md 그대로 복사

```typescript
if (source === "harness" && !agentsModified) {
  // 하네스 원본 CLAUDE.md 복사
  copyHarnessClaude(harnessId, projectDir);
} else {
  // AI로 새 CLAUDE.md 생성
  const content = await orchestrationGenerator.generate({ agents, specCard, projectDir });
  writeClaudeMd(projectDir, content);
}
```

---

## 4. 타입 변경

### 4.1 PoolAgent (유지 — v1에서 구현됨)

```typescript
// src/shared/types.ts — 이미 존재
export interface PoolAgent { ... }
export interface PoolRecommendation { ... }
```

### 4.2 SelectedAgent (신규)

```typescript
// src/shared/types.ts에 추가
export interface SelectedAgent {
  id: string;
  displayName: string;
  icon: string;
  description: string;
  trigger: string;
  model: string;
  source: "harness" | "agent-pool" | "custom";
}
```

### 4.3 discovery-store 상태 변경

```typescript
interface DiscoveryState {
  // v2 변경
  phase: "mode_select" | "harness_browse" | "chat" | "team_setup" | "confirmed";
  
  // 하네스 경로
  selectedHarnessId: string | null;
  selectedHarnessEntry: HarnessEntry | null;
  harnessAgents: SelectedAgent[];     // 하네스에서 가져온 에이전트
  
  // 공통
  specCard: SpecCard | null;
  teamAgents: SelectedAgent[];        // 최종 팀 (harness + pool 혼합)
  selectedAgentIds: Set<string>;
  
  // 오케스트레이션
  orchestrationContent: string | null; // 생성된 CLAUDE.md 내용
}
```

---

## 5. 백엔드 변경

### 5.1 OrchestrationGenerator (신규)

**파일**: `src/main/orchestration-generator.ts`

```typescript
export class OrchestrationGenerator {
  /**
   * SdkChat을 사용하여 CLAUDE.md 생성
   */
  async generate(params: {
    agents: SelectedAgent[];
    specCard: SpecCard;
  }): Promise<string>;
  
  /**
   * 하네스 원본 CLAUDE.md 읽기
   */
  readHarnessOrchestration(harnessId: string, lang: "ko" | "en"): string | null;
}
```

### 5.2 IPC 추가

```typescript
// 기존 유지
ipcMain.handle("agent-pool:get-all", ...)
ipcMain.handle("agent-pool:recommend", ...)
ipcMain.handle("agent-pool:apply", ...)

// v2 신규
ipcMain.handle("orchestration:generate", async (_event, { agents, specCard }) => {
  return orchestrationGenerator.generate({ agents, specCard });
});

ipcMain.handle("orchestration:get-harness", async (_event, { harnessId, lang }) => {
  return orchestrationGenerator.readHarnessOrchestration(harnessId, lang || "ko");
});
```

### 5.3 Preload 추가

```typescript
orchestration: {
  generate: (agents: unknown[], specCard: unknown) =>
    ipcRenderer.invoke("orchestration:generate", { agents, specCard }),
  getHarness: (harnessId: string, lang?: "ko" | "en") =>
    ipcRenderer.invoke("orchestration:get-harness", { harnessId, lang }),
},
```

### 5.4 Apply 변경

```typescript
// v1: agent-pool:apply만 — .claude/agents/ 에 .md 복사
// v2: agent-pool:apply + orchestration 적용

ipcMain.handle("agent-pool:apply", async (_event, { 
  agentIds, projectDir, orchestration, harnessId 
}) => {
  const result = agentPoolManager.applyAgents(agentIds, projectDir);
  
  // 하네스 에이전트가 있으면 하네스에서도 복사
  if (harnessId) {
    harnessManager.applyAgentFiles(harnessId, projectDir, agentIds);
  }
  
  // CLAUDE.md 저장
  if (orchestration) {
    const claudePath = path.join(projectDir, ".claude", "CLAUDE.md");
    fs.mkdirSync(path.dirname(claudePath), { recursive: true });
    fs.writeFileSync(claudePath, orchestration, "utf-8");
  }
  
  return result;
});
```

---

## 6. 프론트엔드 변경

### 6.1 discovery-store.ts

```typescript
// 초기 상태
phase: "mode_select"  // v1은 "chat"

// 신규 액션
setMode: (mode: "harness" | "custom") => void;
setHarnessAgents: (agents: SelectedAgent[]) => void;
mergePoolAgents: (recommendation: PoolRecommendation) => void;
setOrchestration: (content: string) => void;
```

**confirmSpec 변경**:
```typescript
confirmSpec: async () => {
  const { specCard, selectedHarnessId, harnessAgents } = get();
  
  if (selectedHarnessId && harnessAgents.length > 0) {
    // 하네스 경로: 하네스 에이전트 + agent-pool 추가분
    const poolResult = await window.harness.agentPool.recommend(specCard);
    // harnessAgents를 기본으로, pool의 recommended를 "추가 가능" 목록으로
    set({ 
      phase: "team_setup",
      teamAgents: [...harnessAgents],
      // pool agents는 optional로 표시 (이미 하네스에 있는 건 제외)
    });
  } else {
    // 직접 구성 경로: 기존 v1 로직
    const result = await window.harness.agentPool.recommend(specCard);
    // core + recommended 자동 선택
    set({ phase: "team_setup", ... });
  }
}
```

### 6.2 DiscoveryPage.tsx

```diff
+ {store.phase === "mode_select" && (
+   <ModeSelectStep
+     onSelectHarness={() => store.setMode("harness")}
+     onSelectCustom={() => store.setMode("custom")}
+   />
+ )}
+
+ {store.phase === "harness_browse" && (
+   <HarnessBrowseStep
+     onSelect={(harnessId, entry, agents) => {
+       store.setSelectedHarness(harnessId, entry);
+       store.setHarnessAgents(agents);
+       store.setPhase("team_setup");
+     }}
+     onBack={() => store.setPhase("mode_select")}
+   />
+ )}

  {store.phase === "chat" && (
    <DiscoveryChat onSpecReady={() => {}} />
  )}

- {store.phase === "review" && ...}  // review를 team_setup에 통합

  {store.phase === "team_setup" && (
    <AgentTeamSetup
      onConfirm={handleTeamConfirm}
      onBack={() => store.goBack()}
    />
  )}
```

### 6.3 ModeSelectStep (신규)

**파일**: `src/renderer/components/discovery/ModeSelectStep.tsx`

두 개의 카드를 보여주는 간단한 선택 화면:
- "하네스 프리셋" — 검증된 에이전트 팀 + 워크플로우, 커스텀 가능
- "직접 구성" — 대화로 프로젝트 파악 후 AI가 맞춤 팀 추천

### 6.4 HarnessBrowseStep (신규 or HarnessSelectStep 재활용)

기존 HarnessBrowser 컴포넌트를 래핑하여 Discovery 내에서 사용.
하네스 선택 시 해당 하네스의 에이전트 목록을 파싱하여 `SelectedAgent[]`로 변환.

### 6.5 AgentTeamSetup 변경

```diff
// v1: catalogAgents (CatalogAgent[]) — pool 추천만
// v2: teamAgents (SelectedAgent[]) — harness + pool 혼합

+ 에이전트 소스 표시 (badge)
+   "하네스" — 하네스에서 가져온 에이전트
+   "추천" — agent-pool이 추천한 에이전트
+   "커스텀" — 사용자가 직접 추가한 에이전트

+ "에이전트 추가" 패널
+   agent-pool 목록에서 선택 (현재 팀에 없는 에이전트)
+   하네스에도 pool에도 없는 경우 커스텀 생성

- core 카테고리 강제 잠금 제거
+ 모든 에이전트 토글 가능 (경고만 표시: "이 에이전트 없이 진행하면 ...")
```

### 6.6 handleTeamConfirm (App.tsx) 변경

```typescript
const handleTeamConfirm = async () => {
  // 1. 에이전트 적용 (.claude/agents/)
  const agentIds = selectedAgents.map(a => a.id);
  await window.harness.agentPool.apply(agentIds, workingDir, ...);
  
  // 2. 오케스트레이션 생성/적용 (.claude/CLAUDE.md)
  let orchestration: string;
  if (harnessId && !agentsModified) {
    orchestration = await window.harness.orchestration.getHarness(harnessId);
  } else {
    orchestration = await window.harness.orchestration.generate(selectedAgents, specCard);
  }
  
  // 3. Apply (agents + CLAUDE.md)
  await window.harness.agentPool.apply(agentIds, workingDir, orchestration, harnessId);
  
  // 4. GSD init
  await window.harness.gsd.initProject(workingDir, specCard.projectType);
};
```

---

## 7. 진행률 인디케이터

### 하네스 경로 (4단계)
```
[선택] → [하네스] → [팀구성] → [완료]
  1         2          3         4
```

### 직접 구성 경로 (3단계)
```
[선택] → [대화] → [팀구성] → [완료]
  1        2         3         4
```

공통: `mode_select` 이후 현재 경로에 맞는 단계 수 표시.

---

## 8. 에이전트 풀 (유지 — v1에서 구현됨)

agent-pool/ 디렉토리 구조와 21개 .md 파일은 v1 그대로 유지.
AgentPoolManager의 buildIndex, recommend, applyAgents도 유지.

---

## 9. 삭제 대상

| 파일 | 이유 | v2 상태 |
|------|------|---------|
| `src/renderer/data/agent-catalog.ts` | v1에서 삭제됨 | 유지 (삭제 상태) |
| `src/renderer/components/discovery/HarnessSelectStep.tsx` | v1에서 삭제됨 | **복원 또는 HarnessBrowseStep으로 대체** |

---

## 10. 구현 순서 (v2 변경분만)

```
Phase E: 타입 + OrchestrationGenerator 백엔드
  ├── SelectedAgent 타입 추가
  ├── OrchestrationGenerator 클래스 생성
  ├── IPC 핸들러 추가 (orchestration:generate, orchestration:get-harness)
  └── Preload API 추가
  ↓
Phase F: Discovery 플로우 v2
  ├── discovery-store: phase 변경, 하네스 상태 추가
  ├── ModeSelectStep 컴포넌트 생성
  ├── HarnessBrowseStep 컴포넌트 생성 (HarnessBrowser 래핑)
  ├── AgentTeamSetup: 소스 badge, 토글 자유화
  └── DiscoveryPage: 새 phase 렌더링
  ↓
Phase G: Apply 통합
  ├── agent-pool:apply 확장 (orchestration, harnessId 파라미터)
  ├── App.tsx handleTeamConfirm 변경
  └── 하네스 에이전트 파일 복사 로직
  ↓
Phase H: 빌드 + 테스트
  ├── npm run build 확인
  └── E2E: 하네스 경로 / 직접 구성 경로 각각 테스트
```

---

## 11. 테스트 체크리스트

### 하네스 프리셋 경로
- [ ] mode_select → "하네스 프리셋" 선택
- [ ] harness_browse → 하네스 검색 + 선택
- [ ] team_setup → 하네스 에이전트 표시 + agent-pool 에이전트 추가 가능
- [ ] 에이전트 변경 없음 → 하네스 원본 CLAUDE.md 복사
- [ ] 에이전트 추가/제거 → CLAUDE.md 재생성
- [ ] Apply → .claude/agents/ + .claude/CLAUDE.md 복사 확인

### 직접 구성 경로
- [ ] mode_select → "직접 구성" 선택
- [ ] chat → specCard 생성 → 자동 추천
- [ ] team_setup → core + recommended 자동 선택
- [ ] 에이전트 토글 (core 포함) 가능
- [ ] CLAUDE.md 자동 생성 (AI 호출)
- [ ] Apply → .claude/agents/ + .claude/CLAUDE.md 복사 확인

### 공통
- [ ] 빌드: `npm run build` 성공
- [ ] 오케스트레이션: 에이전트 trigger 기반 실행 순서가 논리적
- [ ] 오케스트레이션: 산출물 흐름이 에이전트 간 연결됨
