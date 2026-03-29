# Handoff: WorkTool — AI Agent Team Management Desktop App

**Generated**: 2026-03-29 (Session 3 후반)
**Branch**: main
**Repo**: https://github.com/chodolmu/CJ-s-WorkTool.git
**Status**: In Progress — CLI 연동 디버깅 중

## Goal

Claude Code CLI를 감싸는 Electron 데스크톱 앱. 비개발자/반개발자가 AI 에이전트 팀을 시각적으로 관리하며 프로젝트를 개발.

## 현재 상황: CLI 연동이 안 됨

### 증상
- Discovery Chat에서 메시지를 보내면 점 3개(로딩)만 표시되고 응답 없음
- DevTools Console: `[WorkTool] spawn done, waiting for completion...` 이후 멈춤
- 에러 메시지 없음

### 디버깅 로그 위치
- **DevTools Console**: `Ctrl+Shift+I` → `[WorkTool]` 로그
- **파일 로그**: `%TEMP%\worktool-debug.log` (CLIBridge 내부 상태)

### 아직 확인 안 된 것
- `worktool-debug.log`에서 `claudePath`가 뭐로 잡혔는지
- stderr에 뭐가 출력되었는지
- 프로세스가 시작은 됐는지, 아니면 spawn 자체가 실패했는지

### 지금까지 시도한 것과 결과

| 시도 | 결과 |
|------|------|
| `spawn("claude", args, { shell: true })` (cmd.exe) | 영어 OK, 한국어 깨짐 |
| `spawn("claude", args, { shell: bashPath })` | 한국어도 안 됨 |
| `--system-prompt` 인자 전달 | shell이 특수문자 깨뜨림 |
| `--system-prompt-file` 임시 파일 | 시스템 프롬프트 전달 성공 |
| `--bare` 플래그 | 인증(OAuth) 깨짐 — Not logged in |
| `[OVERRIDE]` 시스템 프롬프트 | bkit 지침 무시 부분적 효과 |
| bkit 출력 후처리 regex 제거 | 부분적 효과 |
| 전체 대화를 프롬프트에 포함 | 대화 연속성 개선 |
| `claude.exe` 직접 spawn (shell: false) | 중첩 세션 에러로 테스트 불가 |
| stdin으로 프롬프트 전달 | `--print`가 stdin 무시 |
| `--continue`, `--resume`, `--session-id` | Windows에서 타임아웃/불안정 |
| `--input-format stream-json` | 입력 형식 불명, 응답 없음 |
| `@anthropic-ai/claude-agent-sdk` | API 키 필요 (구독 불가) |

### 근본 문제 분석

1. **shell 경유 시**: cmd.exe가 한국어/특수문자 인자를 깨뜨림
2. **shell 없이 direct spawn**: `claude.exe` 경로 찾아서 직접 실행 — 테스트 환경(Claude Code 세션 안)에서 중첩 제한으로 검증 불가
3. **EXE에서는 중첩 제한 없음**: 독립 실행이라 동작할 가능성 높지만 아직 미확인

### 다음 단계 (가장 시급)

1. **EXE 설치 후 `%TEMP%\worktool-debug.log` 확인** — claudePath, stderr, 프로세스 상태
2. 로그 기반으로 정확한 실패 지점 파악
3. 실패 원인에 따라:
   - `claudePath: null` → 경로 탐색 로직 수정
   - stderr에 에러 → 해당 에러 수정
   - 프로세스 시작됐는데 응답 없음 → 타임아웃/인자 문제

### 고려 중인 대안

- **`@anthropic-ai/claude-agent-sdk`**: 정식 SDK, 세션 유지 지원, 하지만 API 키 필요
- 사용자는 API 키 없이 Claude Code 구독으로 동작하길 원함
- VS Code 확장처럼 구독 기반은 Anthropic 공식 앱만 가능 (서드파티 불가)

## Completed (이번 세션)

