# Handoff: WorkTool — 15개 파이프라인 이슈 수정

**Generated**: 2026-03-30 (Session 4)
**Branch**: main
**Repo**: https://github.com/chodolmu/CJ-s-WorkTool.git
**Status**: In Progress — P0 이슈 수정 대기

## Goal

Claude Code CLI를 감싸는 Electron 데스크톱 앱. 비개발자/반개발자가 AI 에이전트 팀을 시각적으로 관리하며 프로젝트를 개발. **이번 세션에서 CLI 연동 성공 + 동적 파이프라인 구현했으나, 실제 테스트에서 15개 이슈 발견.**

## Completed (이번 세션)

### CLI 연동 수정
- [x] CLIBridge: npm cli.js 우선 (WinGet 2.1.70 → npm 2.1.87)
- [x] `process.execPath` 버그 수정 (Electron이 아닌 시스템 node 사용)
- [x] 상세 디버그 로깅 (console.log + 파일)
- [x] Discovery 채팅 정상 동작 확인

### Discovery 시스템 프롬프트 강화
- [x] 체크리스트 기반 (80% 이상 채워질 때까지)
- [x] 프로젝트 유형별 상세 항목 (게임/웹앱/모바일/API)
- [x] directorHints JSON 출력 (domainContext, reviewFocus, suggestedPhases)

### 동적 파이프라인 구조
- [x] `DynamicPipeline`, `PipelineStep`, `DirectorHints` 타입 추가
- [x] Director.buildDynamicPipeline() — specCard 기반 로컬 로직 (토큰 0)
- [x] Pipeline.run() 리팩터링 — pre-steps → feature 루프
- [x] 옵셔널 에이전트 키워드 매칭 (selectOptionalAgents)
- [x] OrchestrationPage 동적 렌더링

