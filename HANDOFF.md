# Handoff: Dynamic Harness — 에이전트 풀 기반 동적 하네스 조합

**Generated**: 2026-04-02 (Session 9)
**Branch**: main
**Repo**: https://github.com/chodolmu/CJ-s-WorkTool.git
**Status**: Phase 6~7 완료, Dynamic Harness Plan+Design 완료 → Do 대기

## Goal

Claude Code CLI를 감싸는 Electron 데스크톱 앱. GSD SDK + Harness-100 기반.
**다음 목표**: 고정 하네스 선택 방식을 "에이전트 풀 기반 동적 조합"으로 전환.

## What Was Accomplished (Session 9)

### Phase 6: 하네스 → GSD init 연결 검증
1. GSD init 플로우 검증 (App.tsx → preload → main → gsd-bridge.ts) — 정상 연결 확인
2. `vendor/gsd/sdk/dist/init-runner.js` 존재 확인
3. 하네스 적용 + GSD init 에러 핸들링 개선 (silent catch → 로깅)
4. E2E 테스트에 하네스 카탈로그/검색/GSD SDK 테스트 3개 추가

### Phase 7: 레거시 UI 정리
5. `MainPanel.tsx` 삭제 — 데드코드 (어디서도 import 안 됨)
6. `HarnessPage.tsx` 생성 — 2탭 구조 (카탈로그 HarnessBrowser + 에이전트 편집)
7. `App.tsx` — PresetsPage → HarnessPage 교체
8. `ProjectView.tsx` — 6탭 → 4탭 (plan/agents 탭 제거, 미사용 import 정리)
9. `PresetsPage.tsx` — 헤더 축소 (HarnessPage 내부 탭용)
10. 빌드 성공 확인 (3/3 모듈)

### Dynamic Harness 설계
11. Plan 작성: `docs/01-plan/features/dynamic-harness.plan.md`
12. Design 작성: `docs/02-design/features/dynamic-harness.design.md`

## Architecture

```
Electron App
├── main/
│   ├── index.ts              — IPC 핸들러
│   ├── gsd-bridge.ts         — GSD SDK 래퍼
│   ├── harness-manager.ts    — Harness-100 카탈로그
│   ├── agent-pool-manager.ts — ★TODO: 동적 에이전트 매칭 엔진
│   ├── agent-runner/
│   │   ├── sdk-chat.ts       — Agent SDK 채팅
│   │   └── cli-bridge.ts     — CLI 폴백
│   ├── memory/               — 프로젝트/세션/플랜 DB (v7: stepId)
│   └── tools/git-manager.ts
├── renderer/
│   ├── pages/
│   │   ├── OrchestrationPage.tsx — 좌(파이프라인) + 우(PhaseChat)
│   │   ├── ProjectView.tsx       — 4탭 (overview, pipeline, specs, logs)
│   │   ├── HarnessPage.tsx       — ★NEW (카탈로그 + 에이전트 편집)
│   │   └── Discovery/            — 4단계 → ★TODO: 3단계로 변경
│   ├── components/
│   │   ├── PhaseChat.tsx
│   │   ├── HarnessBrowser.tsx
│   │   └── discovery/
│   │       ├── HarnessSelectStep.tsx — ★TODO: 삭제 예정
│   │       ├── DiscoveryChat.tsx
│   │       ├── SpecCardReview.tsx
│   │       └── AgentTeamSetup.tsx    — ★TODO: PoolAgent 타입으로 전환
│   ├── stores/
│   │   ├── app-store.ts
│   │   └── discovery-store.ts        — ★TODO: phase "chat"으로 시작
│   └── data/
│       └── agent-catalog.ts          — ★TODO: 삭제 (agent-pool로 대체)
├── agent-pool/                       — ★TODO: 신규 디렉토리
│   ├── core/ (4개 .md)
│   ├── game/ (12개 .md)
│   └── web/ (5개 .md)
└── vendor/
    ├── gsd/sdk/dist/
    └── harness-100/ko,en/
```

## Key Decisions

1. **엔진은 오픈소스, GUI는 우리 것** — GSD 파이프라인 관리, Harness-100 에이전트 정의
2. **에이전트 풀 동적 조합** — 고정 하네스 선택 대신 specCard 키워드 기반 자동 매칭
3. **Discovery chat 먼저** — 하네스 선택 단계 제거, 대화로 프로젝트 파악 후 자동 추천
4. **agent-pool/ = 프로젝트 코드** — vendor가 아닌 소스에 포함, extraResources로 번들링

## Current State

### 완료 ✅
- Phase 6~7 코드 변경 (미커밋 상태)
- Dynamic Harness Plan + Design 문서

### 미완성 ⚠️ (Do Phase — 4단계)
- **Phase A**: `agent-pool/` 에이전트 .md 파일 21개 작성 (core 4 + game 12 + web 5)
- **Phase B**: `AgentPoolManager` 백엔드 + IPC 핸들러 + preload API
- **Phase C**: Discovery 플로우 변경 (chat 먼저, harness_select 제거, agent-catalog 삭제)
- **Phase D**: electron-builder.yml extraResources + 빌드 확인

### 미커밋 파일
- 수정: App.tsx, ProjectView.tsx, PresetsPage.tsx, test-audit.js
- 삭제: MainPanel.tsx
- 신규: HarnessPage.tsx, dynamic-harness.plan.md, dynamic-harness.design.md

## Failed Approaches (Previous Sessions)

1. claude stdin: --print 모드는 stdin을 안 읽음
2. --continue/--resume: Windows에서 타임아웃
3. shell: true spawn: PowerShell이 claude.exe 못 찾음
4. 대화 전체 재전송: 토큰 낭비 → Agent SDK 세션으로 해결
5. 자체 파이프라인 엔진: 유지보수 비용 > 가치 → GSD로 교체
6. 고정 하네스 선택 방식: 게임 하네스 1개뿐 + 커스텀 불가 → 동적 에이전트 풀로 전환

## Warnings

- **vendor/는 .gitignore** — `bash scripts/prepare-vendor.sh`로 재생성 필요
- **GSD SDK는 ESM-only** — `await import(fileUrl)` 패턴 사용
- **에이전트 .md 파일 작성 시 사용자 허락 필요** — game 에이전트 내용 확인 받고 생성
- **agent-catalog.ts 삭제 전** AgentTeamSetup.tsx의 CatalogAgent 타입 import 변경 필수
- **DB v7 migration**: chat_messages에 step_id 컬럼 추가 (nullable)
- **Phase 6~7 변경사항 미커밋** — 커밋 전 `npm run build`로 재확인 권장

## Resume Instructions

1. `bash scripts/prepare-vendor.sh` (vendor/ 재생성)
2. `npm run build` (빌드 확인 — Phase 6~7 변경 포함)
3. 미커밋 변경사항 커밋 결정 (Phase 6~7 완료분)
4. **Dynamic Harness Do Phase 시작**:
   - Design 문서 참조: `docs/02-design/features/dynamic-harness.design.md`
   - Phase A: `agent-pool/` 에이전트 .md 작성 (사용자 확인 후)
   - Phase B: `src/main/agent-pool-manager.ts` 구현
   - Phase C: Discovery 플로우 변경
   - Phase D: 빌드 + 테스트
5. 참조: `docs/01-plan/features/dynamic-harness.plan.md`
