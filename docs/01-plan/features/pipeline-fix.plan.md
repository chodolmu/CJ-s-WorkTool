# Plan: PipelineFix — 실사용 테스트 15개 이슈 수정

## Executive Summary

| 항목 | 내용 |
|---|---|
| Feature | PipelineFix (Session 6 실사용 피드백) |
| 시작일 | 2026-03-31 |
| 이슈 수 | 15개 → 5개 그룹으로 분류 |

### Value Delivered

| 관점 | 내용 |
|---|---|
| **Problem** | 파이프라인이 실제 실행 시 에이전트 상태 미표시, Evaluator 파싱 실패, 속도 저하, 사용자 소통 부재 등 15개 이슈 |
| **Solution** | agent_status 이벤트 타이밍 수정, Evaluator 프롬프트 강화, autoApprove 모드화, 팀 변경 허가 시스템 |
| **Function UX Effect** | 에이전트가 실제로 돌아가는 모습이 보이고, Evaluator가 안정적으로 검증하며, 사용자 허가 없이 팀 변경 불가 |
| **Core Value** | "빌드 통과 != 실제 동작" 문제 해결 — 코드가 아닌 동작을 기준으로 수정 |

---

## 근본 원인 분석 결과

### 이슈 → 근본 원인 매핑

| # | 사용자 피드백 | 근본 원인 | 파일:위치 | 심각도 |
|---|---|---|---|---|
| 1 | autoApprove를 모드로 | Settings에 있지만 눈에 안 띔 | SettingsPage.tsx | Low |
| 2 | 로그 과잉 | 필터가 있지만 기본값이 "전체" | ActivityFeed.tsx | Low |
| 3 | Evaluator가 bkit 전용 같음 | Evaluator 프롬프트에 JSON 형식 강제 부족 | prompt-assembler.ts:80 | **High** |
| 4 | 에이전트 running 안 보임 | `agent_status` emit이 runAgent() 내부에만 있고 feature loop 시작 시 없음 | pipeline.ts:329 | **High** |
| 5 | 단계별 계획 상세 없음 | OrchestrationPage에 step.description만 표시 | OrchestrationPage.tsx | Medium |
| 6 | 단계별 보고서 없음 | 미구현 | pipeline.ts | Medium |
| 7 | Director만 돌아감 | Planner/Generator/Evaluator에 대한 agent_status emit 누락 | pipeline.ts:110,251 | **High** |
| 8 | 속도 느림 | CLI spawn 순차 실행, 프로세스당 ~500ms 오버헤드 | cli-bridge.ts | Medium |
| 9 | Evaluator 첫 시도 파싱 실패 | 시스템 프롬프트에 JSON 강제 있지만 CLI가 무시할 수 있음 | pipeline.ts:636-666 | **High** |
| 10 | 3번만 재시도 | UI `buildFullPipeline()`에서 `maxRetries:3` 하드코딩 | OrchestrationPage.tsx:100,121 | Medium |
| 11 | 팀 변경 허가 없음 | `executeChatActions()`에서 즉시 실행, checkpoint 없음 | index.ts:1001-1045 | **High** |
| 12 | 작업 중 소통 안 함 | DecisionRequester 패턴이 너무 엄격 + feature loop에 미통합 | decision-requester.ts:69 | Medium |
| 13 | 스펙 불일치 시 수정 안 함 | reviewPlannerOutput()이 경고만 하고 자동 추가 안 함 | director-agent.ts:330-399 | Medium |
| 14 | 기능 할당 안 됨 | assignedAgent가 "generator" 하드코딩 | director-agent.ts:358 | Medium |
| 15 | Director 기타 분류 | Director에 agent_status 이벤트 없음 → queued 상태 유지 | pipeline.ts:69 | **High** |

---

## 5개 그룹 + 구현 순서

### Group A: 에이전트 상태 정상화 (이슈 4, 7, 15) — **최우선**

**문제**: `agent_status` 이벤트가 `runAgent()` 내부에만 있어서, CLI 프로세스가 spawn되기 전까지 에이전트 상태가 업데이트되지 않음. Director/Planner/Evaluator 전환이 UI에 반영 안 됨.

**수정 내용**:
1. `pipeline.ts` `run()` — Director 방향 수립 시작/완료에 `agent_status` emit
2. `pipeline.ts` `runDirectorAndPlanner()` — Planner 시작/완료에 `agent_status` emit
3. `pipeline.ts` `runFeatureLoop()` — Generator/Evaluator 각각 시작 전에 `agent_status` emit (현재 `runAgent()` 내부에만 있음 → 외부에서도 emit)
4. `pipeline.ts` `runPreStep()` — design/custom 에이전트에도 `agent_status` emit
5. `OrchestrationPage.tsx` — Director를 core 에이전트로 명시적 표시, "기타" 분류에서 제외 확인

