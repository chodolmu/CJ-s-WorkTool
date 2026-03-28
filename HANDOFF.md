# Handoff: WorkTool — AI Agent Team Management Desktop App

**Generated**: 2026-03-28
**Branch**: No git repo yet (all files are new, uncommitted)
**Status**: In Progress

## Goal

Claude Code를 감싸는 Electron 데스크톱 앱을 만든다. 비개발자/반개발자가 AI 에이전트 팀을 시각적으로 관리하며 프로젝트를 개발할 수 있게 한다. Discovery(선택지 질문)로 아이디어를 구체화하고, Planner→Generator→Evaluator 3에이전트가 자동으로 코드를 생성/검증한다.

## Completed

- [x] Electron + React + Vite + Tailwind 프로젝트 셋업 (electron-vite)
- [x] 다크/라이트 모드 테마 시스템 (CSS 변수 기반 + Zustand 스토어)
- [x] 3패널 레이아웃 (Sidebar + MainPanel + DetailPanel + ActivityPanel)
- [x] IPC 기본 구조 (preload contextBridge, 13+ 핸들러)
- [x] SQLite 스키마 (projects, features, agent_runs, activities, sessions)
- [x] MemoryManager CRUD (프로젝트/기능/에이전트 실행/활동/세션)
- [x] PresetManager (YAML 프리셋 로드/파싱, builtin + custom)
- [x] 게임 프리셋 (질문 7개, 에이전트 3개 YAML, 평가기준)
- [x] Discovery 위저드 UI (PresetSelector → QuestionWizard → SpecCardReview)
- [x] CLIBridge (Claude Code CLI spawn + stdout 파싱 + abort)
- [x] PromptAssembler (5모듈 자동 조립: base + preset + role + state + task)
- [x] Orchestrator Pipeline (Planner→Generator→Evaluator 루프 + 체크포인트)
- [x] GuidelineGenerator (AI 지침 자동 작성 — 한 줄 입력 → Claude가 세부 지침 생성)
- [x] 에이전트 상태 카드 (StatusDot 펄스 애니메이션 + 진행률)
- [x] ActivityFeed (실시간 로그 + 필터 + 자동 스크롤)
- [x] ChangeSummary (비전공자 언어 변경 요약)
- [x] CheckpointModal (사용자 확인 오버레이)
- [x] AgentEditor 간편모드 + 상세모드 UI
- [x] 프리셋 관리 페이지 (에이전트 목록/추가/편집/삭제)
- [x] SessionManager (세션 자동 요약, 앱 종료 시 저장)
- [x] Error handler (에러 분류 + 지수 백오프 재시도 + 상태 보존)
- [x] Settings 페이지 (Claude Code 설치 체크 포함)
- [x] ProgressBar, FeatureList 컴포넌트
- [x] WelcomePage
- [x] electron-builder 패키징 설정 (Windows)
- [x] Gap 분석 2회차: 92% Match Rate 달성

## Not Yet Done

### 핵심 누락 기능 (사용자가 세션 말미에 지적)
- [ ] **채팅 UI** — AI와 자유 대화하는 공간. Discovery 이후에도 "이거 바꿔줘", "왜 이렇게 했어?" 소통 필요. 메시지 입력 + AI 응답 스트리밍 + 히스토리
- [ ] **멀티 프로젝트 관리** — 프로젝트 목록/생성/전환/삭제. 현재는 1개 프로젝트만 가정
- [ ] **PM 대시보드** — 스펙 카드 뷰, 기능 목록(FeatureList 연결), 결정 히스토리, 전체 진행률 한눈에
- [ ] **오케스트레이션 총괄 뷰** — Planner→Generator→Evaluator 흐름도, 어떤 에이전트가 어떤 기능을 맡고 있는지 시각화