### 채팅 시스템 개편
- [x] SmartOrchestrator 경유 → 직접 Claude 대화로 교체
- [x] 채팅 액션 시스템 (```worktool-action JSON → 에이전트 추가/제거/기능 추가)
- [x] 파이프라인 실행 중 채팅 차단

### 버그 7개 수정
- [x] 액션 블록이 bkit regex에 삭제됨 → 추출 순서 변경
- [x] 커스텀 에이전트가 파이프라인에 안 들어감 → getAgents() builtin+custom 합산
- [x] goal이 role을 복사 → action.goal ?? action.role
- [x] after_evaluator 트리거 누락 → OrchestrationPage 포함
- [x] projectId null 체크 추가
- [x] 모든 에이전트 CLI 호출에 [OVERRIDE] 시스템 프롬프트 추가

### 기타
- [x] 설정 페이지에 E2E 감사 버튼 추가 (system:run-audit)
- [x] 이벤트 리스너 누적 방지 (off→on 패턴)

## Not Yet Done — 15개 이슈 (우선순위별)

### P0: 파이프라인이 한 바퀴도 못 도는 문제

- [ ] **이슈 9: Evaluator 첫 시도마다 파싱 오류** — "검증 결과를 해석할 수 없습니다" 출력. `parseEvaluatorOutput()`이 JSON 못 찾음. 원인: Evaluator 시스템 프롬프트가 JSON 출력 형식을 강제하지 않거나, bkit이 응답 오염.
  - 파일: `src/main/orchestrator/pipeline.ts` parseEvaluatorOutput()
  - 파일: `src/main/orchestrator/pipeline.ts` runAgent()의 systemPrompt

- [ ] **이슈 3: Evaluator가 bkit gap analysis만 수행** — 실제 코드 검증이 아닌 bkit 틀의 gap analysis를 함. `[OVERRIDE]` 시스템 프롬프트가 추가되었지만 여전히 부족한 듯.
  - 수정 방향: Evaluator 전용 시스템 프롬프트를 상세하게 작성 (JSON 출력 형식, 검증 기준, verdict/score/findings 필수 등)

- [ ] **이슈 7: 파이프라인 UI 여전히 기획→구현→검증 3단계** — buildFullPipeline()이 에이전트 trigger를 못 읽거나, agents 배열이 비어있음.
  - 디버그: OrchestrationPage에서 agents 배열을 console.log해서 trigger 값 확인 필요
  - 가능한 원인: DB에 저장된 기존 프로젝트의 selectedAgents에 trigger 필드 없음 → inferTrigger() 추가했지만 미검증

- [ ] **이슈 15: Director가 기타 에이전트로 분류** — buildFullPipeline()에서 director는 첫 번째 step으로 추가되지만, UI의 "기타 에이전트" 섹션 필터링이 pipelineAgentIds에 director가 포함되지 않을 수 있음.

### P1: 사용성 핵심

- [ ] **이슈 1: 체크포인트 자동 스킵 모드** — 매 기능마다 "다음으로 넘어갈까요?" 확인 요구. 자동 진행 모드 필요.
  - 구현: PipelineConfig에 `autoApprove: boolean` 추가, requestCheckpoint()에서 autoApprove면 즉시 resolve

- [ ] **이슈 8: 속도 느림** — 토큰 소모 적은데 시간 오래 걸림.
  - 가능한 원인: CLI spawn 오버헤드 (매 에이전트마다 claude.exe 새로 시작), 시스템 프롬프트 파일 생성/삭제 비용
  - 수정 방향: 타임아웃 최적화, 불필요한 CLI 호출 제거, 로그 확인

- [ ] **이슈 10: 시도 3회 제한** — 통과할 때까지 돌려야 함 (하네스 취지). 단, 무한 루프 방지를 위해 상한은 필요.
  - 수정: maxRetries를 설정에서 조절 가능하게, 기본값 10으로 올리기

### P2: UX 개선

- [ ] **이슈 4: 활동중 에이전트 안 보임** — done/대기만 표시. running 상태가 UI에 안 반영됨.
  - 원인: agent:activity 이벤트에서 "starting" 키워드로 running 설정하지만, 실제 로그에 "starting"이 안 들어올 수 있음

- [ ] **이슈 14: 기능 할당 미작동** — OrchestrationPage의 features 배열이 비어있거나 업데이트 안 됨.

- [ ] **이슈 11: 에이전트 무단 변경** — 채팅에서 에이전트 추가 요청 시 AI가 다른 에이전트를 마음대로 제거. 사용자 확인 필요.
  - 수정: remove_agent 액션 실행 전 사용자 확인 UI 추가, 또는 시스템 프롬프트에 "기존 에이전트 제거 금지" 규칙

- [ ] **이슈 12: 작업 중 소통 없음** — 불명확한 부분에 대해 사용자에게 안 물어봄.
  - 수정: Generator/Evaluator 시스템 프롬프트에 "불명확한 부분은 체크포인트로 질문" 규칙

- [ ] **이슈 13: 스펙 누락 표시만** — Plan에서 "스펙 일치도 0%, 누락 가능" 표시하지만 수정 안 함.
  - 수정: Director.reviewPlannerOutput()에서 누락 항목을 자동 추가하거나, 사용자에게 알림

### P3: 완성도

- [ ] **이슈 2: 로그 과다** — bkit 출력, thinking, 불필요한 상세가 전부 보임.
  - 수정: ActivityFeed에 필터 (error/system만 보기, 전체 보기 토글)

- [ ] **이슈 5: 단계별 상세 없음** — 제목만 보이고 뭘 하는지 안 알려줌.
  - 수정: PipelineStep.description을 UI에 표시, 각 단계 완료 시 요약 emit

- [ ] **이슈 6: 단계별 보고서 없음** — 각 단계 완료 후 뭘 했는지 보고서.
  - 수정: 각 에이전트 실행 결과를 구조화하여 PlanManager에 저장 + UI에 표시

## Failed Approaches (Don't Repeat These)

### 이전 세션에서 (Session 1-3)
1. **better-sqlite3 static import** — require() 동적 로딩 필수
2. **Tailwind v4** — Vite 5만 지원, v3 유지
3. **spawn + shell:true + 한국어** — cmd.exe가 인코딩 깨뜨림
4. **--bare 플래그** — OAuth 인증 깨짐
5. **--system-prompt 인자** — 특수문자 깨짐, --system-prompt-file 사용
6. **stdin으로 프롬프트** — --print가 stdin 무시
7. **--continue/--resume** — Windows에서 타임아웃
8. **regex 기반 대화 폴백** — 패턴화된 가짜 대화는 불쾌한 경험
9. **PromptTranslator/TaskRouter (regex)** — Director AI 판단이 더 정확

### 이번 세션에서 (Session 4)
10. **WinGet claude.exe 우선 사용** — 버전 2.1.70으로 오래됨. npm cli.js (2.1.87) 우선으로 변경
11. **process.execPath로 node 실행** — Electron에서는 electron.exe를 가리킴. findNodeExe() 별도 구현
12. **SmartOrchestrator로 채팅 처리** — "Done (direct mode)" 출력. Discovery 방식 직접 대화로 교체
13. **systemPrompt 없이 에이전트 CLI 호출** — bkit이 응답 오염. 모든 호출에 [OVERRIDE] 필수
14. **harness-100 에이전트 내장** — 호환 안 됨 + 토큰 낭비. Discovery directorHints + 동적 프리셋이 더 효율적
15. **정적 프리셋 확장 (15종)** — 동적 생성이 압도적으로 나음

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Discovery에서 directorHints 동적 생성 | 프리셋 100개 내장보다 프로젝트에 100% 맞춤 |
| Director.buildDynamicPipeline() 로컬 로직 | CLI 호출 없이 토큰 0으로 파이프라인 구성 |
| 채팅 = 직접 대화, 파이프라인 = 에이전트 자동화 | 분리해야 각자 역할에 충실 |
| 채팅 액션 시스템 (worktool-action JSON) | 대화 중 자연스럽게 시스템 변경 가능 |
| 옵셔널 에이전트 키워드 매칭 | Director가 기능별로 필요한 에이전트만 투입 (토큰 절약) |
| npm cli.js 우선, WinGet 폴백 | npm이 항상 최신, WinGet은 업데이트 느림 |

## Current State

**Working**:
- Discovery 채팅 (한국어, 체크리스트 기반, directorHints 포함)
- 프로젝트 CRUD (DB 저장/로드)
- 설정 페이지 + E2E 감사 버튼
- CLI spawn (npm cli.js + 시스템 프롬프트 파일)

**Broken/Unverified**:
- 채팅 대화 (직접 대화로 교체했지만 미검증)
- 채팅 액션 시스템 (에이전트 추가 등 미검증)
- 파이프라인 실행 (Evaluator 파싱 실패, 15개 이슈)
- 파이프라인 UI (3단계 고정 문제)
- 기능 할당 표시

**Uncommitted**: 17개 파일 변경, 1604줄 추가. 커밋 안 됨.

## Files to Know

| File | Why |
|------|-----|
| `src/main/agent-runner/cli-bridge.ts` | CLI spawn 핵심. findClaudeExe(), findNodeExe(), 디버그 로그 |
| `src/main/index.ts` | IPC 핸들러 전부. discovery:chat, chat:send, pipeline:start, system:run-audit, executeChatActions() |
| `src/main/orchestrator/director-agent.ts` | Director Agent. buildDynamicPipeline(), handleRequest(), establishDirection() |
| `src/main/orchestrator/pipeline.ts` | Pipeline 실행. run(), runFeatureLoop(), selectOptionalAgents(), runPreStep() |
| `src/main/preset/preset-manager.ts` | getAgents()가 builtin+custom 합산하도록 수정됨 |
| `src/renderer/pages/OrchestrationPage.tsx` | 동적 파이프라인 UI. buildFullPipeline(), inferTrigger() |
| `src/renderer/stores/app-store.ts` | pipeline.steps, activeStepId, completedStepIds 추가됨 |
| `src/renderer/hooks/useIpcEvents.ts` | pipeline:configured, step-started, agents:updated 등 신규 이벤트 |
| `src/shared/types.ts` | DirectorHints, PipelineStep, DynamicPipeline 타입 |
| `src/renderer/pages/SettingsPage.tsx` | AuditSection 감사 UI |
| `test-audit.js` | DevTools Console용 E2E 테스트 스크립트 (별도 파일) |

## Code Context

### Evaluator 출력 파서 (파싱 실패의 핵심)
```typescript
// src/main/orchestrator/pipeline.ts — parseEvaluatorOutput()
private parseEvaluatorOutput(output: string): {
  verdict: "pass" | "fail";
  score: number;
  findings: { severity: string; message: string; summaryForUser: string }[];
  summaryForUser: string;
  retryInstructions?: string;
} {
  // JSON에서 "verdict" 키를 찾음 — 못 찾으면 fail + "검증 결과를 해석할 수 없습니다"
  const jsonMatch = output.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
  // ...
}
```

### 채팅 액션 시스템
```typescript
// src/main/index.ts — 시스템 프롬프트 내 규칙
// Claude가 ```worktool-action JSON을 출력하면 자동 실행
// 지원: add_agent, remove_agent, add_feature, start_pipeline, update_spec

// 추출 순서: rawOutput에서 먼저 추출 → bkit 정리 → 사용자에게 표시
const actionMatch = rawOutput.match(/```worktool-action\s*([\s\S]*?)```/);
```

### 동적 파이프라인 구성
```typescript
// src/main/orchestrator/director-agent.ts — buildDynamicPipeline()
// specCard.directorHints.suggestedPhases를 기반으로 steps 생성
// CLI 호출 없음 (토큰 0)
// 결과: { steps: PipelineStep[], generateStepId, evaluateStepId }
```

### 옵셔널 에이전트 선택 (키워드 매칭)
```typescript
// src/main/orchestrator/pipeline.ts — shouldRunAgent()
// 기능 이름+설명에서 키워드 매칭으로 에이전트 투입 결정
// 예: "밸런스|난이도|보상" → Balance Tester 투입
// 예: "스토리|대사|NPC" → Story Writer 투입
```

## Resume Instructions

### P0 이슈부터 순서대로:

1. **이슈 9+3 (Evaluator 수정)**:
   - `src/main/orchestrator/pipeline.ts`의 runAgent() systemPrompt를 에이전트별로 상세화
   - 특히 Evaluator: JSON 출력 형식을 강제하는 프롬프트 작성
   - 예상: `{"verdict":"pass|fail","score":0-100,"findings":[...],"summaryForUser":"..."}` 형식으로 출력
   - 실패 시: parseEvaluatorOutput()의 regex를 완화하거나, JSON 외 형식도 파싱

2. **이슈 7+15 (파이프라인 UI)**:
   - EXE에서 DevTools 열고 OrchestrationPage의 agents 배열 확인
   - `agents.map(a => ({id: a.id, trigger: a.trigger}))` 로그
   - trigger가 undefined면 App.tsx에서 initAgents 호출 시 trigger 전달 확인
   - Director가 "기타"에 가는 건 buildFullPipeline에서 첫 step으로 추가되는지 확인

3. **이슈 1 (자동 스킵 모드)**:
   - PipelineConfig에 `autoApprove: boolean` 추가
   - requestCheckpoint()에서 autoApprove면 즉시 "approve" resolve
   - 설정 UI에 토글 추가

4. **이슈 10 (재시도 횟수)**:
   - PipelineConfig.maxRetries 기본값을 10으로, 설정에서 조절 가능
   - "통과할 때까지" 옵션도 추가 (maxRetries = Infinity with 안전 상한 20)

5. **나머지 P2/P3**: 위 P0/P1 해결 후 진행

### 검증:
- 설정 → "감사 실행" 버튼으로 E2E 테스트
- 또는 `test-audit.js`를 DevTools Console에서 실행 (allow pasting 필요)

## Setup

```bash
cd C:/GameMaking/Tool
npm install
npx electron-rebuild -f -w better-sqlite3
npm run dev      # 개발 모드
npm run package  # EXE 빌드 (dist/WorkTool Setup 0.1.0.exe)
```

## Warnings

- **이 터미널에서 claude --print 테스트 불가** — 중첩 세션 제한. EXE로만 테스트
- **이 터미널에서 better-sqlite3 테스트 불가** — Electron용 빌드라 Node 버전 불일치
- **bkit이 모든 CLI 응답에 끼어듦** — 반드시 `[OVERRIDE]` 시스템 프롬프트 사용. systemPrompt: undefined 금지
- **커밋 안 됨** — 17개 파일 변경, 1604줄. 커밋 필요
- **에이전트 프롬프트가 거의 비어있음** — role/goal만 있고 실제 작업 지시/출력 형식 없음. 이게 대부분 문제의 근본 원인
