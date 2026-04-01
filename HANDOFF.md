# Handoff: WorkTool v2 — Phase 5 UI 플로우 재설계 완료

**Generated**: 2026-04-02 (Session 8)
**Branch**: main
**Repo**: https://github.com/chodolmu/CJ-s-WorkTool.git
**Status**: Phase 5 완료 — Phase 6~7 진행 필요

## Goal

Claude Code CLI를 감싸는 Electron 데스크톱 앱. GSD SDK + Harness-100 기반으로, GUI 시각화에 집중.

## What Was Accomplished (Session 8)

### Phase 5: UI 플로우 재설계 (Track A + Track B)

#### Track A: 파이프라인 + 채팅 통합
1. **PhaseChat.tsx 생성** — ChatPage에서 핵심 채팅 로직 추출, 단계별 stepId 기반
2. **OrchestrationPage.tsx 재설계** — 좌측 380px 파이프라인 + 우측 PhaseChat 분할 레이아웃
3. **ProjectView.tsx 수정** — 채팅 탭 제거 (7→6탭), 파이프라인 탭 full height
4. **ChatPage.tsx 삭제** — PhaseChat으로 완전 교체
5. **Backend stepId 지원** — ChatMessage, preload, index.ts, memory-manager, DB migration v7

#### Track B: 하네스 브라우저 연결
6. **HarnessBrowser.tsx Tailwind 마이그레이션** — inline style→Tailwind, select/apply 모드 추가
7. **HarnessSelectStep.tsx 생성** — Discovery 첫 단계로 하네스 선택 UI
8. **discovery-store.ts 수정** — harness_select 초기 phase, selectedHarnessId 상태
9. **DiscoveryPage.tsx 수정** — 4단계 위저드 (harness_select→chat→review→team_setup)
10. **Sidebar.tsx 수정** — "프리셋" → "하네스" (🧩)
11. **App.tsx 수정** — TopPage "presets"→"harness", 하네스 apply + GSD init 연결

### 빌드: 성공 ✅ (3/3)

## Architecture

```
Electron App
├── main/
│   ├── index.ts          — IPC 핸들러 (GSD/Harness/Chat + stepId)
│   ├── gsd-bridge.ts     — GSD SDK 래퍼
│   ├── harness-manager.ts — Harness-100 카탈로그
│   ├── agent-runner/
│   │   ├── sdk-chat.ts   — Agent SDK 채팅 (세션 유지)
│   │   └── cli-bridge.ts — CLI 폴백
│   ├── memory/           — 프로젝트/세션/플랜 DB (v7: stepId)
│   └── tools/git-manager.ts
├── renderer/
│   ├── pages/
│   │   ├── OrchestrationPage.tsx — 좌(파이프라인) + 우(PhaseChat) ★REDESIGNED
│   │   ├── ProjectView.tsx       — 6탭 (chat 제거) ★UPDATED
│   │   └── Discovery/            — 4단계 위저드 ★UPDATED
│   ├── components/
│   │   ├── PhaseChat.tsx          — ★NEW (단계별 채팅)
│   │   ├── HarnessBrowser.tsx     — ★UPDATED (Tailwind + select모드)
│   │   └── discovery/
│   │       └── HarnessSelectStep.tsx — ★NEW
│   └── stores/
│       ├── app-store.ts           — activePhaseChatStepId ★UPDATED
│       └── discovery-store.ts     — harness_select phase ★UPDATED
└── vendor/
    ├── gsd/sdk/dist/
    └── harness-100/ko,en/
```

## Key Decisions

1. **엔진은 오픈소스, GUI는 우리 것** — GSD가 파이프라인 관리, Harness-100이 에이전트 정의
2. **SDK 채팅 + CLI 폴백** — SDK 실패 시 자동으로 CLI --print 전환
3. **vendor/ 번들링** — exe에 GSD + Harness-100 내장 (~14MB)
4. **파이프라인 + 채팅 통합 UX** — 채팅 탭을 없애고 파이프라인 좌/우 분할 레이아웃
5. **Discovery 4단계** — 하네스 선택 → 대화 → 스펙 리뷰 → 팀 구성

## Current State

### 완료 ✅
- 파이프라인 + PhaseChat 좌/우 분할
- 채팅 탭 완전 제거
- HarnessBrowser Tailwind + select 모드
- Discovery 4단계 위저드 (하네스 → 대화 → 리뷰 → 팀)
- Backend stepId 지원 (DB v7)
- 사이드바 "프리셋" → "하네스" 변경

### 미완성 ⚠️
- **하네스 탭 페이지 개선** — 현재 PresetsPage를 그대로 보여줌, HarnessBrowser를 포함하는 새 페이지 필요
- **GSD init → .planning/ 생성 UI 확인** — 하네스 적용 후 GSD init 연결은 코드 추가했으나 미테스트
- **레거시 UI 정리** — MainPanel.tsx의 Page 타입 등 구 라우팅 잔재
- **E2E 감사 재실행** — Phase 5 변경 후 테스트 미실행

## Failed Approaches (Previous Sessions)

1. claude stdin: --print 모드는 stdin을 안 읽음
2. --continue/--resume: Windows에서 타임아웃
3. shell: true spawn: PowerShell이 claude.exe 못 찾음
4. 대화 전체 재전송: 토큰 낭비 → Agent SDK 세션으로 해결
5. 자체 파이프라인 엔진: 유지보수 비용 > 가치 → GSD로 교체

## Warnings

- **vendor/는 .gitignore** — `bash scripts/prepare-vendor.sh`로 재생성 필요
- **GSD SDK는 ESM-only** — `await import(fileUrl)` 패턴 사용
- **gsd-tools.cjs 경로**: `vendor/gsd/bin/gsd-tools.cjs`
- **DB v7 migration**: chat_messages에 step_id 컬럼 추가 (nullable)

## Resume Instructions

1. `bash scripts/prepare-vendor.sh` (vendor/ 재생성)
2. `npm run dev` (앱 실행 확인)
3. **Phase 6: 하네스 → GSD init 연결 테스트**
   - Discovery로 프로젝트 생성 → 하네스 선택 → .claude/ 적용 확인
   - GSD 파이프라인 시작 → 이벤트 수신 확인
4. **Phase 7: 레거시 UI 정리**
   - MainPanel.tsx의 Page 타입 정리 (구 라우팅 잔재)
   - 하네스 탭 페이지 개선 (HarnessBrowser + PresetsPage 통합)
   - E2E 감사 재실행
5. 참조 문서: `docs/01-plan/features/Tool-v2.plan.md`, `docs/02-design/features/Tool-v2.design.md`
