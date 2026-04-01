# Plan: UX Enhancement — 선제적 가이드 + 비용 최적화 + 대시보드 강화

## Executive Summary

| 항목 | 내용 |
|---|---|
| Feature | UX Enhancement v1 |
| 시작일 | 2026-03-30 |
| 기능 수 | 4개 (Phase Coach, Smart Input, Worker Agent, Dashboard) |

### Value Delivered

| 관점 | 내용 |
|---|---|
| **Problem** | 파이프라인 실행 후 사용자가 "다음에 뭘 해야 하지?" 상태에 빠짐. 간단한 작업에도 Opus 비용 발생. 에이전트 실행 상태가 UI에 반영 안 됨 |
| **Solution** | Phase별 개입 수준을 나눠 초반엔 가이드, 후반엔 자동 실행. Sonnet Worker로 비용 절감. 실시간 에이전트 상태 반영 |
| **Function UX Effect** | 비전문가도 "다음 뭐 하지?"를 느끼지 않음. 에이전트가 살아있는 느낌 (초록 pulse) |
| **Core Value** | 비개발자/AI 비전문가가 이 툴만으로 방대한 프로젝트를 끝까지 완성할 수 있는 환경 |

---

## 1. 배경 및 동기

### 1-1. Harness Tool 분석에서 얻은 인사이트

Harness Tool(게임 기획 워크플로우 툴)은 **SKILL.md + formDef + YAML 워크플로우**로 사용자를 단계별로 안내한다. 기술적으로는 틀에 박힌 접근이지만, **"사용자를 절대 놓치지 않는 UX"**가 핵심 강점:

- 매 단계마다 채팅이 먼저 "지금 이걸 해주세요"라고 말함
- 구조화된 폼으로 필요한 입력을 명확하게 수집
- 사용자가 "다음에 뭘 해야 하지?"를 느끼지 않음

### 1-2. WorkTool 현재 상태의 약점

| 영역 | 현재 | 문제 |
|---|---|---|
| **가이드** | Discovery까지만 안내 | 파이프라인 시작 후 사용자 방치 |
| **입력 수집** | 자유 채팅으로만 | "뭘 말해야 하지?" 상태 |
| **비용** | Director(Opus)가 간단한 일도 처리 | 불필요한 비용 발생 |
| **대시보드** | 완료/대기만 표시 | 에이전트가 "살아있는" 느낌 없음 |

### 1-3. 설계 원칙

> **"앞에서 잘 잡으면, 뒤에서 안 물어본다"**

- 모든 Phase에 가이드가 필요한 게 아님
- 초반(Discovery~Design)에 핵심 결정을 잘 잡으면 이후는 자동 실행
- 사용자 개입이 필요한 곳에만 구조화된 입력 수집

---

## 2. 기능 목록

### Feature 1: Phase Coach (선제적 가이드 시스템)

**목적**: 각 Phase 전환 시 채팅이 먼저 사용자에게 말을 걸어 "지금 뭘 해야 하는지" 안내

**구간별 개입 수준 (Touch Level)**:

| 구간 | Touch Level | 채팅 동작 | 사용자 행동 |
|---|---|---|---|
| Discovery | High Touch | 이미 구현됨 | 질문 응답, 스펙 확인 |
| Planning (Planner 완료 후) | High Touch | "N개 기능으로 나눴어요. 우선순위 확인해주세요" | 기능 목록 검토/수정 |
| Design (설계 단계) | Medium Touch | "핵심 설계 결정 2-3개만 확인할게요" | 핵심 결정만 확인 |
| Implement (구현) | Autopilot | "구현 시작합니다. 진행률만 보여드릴게요" | 지켜보기 |
| Test/Eval (검증) | Autopilot | 문제 발생 시에만 알림 | 개입 불필요 |
| Polish (완료) | Light Touch | "결과물 확인해주세요. 수정할 곳 있나요?" | 최종 확인 |

**구현 범위**:
- Phase 전환 감지 → 자동 가이드 메시지 생성
- Touch Level에 따라 체크포인트 자동 삽입 / 스킵
- `pipeline.ts`에 Phase Coach 로직 추가
- 가이드 메시지 템플릿 (Phase별 맥락에 맞는 메시지)