### 기술적 미완성
- [ ] IPC TODO 스텁 구현: `preset:save`, `agent:save`, `agent:delete`, `pipeline:resume` (Main 핸들러에 `{ ok: true }` 반환만 하고 실제 로직 없음)
- [ ] Specs 페이지 — 현재 placeholder. 스펙 카드 + Planner 결과 표시해야 함
- [ ] Logs 페이지 — 현재 placeholder. 전체 활동 로그 검색/필터 뷰
- [ ] `SessionManager.getLastSessionSummary()` — 현재 null 반환 (TODO), `memoryManager.getLastSessionSummary()`로 연결 필요
- [ ] FindingsList 컴포넌트 — Evaluator 검증 결과(findings) 표시용
- [ ] CLIResult에 tokenUsage 필드 추가 — 토큰 사용량 추적
- [ ] 앱 시작 시 Claude Code 설치 자동 체크 (현재는 Settings에서 수동 체크만)

### 패키징
- [ ] 앱 아이콘 (`build/icon.ico`) — 현재 없음
- [ ] `npm run package` 실행 테스트

## Failed Approaches (Don't Repeat These)

### 1. better-sqlite3 번들링 문제
- **시도**: `electron-vite.config.ts`에서 `rollupOptions.external: ["better-sqlite3"]`로 설정
- **실패 이유**: electron-vite가 `rollupOptions.external`을 main 빌드에 적용하지 않음. `externalizeDepsPlugin({ include: [...] })`도 효과 없음. 59 modules 번들링 유지.
- **해결**: `database.ts`에서 `import Database from "better-sqlite3"` 대신 **동적 `require()`** 사용:
  ```typescript
  function loadSqlite() {
    return require("better-sqlite3");
  }
  ```
  이렇게 하면 번들러가 인라인하지 않고 런타임 `require()`로 남김.

### 2. better-sqlite3 Node 버전 불일치
- **시도**: `npm install`로 설치된 better-sqlite3는 시스템 Node.js(v127)용으로 컴파일됨
- **실패 이유**: Electron은 자체 Node.js(v130)를 내장하므로 `NODE_MODULE_VERSION` 불일치
- **해결**: `npx electron-rebuild -f -w better-sqlite3` — Electron 버전에 맞게 재컴파일. **npm install 후 항상 이거 실행해야 함**

### 3. React is not defined
- **시도**: `tsconfig.renderer.json`에 `"jsx": "react-jsx"` + `@vitejs/plugin-react`로 자동 JSX 변환 기대
- **실패 이유**: electron-vite dev 모드에서 JSX 자동 변환이 작동하지 않음
- **해결**: 모든 `.tsx` 파일에 `import React from "react"` 수동 추가

### 4. Tailwind v4 + electron-vite 호환 실패
- **시도**: `tailwindcss@^4.0.0` + `@tailwindcss/vite@^4.0.0`
- **실패 이유**: `electron-vite@2.3.0`이 Vite 5만 지원, Tailwind v4 vite 플러그인은 Vite 6 필요
- **해결**: Tailwind v3 + PostCSS 방식으로 다운그레이드

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite만 사용 (파일 기반 state.json 제거) | DB+파일 이중 저장 시 동기화 버그 위험, UI가 있어 파일 직접 열 일 없음 |
| 프리셋은 YAML 파일 기반 유지 | 사람이 읽고 편집할 수 있어야 함 |
| Guidelines은 마크다운 파일 유지 | 에이전트 지침은 사람이 직접 편집 가능해야 |
| Claude Code CLI 호출 (API 아닌) | 사용자의 Claude 구독으로 자동 인증, API 키 관리 불필요 |
| 세션 요약은 로컬 생성 (AI 호출 X) | 토큰 절약 — 사용자가 Max 구독제 사용 |
| 비전공자 변경 요약 (diff 대신) | diff를 봐도 이해 못함 → "로그인 화면을 만들었습니다" 같은 요약 |
| AI 지침 자동 작성 (FR-27~29) | 사용자는 "게임 밸런스 검증" 한 줄만 적으면 AI가 세부 지침 생성 |
| 이름: WorkTool (Harness에서 변경) | 사용자 요청 — 업무 툴 컨셉, 타로 테마 제거 |

## Current State