### P0 구현 (전부 완료)
- [x] 일정 탭 (캘린더/간트)
- [x] 프리셋 5종 번들링 (30+ YAML)
- [x] 스킬 10종 내장 (10 JSON)
- [x] Plan 자동관리 (PlanManager + PlanPage + Schema v6)
- [x] 스펙-기능 교차검증
- [x] PhaseTracker 연결
- [x] 폴더 선택 다이얼로그
- [x] Windows 패키징 (82MB EXE)

### 아키텍처 리팩터링
- [x] Director Agent 신설 (PD+PM+입력분석)
- [x] PromptTranslator/TaskRouter 삭제 (Director로 통합)
- [x] 로컬 폴백 제거 (모든 대화 CLI로)
- [x] Core 에이전트 4개 (Director+Planner+Generator+Evaluator)
- [x] Pipeline `directorReview` undefined 버그 수정

### UI 수정
- [x] Electron 메뉴바 숨김
- [x] 채팅 버블 오버플로우 수정
- [x] 텍스트 선택/복사 가능하도록

## Failed Approaches (Don't Repeat)

1. **better-sqlite3 static import** — require() 동적 로딩 필수
2. **npm install 후 electron-rebuild 빼먹기** — NODE_MODULE_VERSION 불일치
3. **Tailwind v4** — Vite 5만 지원, v3 유지
4. **모든 .tsx에 `import React` 필요**
5. **prompt() 사용** — Electron에서 안 됨
6. **button 안에 button** — DOM 경고
7. **SCHEMA_VERSION 빼먹기** — 마이그레이션 안 됨
8. **regex 기반 대화 폴백** — 패턴화된 가짜 대화는 불쾌한 경험
9. **PromptTranslator (regex)** — Director AI 판단이 더 정확
10. **TaskRouter (regex)** — Director로 통합
11. **spawn + shell:true + 한국어** — cmd.exe가 인코딩 깨뜨림
12. **문자열 리터럴 백슬래시** — path.join() 사용
13. **outputBuffer → result.output** — fullOutput 별도 누적 필요
14. **--output-format json for 대화** — text 모드 사용
15. **--bare 플래그** — OAuth 인증 깨짐
16. **--system-prompt 인자** — 특수문자 깨짐, --system-prompt-file 사용
17. **stdin으로 프롬프트** — --print가 stdin 무시
18. **--continue/--resume** — Windows에서 타임아웃
19. **이 터미널에서 claude --print 테스트** — 중첩 세션 제한으로 불가

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Director = PD + PM 통합 | CLI 1회로 판단. 분리하면 컨텍스트 전달 비용 |
| 로컬 폴백 제거 | CLI 없으면 안 되는 게 맞음 |
| claude.exe 직접 spawn | shell 경유 인코딩 문제 근본 해결 |
| 시스템 프롬프트 파일 전달 | shell 이스케이핑 문제 방지 |
| bkit 출력 후처리 제거 | --system-prompt-file로 지침 오버라이드 |

## Files to Know

| File | Why |
|------|-----|
| `src/main/agent-runner/cli-bridge.ts` | **핵심** — Claude CLI spawn. findClaudeExe(), findGitBash(), 디버그 로그 |
| `src/main/index.ts` | IPC 핸들러 + discovery:chat (debugLog 포함) |
| `src/main/orchestrator/director-agent.ts` | Director Agent |
| `src/main/orchestrator/pipeline.ts` | Pipeline (runDirectorAndPlanner) |
| `src/main/memory/plan-manager.ts` | Plan 자동관리 |
| `src/renderer/components/discovery/DiscoveryChat.tsx` | Discovery UI (CLI 전용) |

## Resume Instructions

1. **먼저 `%TEMP%\worktool-debug.log` 확인** — EXE 실행 후 채팅 보내면 로그 생성됨
2. 로그에서 `claudePath`와 `stderr` 확인
3. 실패 원인 파악 후 CLIBridge 수정
4. 테스트는 반드시 EXE로 (이 터미널에서 claude --print 테스트 불가 — 중첩 세션)

## Setup

```bash
cd C:/GameMaking/Tool
npm install
npx electron-rebuild -f -w better-sqlite3
npm run dev      # 개발 모드
npm run package  # EXE 빌드
```
