# Dynamic Harness Planning Document — 에이전트 풀 기반 동적 하네스 조합

> **Summary**: 고정 하네스 선택 대신, 에이전트 .md 풀에서 프로젝트 특성에 맞는 에이전트를 자동 조합하여 `.claude/agents/`를 동적 생성
>
> **Project**: WorkTool
> **Version**: 0.4.0
> **Author**: User + Claude
> **Date**: 2026-04-02
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 현재 Discovery 플로우가 "하네스 먼저 고르기 → 대화"라서, 사용자가 뭘 만들지도 정하기 전에 102개 하네스 중에서 골라야 함. 게임 하네스는 `05-game-narrative` 1개뿐이라 RPG에 경제 에이전트가 필요해도 선택할 수 없음 |
| **Solution** | Discovery 순서를 "대화 먼저 → 자동 에이전트 조합"으로 뒤집고, 개별 에이전트 .md 파일 풀에서 specCard 키워드 기반으로 필요한 에이전트만 자동 선택하여 `.claude/agents/`에 복사 |
| **Function/UX Effect** | 사용자는 대화만 하면 프로젝트에 최적화된 에이전트 팀이 자동 구성됨. "경제 중요한 RPG" → 전투설계 + 성장설계 + 경제설계 + 밸런스검증이 자동으로 붙음 |
| **Core Value** | 고정 템플릿의 한계를 넘어 프로젝트마다 맞춤형 에이전트 팀을 조합 — "하네스를 고르는 게 아니라 하네스가 만들어진다" |

---

## 1. 현재 구조 분석

### 1.1 문제점

```
현재 Discovery 플로우:
  harness_select (사용자가 102개 중 선택) 
  → chat (대화)
  → review (스펙 확인)  
  → team_setup (에이전트 팀 확인)
```

- 하네스 선택이 첫 단계 → 뭘 만들지도 모르는데 선택 강요
- 게임 하네스 1개 (`05-game-narrative`) → RPG/플랫포머/슈팅 구분 불가
- 하네스 = 고정 에이전트 세트 → "RPG인데 경제 에이전트도 필요" 같은 커스텀 불가
- `agent-catalog.ts`(UI 카드)와 하네스 `.md`(실제 지침)가 분리되어 이중 관리

### 1.2 목표 구조

```
새 Discovery 플로우:
  chat (대화로 프로젝트 파악)
  → auto-match (specCard 키워드 → 에이전트 풀에서 자동 매칭)
  → review (스펙 + 추천 에이전트 확인/수정)
  → team_setup (최종 에이전트 팀 확인)
  → .claude/agents/ 자동 생성
```

---

## 2. 구현 계획

### 2.1 에이전트 풀 구축 (`agent-pool/`)

프로젝트 루트에 `agent-pool/` 디렉토리를 만들어 개별 에이전트 .md 파일을 관리.

```
agent-pool/
├── core/                    ← 모든 프로젝트 공통 (항상 포함)
│   ├── director.md
│   ├── planner.md
│   ├── generator.md
│   └── evaluator.md
├── game/                    ← 게임 프로젝트 전용
│   ├── combat-designer.md       tags: [rpg, action, shooter, fighting]
│   ├── progression-designer.md  tags: [rpg, roguelike, idle]
│   ├── level-designer.md        tags: [platformer, puzzle, shooter, rpg]
│   ├── physics-designer.md      tags: [platformer, racing, sports]
│   ├── economy-designer.md      tags: [rpg, simulation, strategy, idle]
│   ├── ai-designer.md           tags: [strategy, simulation, rpg, shooter]
│   ├── narrative-designer.md    tags: [rpg, visual-novel, adventure]
│   ├── puzzle-mechanic.md       tags: [puzzle, adventure, rpg]
│   ├── balance-auditor.md       tags: [rpg, shooter, strategy, fighting]
│   ├── ux-reviewer.md           tags: [all]
│   ├── sound-planner.md         tags: [all]
│   └── asset-planner.md         tags: [all]
└── web/                     ← 웹앱 전용 (기존 WEBAPP_AGENTS 대체)
    ├── api-designer.md
    ├── auth-specialist.md
    ├── db-architect.md
    └── ...
```

