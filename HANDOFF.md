# Handoff: WorkTool — AI Agent Team Management Desktop App

**Generated**: 2026-03-29 (Session 3 완료)
**Branch**: main
**Repo**: https://github.com/chodolmu/CJ-s-WorkTool.git
**Status**: In Progress — P0 구현 완료, CLI 연동 E2E 테스트 진행 중

## Goal

Claude Code CLI를 감싸는 Electron 데스크톱 앱. 비개발자/반개발자가 AI 에이전트 팀을 시각적으로 관리하며 프로젝트를 개발. 자연어 대화로 프로젝트를 정의하고 AI가 기획→코드생성→검증까지 자동 수행.

## Completed (Session 1 + 2 + 3)

### Session 1-2 (기존)
- [x] Electron + React + Vite + Tailwind + SQLite
- [x] IPC 구조 (preload contextBridge, 50+ 핸들러)
- [x] Dashboard, ProjectView (7 서브탭), Discovery Chat, Chat UI
- [x] 3-Tier 실행 모드, Pipeline (Planner→Generator→Evaluator)
- [x] Agent Learning, Auto-Skill Detection, Decision Requester
- [x] 전체 UI 한글화, 다크/라이트 모드

### Session 3 — P0 구현
- [x] **일정 탭**: SchedulePage (캘린더/간트 차트 뷰), PM 자동 일정 배분
- [x] **프리셋 5종 번들링**: game/webapp/mobile/api-server/desktop (30+ YAML)
- [x] **스킬 10종 내장**: handoff, code-review, testing, deployment 등 (10 JSON)
- [x] **Plan 자동관리**: PlanManager + PlanPage UI + Schema v6 + 변경 이력 추적
- [x] **스펙-기능 교차검증**: CheckpointModal 누락 경고, getSpecMatchRate()
- [x] **PhaseTracker 연결**: Pipeline→Phase 자동 전환 (advancePhase)
- [x] **폴더 선택**: Electron dialog API + "찾아보기" 버튼
- [x] **Windows 패키징**: electron-builder → WorkTool Setup 0.1.0.exe (82MB)

### Session 3 — 아키텍처 리팩터링
- [x] **Director Agent 신설**: PD + PM + 입력분석 + 모드판단 + 작업분배를 CLI 1회로 처리
- [x] **SmartOrchestrator 축소**: 실행 엔진으로만 동작 (판단은 Director)
- [x] **PromptTranslator 삭제**: regex 기반 의도분석 → Director AI 판단으로 대체
- [x] **TaskRouter 삭제**: regex 3-Tier 분류 → Director AI 판단으로 대체
- [x] **로컬 폴백 제거**: 모든 대화를 Claude CLI로 처리 (패턴화된 대화 제거)

### Session 3 — CLI 연동 수정
- [x] Windows git-bash 경로 자동 탐색 (path.join으로 이스케이핑 해결)
- [x] CLAUDE_CODE_GIT_BASH_PATH 환경변수 자동 설정
- [x] fullOutput 누적으로 출력 버퍼 버그 수정
- [x] Discovery 대화 text 모드 (JSON 파싱 문제 해결)
- [x] Electron 메뉴바 autoHideMenuBar

## 에이전트 구조 (최종)

```
User: 자연어 입력
  ↓
[SmartOrchestrator] — 실행 엔진 (AI 호출 없음)
  ↓
[Director Agent] — CLI 1회 호출 (sonnet)
  입력 분석 + 모드 판단 + 작업 계획 + 일정 수립 + 진행 추적
  ↓
├── Planner   (기능 분해/설계)     — opus
├── Generator (코드 구현)          — sonnet
├── Evaluator (검증/통과/반려)     — opus
└── 전문 에이전트 (프리셋별 2개)   — sonnet/haiku
```

## Not Yet Done

### P0 잔여 — CLI 연동 E2E 테스트
- [ ] Discovery AI 대화가 실제로 좋은 스펙을 만드는지 확인
- [ ] Pipeline 전체 루프 테스트 (Planner→Generator→Evaluator)
- [ ] Chat Direct/Light/Full 모드별 실제 동작 확인
- [ ] Director Agent 판단 품질 확인

### P1 — Beta
- [ ] 토큰 사용량 대시보드
- [ ] 기능 누락 감지 알림 (지속적)
- [ ] 세션 복구 (크래시 후 재개)
- [ ] 자동 업데이트 (electron-updater)
- [ ] 설치 마법사 + Claude Code 사전 체크
- [ ] 다국어 지원 기반 (i18n)
- [ ] 프로젝트 Import/Export
- [ ] 프리셋 에디터 고도화

### P2 — Launch
- [ ] 스킬 마켓플레이스
- [ ] 비용 예측 시스템
- [ ] 팀 협업 (멀티 사용자)
- [ ] 영문화
- [ ] macOS/Linux 빌드

## Failed Approaches (Don't Repeat)

