# Handoff: WorkTool — AI Agent Team Management Desktop App

**Generated**: 2026-03-29
**Branch**: main
**Repo**: https://github.com/chodolmu/CJ-s-WorkTool.git
**Status**: In Progress — UI 완성, AI 엔진 E2E 미검증

## Goal

Claude Code CLI를 감싸는 Electron 데스크톱 앱. 비개발자/반개발자가 AI 에이전트 팀을 시각적으로 관리하며 프로젝트를 개발. 자연어 대화로 프로젝트를 정의하고 AI가 기획→코드생성→검증까지 자동 수행.

## Completed (Session 1 + 2)

### Core Architecture
- [x] Electron + React + Vite + Tailwind + SQLite
- [x] IPC 구조 (preload contextBridge, 40+ 핸들러)
- [x] SQLite 스키마 v4 (projects, features, agent_runs, activities, sessions, chat_messages, agent_learnings, project_skills)
- [x] MemoryManager 전체 CRUD
- [x] CLIBridge (Claude Code CLI spawn + stdout 파싱 + streaming)
- [x] PromptAssembler (6-layer 프롬프트 조립 + 학습 내용 주입)

### Navigation & UI
- [x] Dashboard (전체 프로젝트 카드/타임라인 뷰)
- [x] ProjectView (서브탭: 개요/채팅/에이전트/파이프라인/스펙/로그)
- [x] 대화형 Discovery (자유 대화 → AI 스펙 카드 생성 → 에이전트 팀 구성)
- [x] 채팅 UI (마크다운 렌더링, 코드 복사, 스트리밍, 3-Tier 모드 선택)
- [x] 오케스트레이션 시각화 (Planner→Generator→Evaluator 흐름도)
- [x] 전체 UI 한글화

### Smart Systems
- [x] 3-Tier 실행 모드 (Direct/Light/Full 자동 분류)
- [x] Smart Orchestrator (에이전트 라우팅 + 실행 계획 + 결과 전달)
- [x] Prompt Translator (자연어 → 구조화 프롬프트)
- [x] Decision Requester (에이전트가 사용자에게 질문)
- [x] Agent Learning (Evaluator 피드백 축적 → Generator 프롬프트 주입)
- [x] Auto-Skill Detection (반복 패턴 감지 → 스킬 등록)
- [x] 6단계 프로젝트 관리 (Research→Polish)
- [x] R&D Research Agent
- [x] Git Manager (고급 설정으로 숨김)

### Polish
- [x] Toast 알림, Framer Motion 애니메이션, 키보드 단축키
- [x] ErrorBoundary, skeleton 로딩
- [x] 다크/라이트 모드
- [x] 프로젝트별 workingDir + 에이전트 DB 영속화
- [x] Pipeline 시작 버튼
- [x] Chat 컨텍스트 연속성 (이전 대화 + 활동 히스토리)

## Not Yet Done

### P0 — E2E 검증 (가장 중요)
- [ ] Claude CLI가 설치된 환경에서 전체 플로우 E2E 테스트
- [ ] Discovery AI 대화가 실제로 좋은 스펙을 만드는지 확인
- [ ] Pipeline (Planner→Generator→Evaluator) 실제 코드 생성 테스트
- [ ] Chat Direct/Light/Full 모드별 실제 동작 확인
- [ ] Decision Requester가 실제 AI 출력에서 제대로 감지하는지

### P1 — 기능 완성
- [ ] Electron 네이티브 폴더 선택 다이얼로그 (현재 input 직접 입력)
- [ ] 에이전트 실행 중 실시간 사용자 개입 (중간에 방향 수정)
- [ ] 프로젝트간 에이전트 프리셋 공유
- [ ] PhaseTracker를 ProjectView에 실제 연결 (컴포넌트는 있지만 미와이어링)
- [ ] 앱 아이콘 디자인 (현재 16x16 placeholder)

### P2 — 확장
- [ ] 패키징 테스트 (`npm run package`)
- [ ] 더 많은 프리셋 (모바일, API, 데스크톱 앱 등)
- [ ] 에이전트 마켓플레이스 (공유 가능한 에이전트 정의)
- [ ] 프로젝트 export/import