각 .md 파일 구조 (하네스-100 에이전트와 동일):
```markdown
---
name: combat-designer
displayName: "Combat Designer"
icon: "⚔️"
description: "게임 전투 시스템 설계. 턴제/액션/스킬/데미지 공식."
tags: [rpg, action, shooter, fighting, combat]
category: game
trigger: after_planner
model: sonnet
---

# Combat Designer — 전투 시스템 설계자

당신은 게임 전투 시스템 설계 전문가입니다...

## 핵심 역할
...

## 작업 원칙
...

## 산출물 포맷
...
```

### 2.2 에이전트 매칭 엔진 (`AgentPoolManager`)

**위치**: `src/main/agent-pool-manager.ts`

**핵심 로직**:
1. `agent-pool/` 디렉토리 스캔 → frontmatter 파싱 → 인덱스 빌드
2. specCard에서 키워드 추출 (projectType, coreDecisions, techStack, expansions)
3. 키워드 ↔ 에이전트 tags 매칭 점수 계산
4. core/ 에이전트는 항상 포함
5. 매칭 점수 상위 N개 자동 선택 (recommended)
6. 나머지는 optional로 표시

```typescript
interface PoolAgent {
  id: string;
  displayName: string;
  icon: string;
  description: string;
  tags: string[];
  category: "core" | "game" | "web";
  trigger: string;
  model: string;
  filePath: string;       // .md 파일 경로 (복사용)
  fullContent: string;    // .md 전체 내용
}

class AgentPoolManager {
  // 풀 스캔 + 인덱스
  async buildIndex(): Promise<PoolAgent[]>;
  
  // specCard 기반 자동 매칭
  recommend(specCard: SpecCard): {
    core: PoolAgent[];         // 항상 포함
    recommended: PoolAgent[];  // 매칭 점수 > 0
    optional: PoolAgent[];     // 나머지
  };
  
  // 선택된 에이전트 .md를 프로젝트에 복사
  applyAgents(agentIds: string[], projectDir: string): {
    success: boolean;
    appliedAgents: string[];
  };
}
```

### 2.3 Discovery 플로우 변경

**discovery-store.ts 수정**:
```
phase: "chat" → "review" → "team_setup" → "confirmed"
         ↑ 첫 단계가 chat으로 변경
         
"harness_select" 단계 제거
```

**DiscoveryPage.tsx 수정**:
- `harness_select` 렌더링 제거
- chat → specCard 생성 후 자동으로 `agentPool.recommend(specCard)` 호출
- review 단계에서 추천 에이전트 목록 표시 (사용자가 토글 가능)

**HarnessSelectStep.tsx**:
- 삭제 또는 team_setup 내 "에이전트 추가 브라우저"로 전환

### 2.4 IPC 연결

```
preload:
  agentPool.recommend(specCard)  → ipcRenderer.invoke("agent-pool:recommend", specCard)
  agentPool.apply(ids, dir)      → ipcRenderer.invoke("agent-pool:apply", { ids, dir })
  agentPool.getAll()             → ipcRenderer.invoke("agent-pool:get-all")

main/index.ts:
  ipcMain.handle("agent-pool:recommend", ...) → agentPoolManager.recommend()
  ipcMain.handle("agent-pool:apply", ...)     → agentPoolManager.applyAgents()
  ipcMain.handle("agent-pool:get-all", ...)   → agentPoolManager.getAll()
```

### 2.5 기존 시스템과의 관계

| 기존 | 변경 후 |
|------|---------|
| `agent-catalog.ts` (UI 카드 전용) | **삭제** — agent-pool .md가 UI 카드 데이터도 제공 |
| `HarnessManager.applyHarness()` (통째 복사) | **유지** — 하네스 탭에서 수동 적용 시 사용 |
| `HarnessBrowser` (카탈로그 브라우저) | **유지** — 하네스 탭용 + team_setup에서 추가 에이전트 브라우징 |
| `PresetsPage` (에이전트 편집) | **유지** — 프로젝트별 에이전트 커스터마이징 |