**Working**:
- `npm run dev` → Electron 앱 실행됨
- Discovery 플로우: 프리셋 선택 → 7단계 질문 → 스펙 카드 확인 → "Start Building" 클릭
- 다크/라이트 모드 전환 (Titlebar 토글)
- Sidebar 네비게이션 (Home/Agents/Specs/Logs/Presets/Settings)
- 프리셋 관리: 에이전트 추가/편집/삭제 UI
- 빌드: `npx electron-vite build` 성공 (51 modules)

**Not yet testable** (Claude Code CLI 필요):
- Pipeline 실행 (Planner→Generator→Evaluator)
- 실시간 에이전트 상태 업데이트
- 변경 요약 표시
- 체크포인트 모달

**Known issues**:
- DetailPanel 무한 루프 — 수정 완료 (useMemo), 재확인 필요
- `npm install` 후 반드시 `npx electron-rebuild -f -w better-sqlite3` 실행 필요

## Files to Know

| File | Why It Matters |
|------|----------------|
| `src/main/index.ts` | 앱 진입점 + 모든 IPC 핸들러 등록 (가장 큰 파일) |
| `src/main/orchestrator/pipeline.ts` | 핵심 실행 엔진 — Planner→Generator→Evaluator 루프 |
| `src/main/agent-runner/cli-bridge.ts` | Claude Code CLI spawn + stdout 파싱 |
| `src/main/agent-runner/prompt-assembler.ts` | 5모듈 프롬프트 자동 조립 |
| `src/main/memory/database.ts` | SQLite 스키마 + better-sqlite3 동적 로딩 (**require() 필수**) |
| `src/main/memory/memory-manager.ts` | 전체 CRUD (Project/Feature/AgentRun/Activity/Session) |
| `src/main/preset/preset-manager.ts` | YAML 프리셋 로드/파싱 |
| `src/preload/index.ts` | contextBridge API — Renderer가 Main에 접근하는 유일한 경로 |
| `src/renderer/App.tsx` | React 루트 — Discovery/Dashboard/Checkpoint 전환 |
| `src/renderer/stores/app-store.ts` | Zustand 전역 상태 (agents, pipeline, activities, features) |
| `src/renderer/stores/discovery-store.ts` | Discovery 단계 상태관리 |
| `src/renderer/stores/theme-store.ts` | 다크/라이트 모드 |
| `src/renderer/styles/global.css` | CSS 변수 기반 테마 (--wt-bg-base 등) |
| `src/shared/types.ts` | 전체 타입 정의 (16개 인터페이스) |
| `resources/presets/game/preset.yaml` | 게임 프리셋 (Discovery 질문 + 평가기준) |
| `resources/presets/game/agents/*.yaml` | Planner/Generator/Evaluator 에이전트 정의 |
| `electron-vite.config.ts` | 빌드 설정 — externalizeDepsPlugin 사용 |
| `docs/01-plan/features/harness-tool.plan.md` | 기획서 (29개 FR) |
| `docs/02-design/features/harness-tool.design.md` | 설계서 (아키텍처, 데이터모델, IPC, 모듈 상세) |
| `RND_HARNESS_TOOL.md` | R&D 보고서 (레퍼런스 분석, 디자인 채택 근거) |

## Code Context

### IPC 통신 구조
```
Renderer (React)              Main (Node.js)
   window.harness.xxx  →  ipcMain.handle("xxx")
   window.harness.on() ←  mainWindow.webContents.send()
```

### Preload API (src/preload/index.ts)
```typescript
window.harness = {
  getVersion, on,
  discovery: { start, answer, complete },
  pipeline: { start, pause, resume },
  project: { create, list, load, loadLast },
  session: { start, end },
  checkpoint: { respond },
  preset: { list, save },
  activities: { list },
  agent: { generateGuidelines, save, delete },
  system: { checkClaudeCode },
}
```

### Pipeline 실행 흐름 (src/main/orchestrator/pipeline.ts)
```
run()
  → runPlanner() → parsePlannerOutput() → createFeature() x N
  → requestCheckpoint("planner_complete") → 사용자 승인 대기
  → for each feature:
      → runFeatureLoop(feature, maxRetries=3)
          → runAgent("generator") → runAgent("evaluator")
          → verdict === "pass" ? next : retry with feedback
      → requestCheckpoint("feature_complete")
  → updateProjectStatus("completed")
```

