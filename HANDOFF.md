# Handoff: WorkTool v3 — 태스크 드리븐 구현 완료

**Generated**: 2026-04-07 (Session 11)
**Branch**: main
**Status**: v3 핵심 구현 완료, 빌드 성공, E2E 테스트 필요

## Goal

비개발자도 Claude Code를 쉽게 사용하여 프로젝트를 완성할 수 있는 데스크톱 도구.
핵심 철학: **잘게 쪼개서, 명확하게, 깨끗한 컨텍스트에서.**

## What Was Accomplished (Session 11)

### v3 전면 구현 (23개 태스크 중 20개 완료)

#### M1: 핵심 엔진 + 데이터 레이어 ✅
- `src/shared/types.ts` — v3 타입 시스템 전면 재작성
  - Project, Milestone, Sprint, Task, TaskHandoff, ValidationResult, TaskLog, ProjectTree, ProjectStats
- `src/main/memory/database.ts` — v3 SQLite 스키마 (7개 테이블)
- `src/main/memory/memory-manager.ts` — v3 CRUD (Projects, Milestones, Sprints, Tasks, Handoffs, Validations, TaskLogs, ProjectTree, ProjectStats, savePlan)
- `src/main/index.ts` — v3 IPC 핸들러 전면 재작성
  - Discovery (chat + complete)
  - Planning (generate, save, approve, update-task, remove-task)
  - Execution (start, pause, resume, stop, retry-task, skip-task, get-status)
  - Data (get-project-tree, get-task-detail, get-handoff, get-project-stats)
  - Task execution loop with handoff extraction, retry logic, sprint/milestone completion
- `src/preload/index.ts` — v3 API (discovery, project, planning, execution, data, git, dialog, system)

#### M2: UI 재구성 ✅
- `src/renderer/stores/app-store.ts` — v3 상태 (milestones, tasks, execution, stats)
- `src/renderer/stores/discovery-store.ts` — 간소화 (chat + spec_review + confirmed)
- `src/renderer/App.tsx` — 3페이지 라우팅 (dashboard, project, settings) + Discovery/PlanReview 오버레이
- `src/renderer/hooks/useIpcEvents.ts` — v3 이벤트 핸들링
- `src/renderer/pages/DashboardPage.tsx` — 프로젝트 카드 목록
- `src/renderer/pages/PlanReviewPage.tsx` — Opus PM 계획 트리 표시 + 승인
- `src/renderer/pages/ProjectPage.tsx` — 트리 뷰 + 태스크 상세 분할 뷰
- `src/renderer/pages/Discovery/DiscoveryPage.tsx` — 간소화 (chat → spec review → folder)
- `src/renderer/components/discovery/DiscoveryChat.tsx` — v3 store 호환
- `src/renderer/components/discovery/SpecCardReview.tsx` — v3 SpecCard 포맷
- `src/renderer/components/tree/` — ProjectTree, MilestoneNode, SprintNode, TaskNode
- `src/renderer/components/detail/TaskDetailPanel.tsx` — 태스크 상세 패널
- `src/renderer/components/ProjectHeader.tsx` — 진행률 + 실행 제어
- `src/renderer/components/ExecutionBar.tsx` — 하단 실행 상태 바
- `src/renderer/components/layout/Sidebar.tsx` — 간소화 (3탭)

#### 삭제된 파일 (30+)
- gsd-bridge, harness-manager, agent-pool-manager, orchestration-generator
- orchestrator/, preset/, plan-manager, learning-manager, session-manager
- OrchestrationPage, HarnessPage, SchedulePage, PlanPage, SpecsPage, LogsPage
- AgentCard, PhaseTracker, PhaseChat, DecisionModal, CheckpointModal, etc.
- ProjectView (→ ProjectPage), ActivityPanel, DetailPanel

### 빌드 결과
- `electron-vite build` ✅ 성공
- main: 49.39 kB + sdk: 582.42 kB
- preload: 3.47 kB
- renderer: 288.79 kB JS + 40.25 kB CSS

## Architecture (v3 Final)

```
src/
  main/
    index.ts                    — IPC 핸들러 + Task Execution Loop
    agent-runner/
      sdk-chat.ts               — Claude Agent SDK 채팅
      cli-bridge.ts             — CLI 폴백
    memory/
      database.ts               — SQLite v3 스키마
      memory-manager.ts         — v3 CRUD (전체 데이터 레이어)
    tools/
      git-manager.ts            — Git 작업
  
  renderer/
    App.tsx                     — 라우팅 (dashboard/project/settings)
    pages/
      DashboardPage.tsx         — 프로젝트 목록
      ProjectPage.tsx           — 트리 뷰 + 상세 (메인)
      PlanReviewPage.tsx        — 계획 검토/승인
      Discovery/
        DiscoveryPage.tsx       — 프로젝트 정의
      SettingsPage.tsx          — 설정
    components/
      tree/                     — 프로젝트 트리 (4개)
      detail/
        TaskDetailPanel.tsx     — 태스크 상세
      ProjectHeader.tsx         — 프로젝트 헤더
      ExecutionBar.tsx          — 실행 상태 바
      discovery/                — Discovery 채팅/리뷰
      layout/                   — Sidebar, Titlebar
    stores/
      app-store.ts              — v3 상태
      discovery-store.ts        — Discovery 상태
      theme-store.ts            — 테마
    hooks/
      useIpcEvents.ts           — v3 IPC 이벤트
  
  shared/
    types.ts                    — v3 도메인 타입
  
  preload/
    index.ts                    — v3 API
```

## Key Decisions

1. **Opus PM을 main process에서 직접 실행** — 별도 모듈 대신 index.ts의 planning:generate 핸들러에서 SdkChat으로 호출
2. **Task execution loop** — main process에서 while 루프로 순차 실행, 의존성 체크 포함
3. **Handoff 자동 추출** — 태스크 완료 시 응답에서 JSON handoff 파싱
4. **Sprint/Milestone 자동 완료** — 하위 태스크 모두 완료 시 자동 상태 전환

## Remaining Tasks

### M3-S2-T1: DashboardPage v3 갱신
- 프로젝트 카드에 마일스톤 진행률, 비용 요약 추가

### M4: 폴리싱 (2 태스크)
- 에러 핸들링 + 로딩/빈 상태
- 최종 빌드 검증 + 미사용 코드 정리

### 실전 테스트 필요
- Discovery → Plan → Execute 전체 플로우 E2E 확인
- 실제 프로젝트에서 Opus PM 분할 품질 확인
- 태스크 실행 + handoff 추출 + 검증 동작 확인

## Warnings

- **vendor/는 .gitignore** — `bash scripts/prepare-vendor.sh`로 재생성 필요
- **DB 스키마 변경** — 기존 v2 DB는 호환 안 됨, 새 DB가 자동 생성됨
- **기존 미커밋 변경 다수** — 이 세션의 모든 변경이 미커밋 상태
- **E2E 테스트 미실행** — 빌드만 확인, 실제 실행은 테스트 안 됨

## Resume Instructions

1. 미커밋 변경을 커밋: `git add . && git commit -m "feat: WorkTool v3 태스크 드리븐 구현"`
2. `npx electron-vite dev`로 실행 테스트
3. Discovery → Plan → Execute 전체 플로우 확인
4. 남은 태스크 (M3-S2-T1, M4) 완료