### 2.6 prepare-vendor.sh 수정

`agent-pool/`은 프로젝트 코드에 포함 (vendor가 아님).
빌드 시 `extraResources`로 Electron에 번들링.

```bash
# electron-vite.config.ts (또는 electron-builder 설정)
extraResources: [
  { from: "agent-pool", to: "agent-pool" }
]
```

---

## 3. 구현 순서

### Phase A: 에이전트 풀 구축 (파일 작업)
1. `agent-pool/core/` — 4개 에이전트 .md 작성
2. `agent-pool/game/` — 12개 게임 에이전트 .md 작성
3. `agent-pool/web/` — 5개 웹 에이전트 .md 작성 (기존 WEBAPP_AGENTS 이관)

### Phase B: AgentPoolManager 구현 (백엔드)
1. `src/main/agent-pool-manager.ts` 생성
2. frontmatter 파싱, 인덱스 빌드, 매칭 알고리즘
3. `applyAgents()` — 선택된 .md를 프로젝트 `.claude/agents/`에 복사
4. IPC 핸들러 등록 (`main/index.ts`)
5. preload에 API 추가

### Phase C: Discovery 플로우 변경 (프론트엔드)
1. `discovery-store.ts` — 초기 phase를 `"chat"`으로 변경, `harness_select` 제거
2. `DiscoveryPage.tsx` — `harness_select` 렌더링 제거
3. `DiscoveryChat.tsx` 또는 store — specCard 생성 후 `agent-pool:recommend` 호출
4. `AgentTeamSetup.tsx` — agent-pool 추천 결과를 표시하도록 수정
5. `App.tsx` — `handleDiscoveryComplete`에서 `agentPool.apply()` 호출

### Phase D: agent-catalog.ts 제거 + 통합
1. `agent-catalog.ts` 삭제
2. `getRecommendedAgents()` 호출부를 agent-pool IPC로 교체
3. 빌드 확인

---

## 4. 파일 변경 목록

| 작업 | 파일 | 변경 |
|------|------|------|
| 신규 | `agent-pool/core/*.md` (4개) | 핵심 에이전트 지침 |
| 신규 | `agent-pool/game/*.md` (12개) | 게임 에이전트 지침 |
| 신규 | `agent-pool/web/*.md` (5개) | 웹앱 에이전트 지침 |
| 신규 | `src/main/agent-pool-manager.ts` | 매칭 엔진 |
| 수정 | `src/main/index.ts` | IPC 핸들러 추가 |
| 수정 | `src/preload/index.ts` | agentPool API 추가 |
| 수정 | `src/renderer/stores/discovery-store.ts` | 초기 phase → chat, harness_select 제거 |
| 수정 | `src/renderer/pages/Discovery/DiscoveryPage.tsx` | 플로우 변경 |
| 수정 | `src/renderer/components/discovery/AgentTeamSetup.tsx` | pool 추천 결과 사용 |
| 수정 | `src/renderer/App.tsx` | applyAgents 호출 추가 |
| 삭제 | `src/renderer/data/agent-catalog.ts` | agent-pool로 대체 |
| 수정 | `electron-vite.config.ts` | extraResources 추가 |

---

## 5. 리스크 & 대응

| 리스크 | 대응 |
|--------|------|
| 에이전트 .md 파일이 많아지면 스캔 느려짐 | 캐시 JSON 사용 (HarnessManager와 동일 패턴) |
| 매칭 알고리즘이 부정확할 수 있음 | tag 기반 + 사용자가 review에서 토글 가능 |
| 기존 하네스-100 카탈로그와 충돌 | 별도 시스템으로 유지, 하네스 탭에서는 기존 그대로 |
| agent-pool/ 번들 사이즈 | .md 파일이라 수십KB 수준, 무시 가능 |