## Failed Approaches (Don't Repeat)

1. **better-sqlite3 static import** — 반드시 `require()` 동적 로딩. electron-vite가 인라인하면 .node 경로 깨짐
2. **npm install 후 electron-rebuild 빼먹기** — NODE_MODULE_VERSION 불일치
3. **Tailwind v4** — electron-vite가 Vite 5만 지원, Tailwind v4는 Vite 6 필요 → v3 유지
4. **모든 .tsx에 `import React from "react"` 필요** — electron-vite 자동 JSX 변환 안 됨
5. **prompt() 사용** — Electron에서 지원 안 됨. input 직접 사용
6. **button 안에 button** — React DOM 경고. 외부를 div[role=button]으로
7. **SCHEMA_VERSION 업데이트 빼먹기** — v2로 두면 v3/v4 마이그레이션 안 돌아감

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite만 사용 | DB+파일 이중 저장 시 동기화 버그 위험 |
| Claude Code CLI 호출 (API 아닌) | 사용자의 Claude 구독으로 자동 인증 |
| 대화형 Discovery (선택지 아닌) | 사용자가 자연어로 말하는 게 더 자연스러움 |
| Dashboard→Project 서브탭 구조 | 다중 프로젝트 관리 + Chat은 프로젝트 내부 |
| 3-Tier 실행 모드 | 사소한 작업에 3에이전트 돌리면 토큰 낭비 |
| Git은 고급 설정으로 숨김 | AI가 코드를 다시 쓰지 git에서 꺼내지 않음 |
| 에이전트 팀 구성을 Discovery에 포함 | 프로젝트 특성에 맞는 에이전트 추천이 중요 |
| Decision Requester | 에이전트가 판단 필요 시 사용자에게 물어봐야 함 |

## Evaluator 판정 (Session 2 말미)

**UI: PASS** — 완성품 수준
**AI 엔진: UNTESTED** — 코드는 있으나 Claude CLI 연동 E2E 미검증
**예상 활용도**: 타로 프로젝트 대비 20~30% (P0 검증 + 반복 수정 플로우 추가 시 50~60% 예상)

## Files to Know

| File | Why |
|------|-----|
| `src/main/index.ts` | 앱 진입점 + 모든 IPC 핸들러 (가장 큰 파일) |
| `src/main/orchestrator/smart-orchestrator.ts` | 에이전트 라우팅 핵심 |
| `src/main/orchestrator/pipeline.ts` | Planner→Generator→Evaluator 루프 |
| `src/main/agent-runner/cli-bridge.ts` | Claude Code CLI spawn |
| `src/main/agent-runner/prompt-translator.ts` | 자연어 → 구조화 프롬프트 |
| `src/main/orchestrator/decision-requester.ts` | 에이전트→사용자 질문 |
| `src/main/memory/learning-manager.ts` | 에이전트 학습 |
| `src/renderer/App.tsx` | React 루트 (Dashboard/Project/Presets/Settings) |
| `src/renderer/pages/ProjectView.tsx` | 프로젝트 상세 (서브탭 6개) |
| `src/renderer/components/discovery/DiscoveryChat.tsx` | 대화형 Discovery |
| `src/renderer/stores/discovery-store.ts` | Discovery 상태 관리 |
| `src/shared/types.ts` | 전체 타입 정의 |

## Resume Instructions

1. **환경 확인**:
   ```bash
   cd C:/GameMaking/Tool
   git pull
   npm install
   npx electron-rebuild -f -w better-sqlite3
   npm run dev
   ```

2. **가장 시급한 작업**: Claude CLI 설치 환경에서 E2E 테스트
   - Discovery AI 대화 → 스펙 카드 생성 품질 확인
   - Chat에서 "로그인 페이지 만들어줘" → 실제 코드 생성 확인
   - Pipeline 시작 → Planner가 기능 분해 → Generator 코드 작성 → Evaluator 검증

3. **다음 우선순위**: P0 목록 (위 "Not Yet Done" 참조)

## Setup

```bash
cd C:/GameMaking/Tool
npm install
npx electron-rebuild -f -w better-sqlite3  # 필수!
npm run dev
```

- Claude Code 설치 필요 (`claude --version`)
- Node.js 18+