**수정 파일**: `pipeline.ts` (+15줄), `OrchestrationPage.tsx` (확인)

---

### Group B: Evaluator 안정화 (이슈 3, 9, 10) — **높음**

**문제**: Evaluator가 JSON 형식을 따르지 않아 파싱 실패. `parseEvaluatorOutput()` 4단계 전략 중 마지막(텍스트 추론)으로 빠짐.

**수정 내용**:
1. `pipeline.ts` `buildAgentSystemPrompt("evaluator")` — 시스템 프롬프트에 **"반드시 JSON만 출력. 다른 텍스트 절대 금지"** 더 강하게 강조 + JSON 예시 반복
2. `pipeline.ts` `runAgent()` — Evaluator일 때 `outputFormat: "json"` 옵션 추가 (CLI의 `--output-format json` 플래그)
3. `parseEvaluatorOutput()` — 전략1 실패 시 재시도 로직: "JSON으로 다시 출력해줘" 프롬프트로 1회 추가 호출
4. `OrchestrationPage.tsx:100,121` — `maxRetries: 3` 하드코딩 → Settings에서 가져오기
5. `pipeline.ts` `PipelineConfig` — `retryUntilPass: boolean` 옵션 추가 (maxRetries 무시하고 통과까지)
6. `SettingsPage.tsx` — "통과할 때까지 재시도" 토글 추가

**수정 파일**: `pipeline.ts` (+30줄), `OrchestrationPage.tsx` (+5줄), `SettingsPage.tsx` (+10줄), `types.ts` (+1줄)

---

### Group C: 사용자 소통/허가 (이슈 1, 11, 12, 13) — **높음**

**문제**: 팀 변경이 무허가, 불명확 사항에 소통 없음, 스펙 불일치 시 경고만.

**수정 내용**:
1. `index.ts` `executeChatActions()` — `add_agent`/`remove_agent` 전에 checkpoint 요청
2. `pipeline.ts` feature loop — Generator 출력에서 DecisionRequester 호출 통합 (현재 SmartOrchestrator에만 있음)
3. `decision-requester.ts` — 패턴 완화: `?` 없이도 "확인", "선택", "결정" 키워드만으로 감지
4. `director-agent.ts` `reviewPlannerOutput()` — missingFromSpec이 있으면 자동으로 features에 추가하고 checkpoint로 사용자 확인
5. `SettingsPage.tsx` — autoApprove 토글을 "자동 진행 모드"로 이름 변경 + 더 눈에 띄게 배치

**수정 파일**: `index.ts` (+20줄), `pipeline.ts` (+10줄), `decision-requester.ts` (+10줄), `director-agent.ts` (+15줄), `SettingsPage.tsx` (+5줄)

---

### Group D: UI/UX 개선 (이슈 2, 5, 6) — **보통**

**수정 내용**:
1. `ActivityFeed.tsx` — 기본 필터를 "중요만"으로 변경 (현재 "전체")
2. `OrchestrationPage.tsx` — 각 step에 description 뿐만 아니라 진행 상태, 예상 시간, 에이전트 역할 표시
3. `OrchestrationPage.tsx` — 단계 완료 시 간단한 보고서 (변경 파일 수, 소요 시간) 인라인 표시

**수정 파일**: `ActivityFeed.tsx` (+3줄), `OrchestrationPage.tsx` (+30줄)

---

### Group E: 성능/기능 할당 (이슈 8, 14) — **낮음**

**수정 내용**:
1. `cli-bridge.ts` — 속도 개선은 근본적 한계 (CLI spawn 구조). 당장은 불필요한 대기 제거로 완화
2. `director-agent.ts` — assignedAgent를 feature 특성에 따라 동적 할당 (현재 "generator" 하드코딩)

**수정 파일**: `cli-bridge.ts` (+5줄), `director-agent.ts` (+10줄)

---

## 구현 순서

```
Group A: 에이전트 상태 정상화     ← 가장 눈에 보이는 문제
   ↓
Group B: Evaluator 안정화        ← 파이프라인 핵심 기능
   ↓
Group C: 사용자 소통/허가        ← 신뢰도 문제
   ↓
Group D: UI/UX 개선              ← 체감 품질
   ↓
Group E: 성능/기능 할당          ← 장기 개선
```

---

## 성공 기준

| 기준 | 측정 방법 |
|---|---|
| 에이전트가 실행 시 초록 pulse 표시 | 파이프라인 실행 시 AgentCard 확인 |
| Generator/Evaluator가 각각 running으로 전환 | 파이프라인 feature loop 중 확인 |
| Evaluator 첫 시도 파싱 성공률 80%+ | 5회 실행 중 4회 이상 JSON 파싱 성공 |
| 에이전트 추가/제거 시 확인 팝업 | 채팅에서 에이전트 수정 시도 시 확인 |
| autoApprove 모드 토글 가능 | Settings에서 확인 |