**수정 파일**:
- `src/main/orchestrator/pipeline.ts` — Phase 전환 시 Coach 메시지 emit
- `src/shared/types.ts` — `TouchLevel` 타입, `PhaseCoachMessage` 인터페이스
- `src/renderer/pages/ChatPage.tsx` — Coach 메시지 렌더링 (시스템 메시지 스타일)
- `src/renderer/components/PhaseCoachBanner.tsx` — (신규) 현재 Phase + 안내 배너

---

### Feature 2: Smart Input (구조화된 사용자 입력)

**목적**: High Touch 구간에서 자유 채팅 대신 구조화된 질문/선택지를 제공하여 입력 품질 향상

**핵심 차별점 (vs Harness Tool)**:
- Harness: YAML formDef로 고정된 폼 → 틀에 박힌 결과
- **WorkTool: Director AI가 상황에 맞게 동적으로 질문 생성** → 창발적 결과

**동작 방식**:
1. Phase Coach가 "입력 필요" 판단
2. Director가 현재 맥락(스펙, 진행 상태)을 보고 질문 2-4개 생성
3. UI에 선택지 + 자유 입력 혼합 폼으로 표시
4. 사용자 응답 수집 → 파이프라인에 주입

**적용 시점** (Touch Level이 High/Medium인 곳만):
- Planning 완료 → "이 기능들 맞나요?" (기능 목록 + 우선순위 조정)
- Design 단계 → "DB 구조는 이렇게, 맞나요?" (핵심 결정 확인)
- Polish 단계 → "이 부분 수정할까요?" (결과물 리뷰)

**Autopilot 구간에서는 Smart Input 없음** — 자동으로 진행

**수정 파일**:
- `src/main/orchestrator/director-agent.ts` — `generateSmartQuestions()` 메서드 추가
- `src/shared/types.ts` — `SmartQuestion`, `SmartInputRequest` 인터페이스
- `src/renderer/components/SmartInputForm.tsx` — (신규) 동적 질문 폼 컴포넌트
- `src/renderer/pages/ChatPage.tsx` — SmartInput 폼 렌더링 통합
- `src/preload/index.ts` — `smart-input:respond` IPC 핸들러

---

### Feature 3: Worker Agent (Sonnet 실행 에이전트)

**목적**: Director(Opus)가 판단만 하고, 실제 실행은 저렴한 Sonnet Worker가 담당

**현재 문제**:
```
Director(Opus) → handleRequest() → mode: "direct"
  → Generator(모델 가변)에게 넘김
  → 간단한 일에도 비싼 모델 사용 가능
```

**개선 구조**:
```
Director(Opus) → handleRequest() → 복잡도 판단
  ├─ hard  → 기존 파이프라인 (Planner → Generator → Evaluator)
  ├─ medium → Worker(Sonnet) + Evaluator(Sonnet)
  └─ easy  → Worker(Sonnet) 단독
```

**Worker Agent 정의**:
- id: `worker`
- model: `sonnet`
- role: "범용 실행 에이전트"
- 처리 범위: Director가 `direct` 또는 `light`로 분류한 작업
- Director는 작업 지시만 내리고, Worker가 실행

**비용 절감 예상**:
- Opus vs Sonnet: ~5배 비용 차이
- 전체 요청 중 direct+light가 ~60-70% 추정
- 예상 비용 절감: 40-50%

**수정 파일**:
- `src/main/orchestrator/director-agent.ts` — direct/light 모드에서 Worker로 라우팅
- `src/main/orchestrator/pipeline.ts` — Worker Agent 실행 로직
- `src/main/orchestrator/smart-orchestrator.ts` — Worker 스텝 처리
- `resources/presets/*/agents/worker.yaml` — (신규) Worker 에이전트 정의
- `src/shared/types.ts` — AgentDefinition에 Worker 관련 확장

---

### Feature 4: Dashboard 강화 (실시간 에이전트 상태)

**목적**: 에이전트가 실제로 "돌아가고 있다"는 걸 시각적으로 보여줌

**현재 문제**:
- `StatusDot.tsx`에 `running` 상태(초록, pulse)가 정의되어 있음
- 하지만 실제 파이프라인에서 에이전트 `running` 이벤트가 UI로 제대로 전달되지 않음
- 결과적으로 "완료"와 "대기" 상태만 보임

