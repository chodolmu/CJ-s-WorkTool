# Handoff: WorkTool — Agent SDK 전환 + 파이프라인 안정화

**Generated**: 2026-03-30 (Session 5)
**Branch**: main
**Repo**: https://github.com/chodolmu/CJ-s-WorkTool.git
**Last Commit**: a187894 feat: 15개 파이프라인 이슈 수정 + Agent SDK 채팅 전환 + 파이프라인 제어 UI
**Status**: 구현 완료 — EXE 테스트 필요

## Goal

Claude Code CLI를 감싸는 Electron 데스크톱 앱. 비개발자/반개발자가 AI 에이전트 팀을 시각적으로 관리하며 프로젝트를 개발. **이번 세션에서 15개 파이프라인 이슈 전부 수정 + Agent SDK로 채팅 전환 + 파이프라인 제어 UI 추가.**

## What Was Accomplished (Session 5)

### 1. 15개 파이프라인 이슈 전체 수정
- **P0**: Evaluator 상세 시스템 프롬프트 (에이전트별 buildAgentSystemPrompt), 4단계 파서 (codeblock→비탐욕JSON→전체JSON→텍스트추론), Director 파이프라인 분류 수정
- **P1**: autoApprove 자동 진행 모드, maxRetries 기본값 10 (UI에 3/5/10/20 옵션), 재시도 딜레이 최적화 (3s→1s)
- **P2**: 에이전트 running 상태 표시 (system/thinking/tool_call 이벤트), 기능 목록 실시간 갱신, core 에이전트 서버측 삭제 차단, Generator 질문 패턴 감지, Director 스펙 누락 경고
- **P3**: 로그 필터 6종 (전체/중요만/System/Error/Done/Tool + 카운트), 단계 상세 표시 (실행중/완료 상태), 단계별 보고서 emit

### 2. 파이프라인 제어 UI
- 일시정지 (⏸) / 재개 (▶) / 강제 중단 (⏹, 2단계 확인) / 재시작 (🔄) 버튼
- 중단 시 실행 중인 CLI 프로세스 SIGTERM 종료
- Pipeline.stop()에서 activeSession.abort() + checkpoint cancel

### 3. Agent SDK 채팅 전환
- `@anthropic-ai/claude-agent-sdk` 설치 (구독 플랜 사용, API 키 불필요)
- `SdkChat` 클래스 — 프로젝트별 세션 유지, 스트리밍, CLI 폴백
- Discovery 채팅 + 프로젝트 채팅 모두 SDK 전환
- 대화 연속성 확보 (더 이상 전체 대화 텍스트 재전송 안 함)

### 4. 채팅 실시간 작업 내역
- chat:activity 이벤트 — tool_use, thinking, tool_result, system 구분
- ActivityTrailItem 컴포넌트 — 최근 항목 밝게, 이전 항목 흐리게, pulse 인디케이터
- 도구별 사람 친화적 메시지 (📄 파일 읽기, 🔍 검색 등)

## Architecture

```
Electron App (src/)
├── main/
│   ├── index.ts              — IPC 핸들러, SDK/CLI 채팅 라우팅
│   ├── agent-runner/
│   │   ├── cli-bridge.ts     — claude --print 프로세스 매니저 (파이프라인 전용)
│   │   └── sdk-chat.ts       — Agent SDK 채팅 엔진 (세션 유지) ★NEW
│   ├── orchestrator/
│   │   ├── pipeline.ts       — 파이프라인 엔진 (autoApprove, stop, 상세 프롬프트)
│   │   └── director-agent.ts — Director AI (스펙 매칭, 누락 경고)
│   ├── memory/               — 프로젝트/채팅 메모리
│   └── preset/               — 에이전트 프리셋
├── preload/
│   └── index.ts              — IPC API (pipeline.stop/restart 추가)
├── renderer/
│   ├── pages/
│   │   ├── ChatPage.tsx      — 채팅 + 실시간 작업 내역 ActivityTrail ★UPDATED
│   │   ├── OrchestrationPage.tsx — 파이프라인 제어 버튼 + 단계 상세 ★UPDATED
│   │   ├── SettingsPage.tsx  — autoApprove 토글, maxRetries 옵션 ★UPDATED
│   │   └── ProjectView.tsx   — 설정값 파이프라인 전달 ★UPDATED
│   ├── components/
│   │   └── ActivityFeed.tsx  — 로그 필터 6종 ★UPDATED
│   └── hooks/
│       └── useIpcEvents.ts   — 에이전트 상태, 기능 갱신 ★UPDATED
└── shared/
    └── types.ts              — PipelineConfig.autoApprove 추가
```

## Key Decisions

1. **채팅 = Agent SDK, 파이프라인 = CLI --print**: 채팅은 대화 연속성 필요 → SDK. 파이프라인 에이전트는 파일 수정 필요 → CLI.
2. **SDK 실패 시 CLI 폴백**: SDK import 실패, 세션 에러 등에서 자동으로 CLI --print로 전환
3. **Evaluator 파서 4단계 전략**: codeblock → 비탐욕 JSON → 전체 JSON → 텍스트 추론 순서로 시도
4. **core 에이전트 보호**: director/planner/generator/evaluator는 서버측에서 삭제 차단

## Current State

### 빌드: 성공 ✅
- `npx electron-vite build` 통과
- TypeScript 에러 없음 (TS6305 stale output만 있음)

### 미테스트 ⚠️
- **Agent SDK 채팅**: 실제 Claude 응답 테스트 필요 (SDK ESM dynamic import가 Electron main에서 작동하는지)
- **파이프라인 15개 이슈**: 실행 테스트로 개선 확인 필요
- **파이프라인 제어 버튼**: 일시정지/중단/재시작 실제 동작
- **autoApprove**: 체크포인트 스킵이 올바르게 동작하는지

## Failed Approaches (From Previous Sessions)

1. **claude stdin**: --print 모드는 stdin을 안 읽음
2. **--continue/--resume**: Windows에서 타임아웃
3. **shell: true spawn**: PowerShell이 claude.exe 못 찾음 → shell: false + 직접 경로 사용
4. **대화 전체 재전송**: 토큰 낭비 → Agent SDK 세션으로 해결

## Warnings

- **Agent SDK ESM**: `@anthropic-ai/claude-agent-sdk`는 ESM-only. Electron main은 CJS이므로 `await import()` 사용. 빌드 시 번들러가 잘 처리하는지 실행 테스트 필수.
- **이 터미널에서 claude 테스트 불가**: Electron 앱 내부에서만 테스트 가능.
- **bkit 상태 파일**: `.bkit/` 하위 파일들은 스테이징하지 않음 (런타임 상태).
- **test-audit.js**: 루트에 테스트 파일 있음 (untracked, 무시해도 됨).

## Resume Instructions

1. `npm run dev`로 앱 실행
2. **Agent SDK 채팅 테스트**: 프로젝트 선택 → 채팅 → 메시지 전송 → 세션 유지되는지 확인
3. **작업 내역 표시 확인**: 채팅 시 tool_use/thinking 이벤트가 ActivityTrail에 보이는지
4. **파이프라인 테스트**: 파이프라인 시작 → Evaluator 파싱 → 자동 승인 모드 → 중단/재시작
5. **SDK 실패 시**: `sdk-chat.ts`의 dynamic import 실패 로그 확인 → CLI 폴백 동작 확인
6. 이슈 있으면 수정, 없으면 `/pdca analyze Tool`로 갭 분석