### Zustand Store 구조 (src/renderer/stores/app-store.ts)
```typescript
{
  currentProjectId, projectName,
  features: FeatureItem[],
  agents: AgentCardData[],         // { id, displayName, icon, status, currentFeature, progress, lastChangeSummary }
  pipeline: { status, completedFeatures, totalFeatures, currentFeature },
  activities: ActivityItem[],      // 최대 500개 유지
  pendingCheckpoint: { id, type, data } | null,
  selectedAgentId: string | null,
}
```

### 테마 CSS 변수 (src/renderer/styles/global.css)
```css
.dark  { --wt-bg-base: #0a0a0a; --wt-text-primary: #e5e5e5; ... }
.light { --wt-bg-base: #f8f8f8; --wt-text-primary: #1a1a1a; ... }
/* Tailwind에서 bg-bg-base, text-text-primary 등으로 사용 */
```

## Resume Instructions

1. 프로젝트 구조 확인:
   ```bash
   cd C:/GameMaking/Tool
   npm run dev
   ```
   - Expected: Electron 앱 창이 뜨고, "WorkTool v0.1.0" 타이틀바 + 다크 테마 + "+ New Project" 버튼 표시
   - If better-sqlite3 에러: `npx electron-rebuild -f -w better-sqlite3` 실행 후 재시도

2. Discovery 테스트: "+ New Project" → Game 선택 → 7개 질문 답변 → 스펙 카드 확인 → "Start Building"
   - Expected: 콘솔에 `Discovery complete, pipeline would start: {...}` 로그
   - 대시보드에 Planner/Generator/Evaluator 카드 3개 표시

3. 다음 구현 우선순위:
   - **채팅 UI** (가장 중요 — 사용자가 AI와 소통하는 유일한 채널)
   - **멀티 프로젝트** (프로젝트 목록 사이드바 또는 탭)
   - **PM 대시보드** (Specs 페이지에 스펙 카드 + FeatureList 연결)
   - **오케스트레이션 뷰** (파이프라인 흐름도)

4. 기획서/설계서 참조:
   - `docs/01-plan/features/harness-tool.plan.md` — 기능 요구사항 (FR-01~29)
   - `docs/02-design/features/harness-tool.design.md` — 아키텍처, IPC, 모듈 설계

## Setup Required

```bash
cd C:/GameMaking/Tool
npm install
npx electron-rebuild -f -w better-sqlite3  # 반드시 실행!
npm run dev                                  # 개발 서버 시작
```

- Claude Code가 시스템에 설치되어 있어야 Pipeline 실행 가능 (`claude --version`으로 확인)
- Node.js 18+ 필요

## Edge Cases & Error Handling

- Claude Code 미설치 시 → Pipeline 실행에서 `spawn claude ENOENT` 에러. Settings 페이지에서 "Check" 버튼으로 확인 가능하지만, 앱 시작 시 자동 체크는 미구현
- Rate limit 시 → `error-handler.ts`가 지수 백오프로 자동 재시도 (rate_limit은 5배 긴 대기)
- 에이전트 크래시 시 → 1회 자동 재시도 후 실패 → 프로젝트 상태 "paused"로 보존
- Evaluator 3회 반려 시 → 루프 중단 + CheckpointModal로 사용자에게 알림

## Warnings

- `database.ts`에서 `import` 대신 `require("better-sqlite3")` 사용 — **이유**: electron-vite 번들러가 네이티브 모듈을 인라인하면 `.node` 파일 경로가 깨짐. 절대 static import로 바꾸지 말 것
- `npm install` 후 반드시 `npx electron-rebuild` 실행 — 안 하면 NODE_MODULE_VERSION 불일치 에러
- `MemoryManager`의 `db` 파라미터 타입이 `any` — better-sqlite3 dynamic require 때문. 타입 안전성 손실 감수
- 모든 `.tsx` 파일에 `import React from "react"` 필요 — electron-vite에서 자동 JSX 변환 안 됨
- `useAppStore` 셀렉터에서 `.filter()`, `.slice()` 같은 새 배열 생성 시 `useMemo` 필수 — 안 하면 무한 루프