**수정 내용**:

1. **에이전트 상태 흐름 정상화**:
   - `pipeline.ts` / `smart-orchestrator.ts`에서 에이전트 실행 시작 시 `agent:status → running` 이벤트 emit
   - 실행 완료 시 `agent:status → completed` emit
   - `useIpcEvents.ts`에서 해당 이벤트 수신 → `updateAgentStatus()` 호출

2. **상태 세분화**:
   ```
   현재: queued → running → completed/failed
   개선: queued → running(thinking) → running(tool_call) → completed/failed
   ```
   - `running` 상태 내에서 세부 상태 (thinking/tool_call) 표시
   - AgentCard에 현재 하고 있는 작업 실시간 표시

3. **파이프라인 진행 상태 강화**:
   - 현재 실행 중인 Step 하이라이트
   - 예상 완료 시간 (기능 수 기반 추정)
   - 전체 진행률 바 개선

**수정 파일**:
- `src/main/orchestrator/pipeline.ts` — 에이전트 시작/완료 시 status 이벤트 emit
- `src/main/orchestrator/smart-orchestrator.ts` — 동일
- `src/main/index.ts` — IPC broadcast 보완
- `src/renderer/hooks/useIpcEvents.ts` — agent:status 이벤트 수신 강화
- `src/renderer/components/AgentCard.tsx` — running 세부 상태 표시
- `src/renderer/components/StatusDot.tsx` — thinking/tool_call 세부 인디케이터
- `src/renderer/pages/OrchestrationPage.tsx` — 활성 Step 하이라이트

---

## 3. 구현 순서

```
Phase 1: Dashboard 강화 (Feature 4)           ← 가장 빠르게 체감, 기존 코드 수정
   ↓
Phase 2: Worker Agent (Feature 3)             ← 비용 구조 개선, 독립적
   ↓
Phase 3: Phase Coach (Feature 1)              ← Phase 전환 가이드 시스템
   ↓
Phase 4: Smart Input (Feature 2)              ← Phase Coach 위에 구축
```

**이유**:
- Dashboard는 이미 인프라가 있고 이벤트만 연결하면 됨 → 빠른 성과
- Worker Agent는 독립적이라 다른 기능에 영향 없이 추가 가능
- Phase Coach가 Smart Input의 기반이 되므로 순서 중요

---

## 4. 에이전트 팀 구성

| 에이전트 | 역할 | Feature |
|---|---|---|
| Director (Opus) | 복잡한 판단 + 방향 수립만 | F3 이후 역할 축소 |
| **Worker (Sonnet)** | **direct/light 작업 실행** | **F3에서 신규 추가** |
| Planner (Sonnet) | 기능 분해 (기존) | 변경 없음 |
| Generator (Sonnet) | 코드 생성 (기존, full 모드에서만) | 변경 없음 |
| Evaluator (Sonnet) | 검증 (기존) | 변경 없음 |

---

## 5. 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| Phase Coach 메시지가 방해될 수 있음 | UX 저하 | Autopilot 구간에서는 최소 알림만. 사용자가 Touch Level 조절 가능하도록 |
| Worker가 복잡한 작업을 못 처리 | 품질 저하 | Director의 복잡도 판단을 보수적으로 — 의심되면 기존 파이프라인 사용 |
| Smart Input 질문 품질이 불안정 | 입력 품질 저하 | 기본 질문 템플릿 + AI 동적 생성 혼합 |
| 에이전트 상태 이벤트 누락 | 대시보드 부정확 | 타임아웃 기반 폴백 — N초 이상 이벤트 없으면 상태 확인 |

---

## 6. 성공 기준

| 기준 | 측정 방법 |
|---|---|
| 에이전트 running 상태가 실시간 반영 | 파이프라인 실행 시 초록 pulse 확인 |
| direct/light 작업에서 Worker(Sonnet) 사용 | 로그에서 모델 확인 |
| Phase 전환 시 가이드 메시지 자동 표시 | Discovery→Plan→Design 진행 시 확인 |
| High Touch 구간에서 구조화된 입력 폼 표시 | Planning 완료 후 Smart Input 확인 |
| Autopilot 구간에서 불필요한 질문 없음 | Implement~Test 구간에서 자동 진행 확인 |