1. **better-sqlite3 static import** — 반드시 `require()` 동적 로딩
2. **npm install 후 electron-rebuild 빼먹기** — NODE_MODULE_VERSION 불일치
3. **Tailwind v4** — electron-vite가 Vite 5만 지원, v3 유지
4. **모든 .tsx에 `import React from "react"` 필요** — electron-vite 자동 JSX 변환 안 됨
5. **prompt() 사용** — Electron에서 지원 안 됨
6. **button 안에 button** — React DOM 경고
7. **SCHEMA_VERSION 업데이트 빼먹기** — 마이그레이션 안 돌아감
8. **regex 기반 대화 폴백** — 패턴화된 대화는 불쾌한 경험. 모든 대화는 Claude CLI로
9. **PromptTranslator (regex 의도분석)** — Director AI가 직접 판단하는 게 정확
10. **TaskRouter (regex 3-Tier 분류)** — 같은 이유로 Director로 통합
11. **spawn("claude") + shell:true on Windows** — cmd.exe로 실행됨. Claude Code는 git-bash 필요
12. **문자열 리터럴 "C:\\\\path"** — env에 넣으면 이스케이프 풀림. path.join() 사용
13. **outputBuffer를 result.output으로** — 줄 파싱 후 잔여분만 남음. fullOutput 별도 누적 필요
14. **--output-format json for 대화** — 파싱 복잡. 대화는 text 모드로

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Director Agent = PD + PM 통합 | CLI 1회 호출로 판단. 분리하면 컨텍스트 전달 비용 증가 |
| 로컬 폴백 제거 | Claude CLI 없으면 동작 안 하는 게 맞음. 가짜 대화보다 정직한 에러 |
| 모든 요청 Director 경유 | 사소한 것도 AI가 판단해야 정확. regex는 짧은 입력만 처리 가능 |
| Orchestrator는 실행만 | 판단(Director)과 실행(Orchestrator) 분리. Orchestrator는 AI 호출 안 함 |
| text 모드 (Discovery) | JSON 파싱 오버헤드 없이 자연스러운 대화 |
| path.join for Windows 경로 | 백슬래시 이스케이핑 문제 근본 해결 |

## Files to Know

| File | Why |
|------|-----|
| `src/main/index.ts` | 앱 진입점 + 모든 IPC 핸들러 (가장 큰 파일) |
| `src/main/orchestrator/director-agent.ts` | **[NEW]** Director Agent (PD+PM+입력분석) |
| `src/main/orchestrator/smart-orchestrator.ts` | 실행 엔진 (Director가 결정, Orchestrator가 실행) |
| `src/main/orchestrator/pipeline.ts` | Planner→Generator→Evaluator 루프 |
| `src/main/agent-runner/cli-bridge.ts` | Claude Code CLI spawn (git-bash 경로 탐색) |
| `src/main/memory/plan-manager.ts` | **[NEW]** Plan 문서 자동 관리 |
| `src/main/memory/database.ts` | SQLite 스키마 v6 |
| `src/main/memory/memory-manager.ts` | 전체 CRUD + seedDefaultSkills |
| `src/renderer/App.tsx` | React 루트 (5탭: Dashboard/Project/Schedule/Presets/Settings) |
| `src/renderer/pages/ProjectView.tsx` | 프로젝트 상세 (7 서브탭) |
| `src/renderer/pages/SchedulePage.tsx` | **[NEW]** 캘린더/간트 차트 |
| `src/renderer/pages/PlanPage.tsx` | **[NEW]** 계획 문서 뷰 |
| `src/renderer/components/discovery/DiscoveryChat.tsx` | 대화형 Discovery (CLI 전용) |
| `src/shared/types.ts` | 전체 타입 정의 (Plan, Schedule 포함) |
| `resources/presets/` | **[NEW]** 5종 프리셋 YAML (각 5-6 에이전트) |
| `resources/skills/` | **[NEW]** 10종 스킬 JSON |
| `docs/00-pm/tool.prd.md` | PRD (PM 에이전트 팀 생성) |
| `docs/01-plan/features/tool.plan.md` | Plan v0.3 (P0 8항목) |
| `docs/02-design/features/tool.design.md` | Design v0.2 (기술 설계) |

## Resume Instructions

1. **환경 확인**:
   ```bash
   cd C:/GameMaking/Tool
   git pull
   npm install
   npx electron-rebuild -f -w better-sqlite3
   npm run dev
   ```

2. **가장 시급한 작업**: CLI 연동 E2E 테스트
   - Discovery Chat에서 AI 대화가 정상 동작하는지 확인
   - 스펙 카드 생성 → Review → Team Setup → 프로젝트 생성 전체 플로우
   - Chat에서 Director Agent가 모드를 올바르게 판단하는지

3. **그 다음**: P1 항목 (토큰 대시보드, 세션 복구 등)

## Setup

```bash
cd C:/GameMaking/Tool
npm install
npx electron-rebuild -f -w better-sqlite3  # 필수!
npm run dev                                 # 개발 모드
npm run package                             # Windows EXE 빌드
```

- Claude Code CLI 설치 필요 (`claude --version`)
- Windows: git-bash 필요 (Git for Windows 설치 시 포함)
- Node.js 18+
