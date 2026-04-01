# Handoff: WorkTool v2 — GSD + Harness-100 피벗

**Generated**: 2026-04-02 (Session 7)
**Branch**: main
**Repo**: https://github.com/chodolmu/CJ-s-WorkTool.git
**Status**: 백엔드 피벗 완료 — UI 플로우 재설계 필요

## Goal

Claude Code CLI를 감싸는 Electron 데스크톱 앱. 자체 오케스트레이션 엔진을 GSD SDK + Harness-100 오픈소스로 교체하여, GUI 시각화에 집중.

## What Was Accomplished (Session 7)

### 1. GSD + Harness-100 피벗 완료
- `vendor/gsd/` — GSD SDK dist + gsd-tools.cjs + agents (1.4MB)
- `vendor/harness-100/` — ko/en 200개 하네스 프리셋 (12MB)
- `scripts/prepare-vendor.sh` — 빌드 + 복사 자동화

### 2. 자체 엔진 삭제 (9파일)
- pipeline.ts, director-agent.ts, smart-orchestrator.ts, phase-coach.ts
- prompt-assembler.ts, guideline-generator.ts, error-handler.ts
- skill-detector.ts, research-agent.ts
- resources/presets/ (5종)

### 3. 신규 모듈
- `src/main/gsd-bridge.ts` — GSD SDK 래퍼 (파이프라인 실행, 이벤트 전달, 승인 콜백)
- `src/main/harness-manager.ts` — Harness-100 카탈로그 인덱싱, 검색, .claude/ 복사 적용
- `src/renderer/components/HarnessBrowser.tsx` — 카테고리별 카드 UI (미연결)

### 4. index.ts 수술
- GSD IPC 핸들러 6개 + Harness IPC 핸들러 6개 추가
- chat:send / discovery:chat → SDK 전환 (CLI 폴백 포함)
- 레거시 파이프라인 핸들러 삭제
- E2E 감사 재작성 (17항목, 전부 통과)

### 5. UI 기반 연결
- preload: gsd + harness100 API 추가
- app-store: GSD 파이프라인 상태 추가
- useIpcEvents: GSD 이벤트 리스너 추가
- OrchestrationPage: PipelineControls를 GSD 시작/중단으로 교체

## Architecture

```
Electron App
├── main/
│   ├── index.ts          — IPC 핸들러 (GSD/Harness/Chat)
│   ├── gsd-bridge.ts     — GSD SDK 래퍼 ★NEW
│   ├── harness-manager.ts — Harness-100 카탈로그 ★NEW
│   ├── agent-runner/
│   │   ├── sdk-chat.ts   — Agent SDK 채팅 (세션 유지)
│   │   └── cli-bridge.ts — CLI 폴백
│   ├── memory/           — 프로젝트/세션/플랜 DB
│   └── tools/git-manager.ts
├── renderer/
│   ├── pages/
│   │   ├── OrchestrationPage.tsx — GSD 이벤트 연결 ★UPDATED
│   │   ├── ChatPage.tsx          — ★삭제 예정 (파이프라인 통합)
│   │   └── ...
│   ├── components/
│   │   └── HarnessBrowser.tsx    — ★NEW (미연결)
│   └── stores/app-store.ts      — GSD 상태 추가
└── vendor/
    ├── gsd/sdk/dist/             — GSD SDK 빌드
    └── harness-100/ko,en/        — 200개 하네스
```

## Key Decisions

1. **엔진은 오픈소스, GUI는 우리 것** — GSD가 파이프라인 관리, Harness-100이 에이전트 정의
2. **SDK 채팅 + CLI 폴백** — SDK 실패 시 자동으로 CLI --print 전환
3. **vendor/ 번들링** — exe에 GSD + Harness-100 내장 (~14MB)
4. **파이프라인 + 채팅 통합 UX** — 채팅 탭을 없애고 파이프라인 우측에 단계별 세션

## Current State

### 빌드: 성공 ✅ (3/3)
### E2E 감사: 17/17 통과 ✅

### 미완성 ⚠️
- **HarnessBrowser가 어떤 페이지에도 안 붙어있음**
- **프로젝트 생성 플로우가 레거시 (프리셋→Discovery→팀구성)**
- **채팅 탭이 아직 독립 존재 (파이프라인 통합 안 됨)**
- **GSD init → .planning/ 생성 UI 미연결**

## Failed Approaches (Previous Sessions)

1. claude stdin: --print 모드는 stdin을 안 읽음
2. --continue/--resume: Windows에서 타임아웃
3. shell: true spawn: PowerShell이 claude.exe 못 찾음
4. 대화 전체 재전송: 토큰 낭비 → Agent SDK 세션으로 해결
5. 자체 파이프라인 엔진: 유지보수 비용 > 가치 → GSD로 교체

## Warnings

- **vendor/는 .gitignore** — `bash scripts/prepare-vendor.sh`로 재생성 필요
- **GSD SDK는 ESM-only** — `await import(fileUrl)` 패턴 사용
- **gsd-tools.cjs 경로**: `vendor/gsd/bin/gsd-tools.cjs` (get-shit-done/get-shit-done/bin/ 에서 복사)

## Resume Instructions

1. `bash scripts/prepare-vendor.sh` (vendor/ 재생성)
2. `npm run dev` (앱 실행 확인)
3. **Phase 5: UI 플로우 재설계**
   - 프로젝트 생성: HarnessBrowser → 하네스 선택 → .claude/ 적용 → GSD init
   - OrchestrationPage: 좌측 파이프라인 + 우측 단계별 채팅
   - ChatPage.tsx 삭제 → PhaseChat.tsx로 교체
   - 네비게이션: 채팅 탭 제거
4. **Phase 6: 하네스 → GSD init 연결**
5. **Phase 7: 레거시 UI 정리**
6. 참조 문서: `docs/01-plan/features/Tool-v2.plan.md`, `docs/02-design/features/Tool-v2.design.md`
