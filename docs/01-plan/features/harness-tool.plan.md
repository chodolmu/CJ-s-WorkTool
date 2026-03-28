# Agent Harness Desktop Tool Planning Document

> **Summary**: Claude Code를 감싸는 데스크톱 하네스 도구 — Discovery부터 자동 오케스트레이션, 시각적 에이전트 관리까지
>
> **Project**: Agent Harness Tool
> **Version**: 0.1.0
> **Author**: User + Claude
> **Date**: 2026-03-28
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | Claude Code를 CMD에서 사용할 때 에이전트 가시성 부재, 지침 드리프트, 장기 프로젝트 기억 손실, PM 부재, 멀티에이전트 관리 어려움이 발생 |
| **Solution** | Electron 데스크톱 앱으로 Claude Code를 감싸서 Discovery → 자동 오케스트레이션 → 시각적 대시보드 → Evaluator 루프를 제공 |
| **Function/UX Effect** | 비개발자도 에이전트를 "직원"처럼 시각적으로 관리하며, 선택지 기반 질문으로 모호한 아이디어를 구체적 스펙으로 변환 |
| **Core Value** | 하네스 엔지니어링을 문서 레벨에서 소프트웨어 레벨로 격상 — CMD 없이 AI 에이전트 팀을 운영 |

---

## 1. Overview

### 1.1 Purpose

tarrot 프로젝트에서 경험한 5가지 문제를 해결하는 데스크톱 도구:

1. **에이전트 가시성 부재** — CMD에서 누가 뭘 하는지 안 보임
2. **에이전트 드리프트** — 지침을 잊고 멋대로 행동
3. **장기 프로젝트 기억 손실** — 사용자도 AI도 맥락을 잃음
4. **PM 부재** — 프로젝트 전체 맥락을 유지하는 주체가 없음
5. **CMD 한계** — 비시각적, 멀티에이전트 관리 어려움

### 1.2 Background

- Anthropic의 하네스 엔지니어링 (2026.03) — Planner/Generator/Evaluator 3에이전트 아키텍처
- tarrot 프로젝트에서의 멀티에이전트 팀 운영 경험 (알파~제타 7역할)
- 기존 도구(Cursor, Devin, CrewAI 등)에서 "Discovery→자동 오케스트레이션→시각적 관리"를 하나로 묶은 도구가 없음

### 1.3 Related Documents

- R&D: `RND_HARNESS_TOOL.md`
- 참고: tarrot 프로젝트 `CLAUDE.md`, `teammate.md`, `PROJECT_GUIDELINES.md`
- 참고: [Anthropic Harness Design](https://www.anthropic.com/engineering/harness-design-long-running-apps)

---

## 2. Scope

### 2.1 In Scope

- [x] Discovery 플로우 (선택지 기반 질문 → 스펙 카드)
- [x] Planner/Generator/Evaluator 3에이전트 자동 오케스트레이션
- [x] 에이전트 상태 대시보드 (실시간 모니터링)
- [x] 활동 타임라인 (실시간 로그)
- [x] 3단계 기억 시스템 (Guidelines / Project State / Session Logs)
- [x] 지침 자동 주입 (모듈식 프롬프트 조립)
- [x] Evaluator 루프 (빌드 검증 → 재작업)
- [x] 변경 요약 (비전공자 언어)
- [x] 프리셋 시스템 (범용 코어 + 도메인별 프리셋)
- [x] 프리셋 내 에이전트 생성/편집/삭제 (커스터마이징)
- [x] 에이전트 지침 AI 자동 작성 (사용자는 대략적 역할만, AI가 프로젝트 맥락 보고 세부 지침 생성 + 불명확 시 질문)
- [x] 단계별 사용자 확인 체크포인트
- [x] 데스크톱 알림 (에이전트 완료/오류)
- [x] 세션 요약 자동 생성

### 2.2 Out of Scope

- 실시간 앱 프리뷰 (iframe) — html 직접 열면 됨
- 코드 diff 프리뷰 — 비전공자가 이해 못함, 변경 요약으로 대체
- 비용 예산 리밋 — 구독제(Max 플랜) 사용, 비용 직접 발생 안 함
- 코드베이스 인덱싱 (RAG) — 후순위
- 시장 출시, 과금 시스템
- 모바일/웹 버전

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| **Discovery** | | | |
| FR-01 | 프로젝트 유형 선택 (프리셋 선택) | High | Pending |
| FR-02 | 선택지 기반 질문 플로우 (2~4개 옵션 + 기타 입력) | High | Pending |
| FR-03 | 스펙 요약 카드 (핵심 정보 시각화 + 항목별 수정) | High | Pending |
| FR-04 | 핵심(사용자 결정) vs 확장(AI 제안) 구분 | High | Pending |
| **오케스트레이션** | | | |
| FR-05 | Planner 에이전트: 스펙 → 기술 명세 + 기능 목록 확장 | High | Pending |
| FR-06 | Generator 에이전트: 기능 단위로 코드 구현 | High | Pending |
| FR-07 | Evaluator 에이전트: 빌드 검증 + 코드 리뷰 | High | Pending |
| FR-08 | 자동 루프: Evaluator 반려 시 Generator 재작업 | High | Pending |
| FR-09 | 단계별 사용자 확인 체크포인트 (큰 기능 단위) | High | Pending |
| FR-10 | 대시보드에서 에이전트 일시정지/재시작/재배정 | Medium | Pending |
| **대시보드** | | | |
| FR-11 | 에이전트 상태 패널 (실행/대기/완료/오류 + 집계 요약) | High | Pending |
| FR-12 | 프로젝트 진행률 (전체 기능 중 완료/진행/대기) | High | Pending |
| FR-13 | 활동 타임라인 (시간순, 에이전트별/이벤트별 필터) | High | Pending |
| FR-14 | 변경 요약 표시 (비전공자 언어로 "뭐가 바뀌었는지") | High | Pending |
| FR-15 | 데스크톱 알림 (에이전트 완료/오류) | Medium | Pending |
| **기억 시스템** | | | |
| FR-16 | Layer 1 — Guidelines 자동 주입 (매 에이전트 호출 시) | High | Pending |
| FR-17 | Layer 2 — Project State 자동 저장/불러오기 | High | Pending |
| FR-18 | Layer 3 — Session Logs 자동 생성 (세션 종료 시) | High | Pending |
| FR-19 | 모듈식 프롬프트 조립 (base + role + state + task + format) | High | Pending |
| FR-20 | 에이전트 완료 보고서 자동 수집 (구조화된 JSON) | High | Pending |
| **프리셋 시스템** | | | |
| FR-21 | 내장 프리셋 제공 (game, webapp 등) | Medium | Pending |
| FR-22 | 프리셋 내 Discovery 질문셋 정의/편집 | Medium | Pending |
| FR-23 | 프리셋 내 에이전트 생성/편집/삭제 (역할, 목표, 제약, 모델) | High | Pending |
| FR-24 | 프리셋 내 Evaluator 평가 기준 정의/편집 | Medium | Pending |
| FR-25 | 프리셋 복제 → 커스텀 프리셋 생성 | Medium | Pending |
| FR-26 | 프리셋 내보내기/가져오기 (공유 가능) | Low | Pending |
| **에이전트 지침 자동 작성** | | | |
| FR-27 | 사용자가 대략적 역할만 입력하면 AI가 프로젝트 맥락을 분석하여 세부 지침을 자동 생성 | High | Pending |
| FR-28 | 지침 생성 시 불명확한 부분은 사용자에게 질문으로 명확화 (Discovery 방식) | High | Pending |
| FR-29 | 생성된 지침을 사용자에게 보여주고 큰 방향만 맞으면 승인, 세부 수정은 AI 재량 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 에이전트 상태 업데이트 지연 < 1초 | 대시보드 반응 시간 |
| Performance | 앱 시작 시간 < 3초 | Electron cold start |
| UX | 비개발자가 10분 내 첫 프로젝트 시작 가능 | 사용성 테스트 |
| 안정성 | 에이전트 충돌 시 자동 복구, 진행 상태 보존 | 에러 시나리오 테스트 |
| 토큰 효율 | 지침 주입 오버헤드 < 전체 토큰의 10% | 프롬프트 사이즈 측정 |

---

## 4. Feature Detail

### 4.1 Discovery 플로우

**목적**: 사용자의 모호한 아이디어를 구체적 스펙으로 변환

**플로우**:
```
1. 프리셋 선택
   "어떤 종류의 프로젝트를 만드시나요?"
   [🎮 게임] [🌐 웹앱] [📱 모바일] [⚙️ 커스텀]

2. 프리셋별 질문 시퀀스 (3~8개 질문)
   - 각 질문: 2~4개 선택지 + "기타" 자유 입력
   - 상단 진행 바 (Step 1/5, 2/5...)
   - 이전 단계로 돌아가기 가능

3. AI 확장 제안
   - 사용자 답변 기반으로 AI가 추가 기능/시스템 제안
   - 사용자가 체크/해제로 스코프 조절

4. 스펙 요약 카드
   ┌─────────────────────────────────────┐
   │  🎮 2D 플랫포머 게임               │
   ├─────────────────────────────────────┤
   │  핵심 (사용자 결정)                 │
   │  ● 장르: 플랫포머                  │  [수정]
   │  ● 게임루프: 점프로 적 피하기       │  [수정]
   │  ● 조작: 키보드 (←→↑)             │  [수정]
   │  ● 느낌: 슈퍼마리오 but 단순하게    │  [수정]
   ├─────────────────────────────────────┤
   │  확장 (AI 제안)                     │
   │  ☑ 3개 스테이지                    │
   │  ☑ 점수 시스템                     │
   │  ☐ 보스전                          │
   │  ☐ 파워업 아이템                   │
   ├─────────────────────────────────────┤
   │  기술 스택 (AI 선택)                │
   │  React + Canvas API + TypeScript    │
   ├─────────────────────────────────────┤
   │  [◀ 수정하기]         [▶ 개발 시작] │
   └─────────────────────────────────────┘

5. 확인 후 → Planner에게 전달
```

**프리셋별 질문 예시**:

| 프리셋 | 질문 예시 |
|--------|----------|
| game | 장르? 핵심 루프? 조작 방식? 레퍼런스? 타겟 플레이어? |
| webapp | 로그인 필요? 핵심 기능? 데이터 저장? 타겟 유저? |
| mobile | iOS/Android/둘다? 오프라인 필요? 카메라/GPS 사용? |

### 4.2 오케스트레이션 시스템

**기본 3에이전트 (항상 존재)**:

```yaml
# 도구 내부 기본 에이전트 정의
planner:
  role: "기술 설계자"
  goal: "Discovery 스펙을 기술 명세로 확장하고 기능 목록 생성"
  input: Discovery 스펙 카드
  output: 기능 목록 + 구현 순서 + 기술 스택 결정
  model: opus
  guidelines_inject:
    - base_instructions
    - project_state
    - preset_rules

generator:
  role: "개발자"
  goal: "기능 단위로 코드를 구현"
  input: Planner의 기능 명세
  output: 구현된 코드 + 변경 요약 (비전공자 언어)
  model: sonnet
  guidelines_inject:
    - base_instructions
    - role_instructions
    - project_state
    - task_specific
    - output_format

evaluator:
  role: "QA 엔지니어"
  goal: "구현 결과를 검증하고 통과/반려 판정"
  input: Generator의 코드 + 변경 요약
  output: 검증 결과 (통과/반려 + 사유)
  model: opus
  constraints:
    - "코드 수정 금지, 검증과 보고서만"
  guidelines_inject:
    - base_instructions
    - role_instructions
    - evaluator_criteria (프리셋별)
```

**실행 흐름**:
```
Discovery 스펙
      ↓
  [Planner] → 기능 목록 (기능A, 기능B, 기능C...)
      ↓
  [사용자 확인] "이 순서로 만들까요?"
      ↓
  ┌─ 기능A ────────────────────────────────────┐
  │  [Generator] → 구현 + 변경 요약             │
  │       ↓                                     │
  │  [Evaluator] → 검증                         │
  │       ↓                                     │
  │  통과? ──Yes──→ 다음 기능으로               │
  │       │                                     │
  │       No (최대 3회)                         │
  │       ↓                                     │
  │  [Generator] → 수정 + 변경 요약             │
  └─────────────────────────────────────────────┘
      ↓ (기능A 완료)
  [사용자 확인 체크포인트] "기능A 완료. 확인하시겠어요?"
      ↓
  ┌─ 기능B ─────...
```

**프리셋 추가 에이전트 (선택적)**:
```
게임 프리셋:
  + balance_tester:  게임 밸런스 검증
  + asset_advisor:   아트/사운드 에셋 제안

웹앱 프리셋:
  + security_checker: 보안 취약점 검사
  + api_tester:      API 엔드포인트 검증

커스텀:
  + 사용자가 자유롭게 에이전트 추가/편집
```

### 4.3 에이전트 커스터마이징 시스템

**핵심 요구사항**: 프리셋 안에서 에이전트를 생성/편집/삭제 가능
**핵심 원칙**: 사용자는 "대략 뭘 하는지"만 적으면, AI가 세부 지침을 자동 작성

#### 에이전트 지침 자동 작성 플로우 (FR-27~29)

```
사용자 입력 (대략적):
  "이 에이전트는 게임 밸런스를 검증하는 역할이야"
        ↓
  [AI 분석]
  ├─ 현재 프로젝트 스펙 카드 참조
  ├─ 프리셋 맥락 참조 (game 프리셋이면 게임 관련 지식 활용)
  ├─ 기존 에이전트들과의 역할 중복/충돌 확인
  └─ 불명확한 부분 발견 시 → 사용자에게 질문
        ↓
  [질문 (필요시만)]
  "밸런스 검증 시 중점적으로 볼 항목이 있나요?"
  [● 난이도 곡선] [● 보상 체계] [● 플레이 시간] [기타]
        ↓
  [AI가 세부 지침 자동 생성]
  ┌─────────────────────────────────────────────┐
  │  AI가 작성한 지침 미리보기                    │
  │                                              │
  │  역할: 게임 밸런스 전문가                     │
  │  목표: 난이도 곡선과 보상 체계의 적정성 검증   │
  │                                              │
  │  세부 지침 (AI 작성):                        │
  │  • 레벨 1은 초보자가 3회 내 클리어 가능해야 함 │
  │  • 레벨 간 난이도 증가폭은 15~25% 이내        │
  │  • 보상은 난이도에 비례해야 함                 │
  │  • 플레이어 사망 원인을 분석하고 보고          │
  │  • 코드 수정 금지, 보고서만 작성               │
  │                                              │
  │  ⚠️ 큰 방향이 맞으면 승인해주세요.            │
  │    세부 내용은 AI가 프로젝트 진행하며 조정합니다│
  │                                              │
  │         [다시 생성]  [수정 요청]  [승인]       │
  └─────────────────────────────────────────────┘
```

**핵심 포인트:**
- 사용자는 "뭘 하는 애인지"만 적으면 됨 (한 줄이어도 OK)
- AI가 프로젝트 맥락(스펙 카드, 기존 에이전트, 프리셋)을 보고 적합한 지침 생성
- 불명확하면 Discovery처럼 질문으로 명확화
- 사용자는 큰 방향만 확인 — 세부 지침은 AI 재량으로 수정 가능
- 프로젝트가 진행되면서 지침이 자동으로 개선될 수 있음 (학습)

**계층 구조**:
```
도구 기본값 (수정 불가)
  └─ 프리셋 기본값 (game, webapp 등)
       └─ 사용자 오버라이드 (프로젝트별 or 글로벌)
```

**에이전트 정의 스키마**:
```yaml
# agents/{agent-name}.yaml
name: "balance-tester"
display_name: "밸런스 테스터"
icon: "⚖️"
role: "게임 밸런스 전문가"
goal: "게임의 난이도, 보상 체계, 진행 속도를 검증"
constraints:
  - "코드 수정 금지, 보고서만 작성"
  - "난이도 곡선이 점진적인지 확인"
model: sonnet  # opus | sonnet | haiku
trigger: after_evaluator  # manual | after_generator | after_evaluator
output_format: |
  {
    "agent": "{name}",
    "status": "통과/반려",
    "findings": ["발견1", "발견2"],
    "summary": "비전공자 요약"
  }
guidelines:  # 이 에이전트에게만 주입되는 추가 지침
  - "레벨 1은 초보자도 클리어 가능해야 함"
  - "레벨 간 난이도 증가폭은 20% 이내"
```

**GUI 에이전트 편집기** (2가지 모드):

**간편 모드 (기본 — 비전공자용)**:
```
┌─ 새 에이전트 만들기 ─────────────────────────────┐
│                                                  │
│  이 에이전트는 어떤 일을 하나요?                  │
│  ┌─────────────────────────────────────────┐     │
│  │ 게임 밸런스를 검증하는 역할이야           │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
│           [AI가 지침 작성해줄게요 →]              │
│                                                  │
│  ── AI가 질문합니다 ──────────────────────────   │
│  "밸런스 검증 시 중점적으로 볼 항목은?"           │
│  [● 난이도 곡선] [● 보상 체계] [● 플레이 시간]   │
│                                                  │
│  ── AI가 작성한 지침 ─────────────────────────   │
│  역할: 게임 밸런스 전문가                        │
│  • 레벨 1은 초보자가 3회 내 클리어 가능해야 함    │
│  • 레벨 간 난이도 증가폭은 15~25% 이내           │
│  • 보상은 난이도에 비례해야 함                    │
│  • 코드 수정 금지, 보고서만 작성                  │
│                                                  │
│     [다시 생성]  [상세 편집 →]  [이대로 저장]     │
└──────────────────────────────────────────────────┘
```

**상세 모드 (파워유저용 — 간편 모드에서 "상세 편집" 클릭 시)**:
```
┌─ 에이전트 편집: 밸런스 테스터 ──────────────────┐
│                                                  │
│  아이콘:  [⚖️ ▾]                                 │
│  이름:    [밸런스 테스터          ]               │
│  역할:    [게임 밸런스 전문가      ]              │
│                                                  │
│  목표:                                           │
│  ┌─────────────────────────────────────────┐     │
│  │ 난이도 곡선과 보상 체계의 적정성 검증     │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
│  모델:    [● Sonnet (빠름)]  [○ Opus (정확)]     │
│  실행:    [○ 수동]  [● Evaluator 이후 자동]      │
│                                                  │
│  세부 지침: (수동 편집 가능)                      │
│  [+ 추가]  [🤖 AI에게 다시 작성 요청]            │
│  ├─ ✕ 레벨 1은 초보자가 3회 내 클리어 가능       │
│  ├─ ✕ 레벨 간 난이도 증가폭은 15~25% 이내       │
│  ├─ ✕ 보상은 난이도에 비례해야 함                │
│  └─ ✕ 코드 수정 금지, 보고서만 작성              │
│                                                  │
│            [삭제]  [취소]  [저장]                 │
└──────────────────────────────────────────────────┘
```
```

**프리셋 관리 화면**:
```
┌─ 프리셋 관리 ────────────────────────────────────┐
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ 🎮 게임  │  │ 🌐 웹앱  │  │ ➕ 새로   │      │
│  │          │  │          │  │  만들기   │      │
│  │ 에이전트5 │  │ 에이전트4 │  │          │      │
│  │ 질문 8개  │  │ 질문 6개  │  │          │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                  │
│  ── 🎮 게임 프리셋 ────────────────────────────  │
│                                                  │
│  에이전트:                                       │
│  ┌─────────────────────────────────────────┐     │
│  │ 🔧 Planner (기본)        Opus    [편집] │     │
│  │ 💻 Generator (기본)      Sonnet  [편집] │     │
│  │ 🔍 Evaluator (기본)      Opus    [편집] │     │
│  │ ⚖️ Balance Tester (추가)  Sonnet  [편집] │     │
│  │ 🎨 Asset Advisor (추가)   Sonnet  [편집] │     │
│  │                                         │     │
│  │ [+ 에이전트 추가]                        │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
│  Discovery 질문:                                 │
│  [질문 편집기 열기]                              │
│                                                  │
│  평가 기준:                                      │
│  [평가 기준 편집기 열기]                         │
│                                                  │
│  [프리셋 복제]  [내보내기]       [저장]           │
└──────────────────────────────────────────────────┘
```

### 4.4 대시보드 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│  🔮 Harness   My Game ▾   [Ctrl+K 검색]   [$0 구독제]    ⚙ │
├─────────┬──────────────────────────────────┬─────────────────┤
│         │                                  │                 │
│  📊 홈  │   3 실행중  2 완료  1 오류       │  Generator      │
│  🤖 에이│                                  │  ● 실행중       │
│  📋 스펙│  ┌──────────┐ ┌──────────┐       │                 │
│  📜 로그│  │● Planner │ │● Generatr│       │  현재 작업:     │
│  ⚙ 프리│  │  ✓ 완료   │ │  실행중   │       │  로그인 기능    │
│  셋     │  │  2분 소요  │ │  3/5단계  │       │  구현중...      │
│         │  └──────────┘ └──────────┘       │                 │
│         │  ┌──────────┐ ┌──────────┐       │  최근 변경:     │
│         │  │● Evaluatr│ │⊘ Balance │       │  "회원가입 폼   │
│         │  │  대기중   │ │  대기중   │       │   추가했습니다" │
│         │  └──────────┘ └──────────┘       │                 │
│         │                                  │  [일시정지]     │
│         │  진행률: ▓▓▓▓▓▓░░░░░░ 3/7 기능   │  [로그 보기]    │
│         │                                  │                 │
├─────────┴──────────────────────────────────┴─────────────────┤
│  📜 Activity                                    [필터 ▾]     │
│  12:04  🤖 Generator  TOOL   auth.tsx 파일 생성               │
│  12:03  🤖 Generator  생각중  인증 로직 구조 분석...           │
│  12:02  🤖 Planner    완료   기능 7개 목록 확정               │
│  12:00  👤 사용자     확인   스펙 카드 승인                    │
└──────────────────────────────────────────────────────────────┘
```

### 4.5 기억 시스템

**Layer 1: Guidelines (거의 안 바뀜)**
```
harness_data/
  guidelines/
    ├─ base.md                    ← 전체 공통 규칙
    ├─ presets/
    │   ├─ game/rules.md          ← 게임 개발 규칙
    │   └─ webapp/rules.md        ← 웹앱 개발 규칙
    └─ agents/
        ├─ generator/role.yaml    ← Generator 역할 정의
        ├─ evaluator/role.yaml    ← Evaluator 역할 정의
        └─ custom/...             ← 커스텀 에이전트 정의
```
→ 매 에이전트 호출 시 **해당 에이전트의 것만** 선택적으로 주입

**Layer 2: Project State (누적 업데이트)**
```
harness_data/
  projects/
    └─ my-game/
        ├─ project_state.json     ← 기능 목록, 상태, 진행률
        ├─ decisions.json         ← 주요 결정사항
        ├─ spec_card.json         ← Discovery 스펙 카드
        └─ agent_reports/         ← 에이전트별 최종 보고서
            ├─ generator_feat1.json
            └─ evaluator_feat1.json
```
→ 새 세션 시작 시 `project_state.json` + `spec_card.json` 자동 주입

**Layer 3: Session Logs (아카이브)**
```
harness_data/
  projects/
    └─ my-game/
        └─ sessions/
            ├─ 2026-03-28_001.md  ← 세션 요약 (자동 생성)
            └─ 2026-03-29_002.md
```
→ 세션 종료 시 자동 생성, 필요할 때만 참조

**프롬프트 조립 과정**:
```
에이전트 호출 시 도구가 자동으로:

1. base.md 읽기                          (~500 토큰)
2. + preset/game/rules.md 읽기           (~300 토큰)
3. + agents/generator/role.yaml 읽기     (~200 토큰)
4. + project_state.json 요약 주입        (~500 토큰)
5. + 이번 태스크 맥락                    (~300 토큰)
6. + 출력 포맷 지정                      (~100 토큰)
───────────────────────────────────
   총 오버헤드: ~1,900 토큰 (전체의 ~5%)
```

### 4.6 Evaluator 시스템

**단계적 검증**:

```
Level 1 (MVP — 자동):
  ├─ 타입 체크: npx tsc --noEmit
  ├─ 빌드 성공: npm run build
  └─ 린트: eslint (있으면)

Level 2 (MVP — AI):
  ├─ Evaluator 에이전트가 코드 리뷰
  ├─ 스펙 대비 구현 일치도 확인
  └─ 변경 요약 생성 (비전공자 언어)

Level 3 (후순위 — 선택적):
  └─ Playwright로 실제 앱 테스트
```

**Evaluator 판정 결과**:
```json
{
  "status": "반려",
  "score": 65,
  "findings": [
    {"severity": "error", "message": "로그인 후 리다이렉트가 작동하지 않음"},
    {"severity": "warning", "message": "비밀번호 유효성 검사 미구현"}
  ],
  "summary_for_user": "로그인 기능은 만들어졌지만, 로그인 후 메인 화면으로 이동하는 부분이 아직 안 됩니다. 비밀번호 조건 확인도 추가 필요합니다.",
  "retry_instructions": "Generator에게: 로그인 성공 시 / 경로로 redirect 추가, password regex 검증 추가"
}
```

### 4.7 변경 요약 (비전공자 언어)

에이전트가 작업 완료 시 반드시 출력하는 형식:

```
┌─ 변경 요약 ──────────────────────────────────┐
│                                               │
│  ✅ 완료된 것:                                │
│  • 로그인 화면을 만들었습니다                  │
│  • 이메일과 비밀번호로 로그인할 수 있습니다     │
│                                               │
│  🔨 수정한 파일: 3개                          │
│  • LoginPage.tsx (새로 만듦)                  │
│  • App.tsx (로그인 페이지 연결)                │
│  • auth.ts (인증 로직)                        │
│                                               │
│  ⏭️ 다음 단계:                                │
│  • Evaluator가 동작 확인 예정                  │
│                                               │
└───────────────────────────────────────────────┘
```

---

## 5. Success Criteria

### 5.1 Definition of Done

- [ ] Discovery 플로우로 프로젝트 시작 가능
- [ ] 3에이전트(Planner/Generator/Evaluator) 자동 루프 동작
- [ ] 대시보드에서 에이전트 상태 실시간 확인 가능
- [ ] 세션 종료 후 재시작해도 프로젝트 맥락 유지
- [ ] 프리셋에서 에이전트 생성/편집/삭제 가능
- [ ] 비전공자가 "게임 만들고 싶다"에서 실제 동작하는 결과물까지 도달

### 5.2 Quality Criteria

- [ ] 빌드 성공 (Electron 패키징)
- [ ] 앱 시작 < 3초
- [ ] 에이전트 상태 업데이트 지연 < 1초
- [ ] 지침 주입 오버헤드 < 전체 토큰의 10%

---

## 6. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Claude Code CLI 호출 API가 변경될 수 있음 | High | Medium | 추상화 레이어로 CLI 호출 격리 |
| 에이전트 간 파일 충돌 (같은 파일 동시 수정) | High | Medium | 기능 단위 순차 실행, 병렬은 독립 파일만 |
| Evaluator가 빌드 외 검증에서 부정확할 수 있음 | Medium | High | Level 1(빌드)은 확실, Level 2(AI 리뷰)는 보조적 |
| Electron 앱 용량이 클 수 있음 (200MB+) | Low | High | 사용자가 용량 신경 안 쓴다고 확인함 |
| 프리셋 에이전트 정의가 복잡해질 수 있음 | Medium | Medium | GUI 편집기로 YAML 직접 수정 불필요하게 |

---

## 7. Architecture

### 7.1 기술 스택

```
Frontend (Electron Renderer):
  - React 18+ (TypeScript)
  - Tailwind CSS (다크 테마)
  - shadcn/ui (Radix 기반 컴포넌트)
  - Tremor (대시보드 차트/위젯)
  - Framer Motion (애니메이션)

Backend (Electron Main Process):
  - Node.js
  - child_process (Claude Code CLI 호출)
  - SQLite (better-sqlite3 — 프로젝트 상태, 세션 로그)
  - YAML (js-yaml — 에이전트 정의, 프리셋)
  - chokidar (파일 변경 감시)

빌드:
  - Vite (번들러)
  - electron-builder (패키징)
```

### 7.2 폴더 구조

```
src/
  main/                          ← Electron Main Process
    ├─ index.ts                  ← 앱 진입점
    ├─ agent-runner/             ← Claude Code CLI 호출 관리
    │   ├─ cli-bridge.ts         ← CLI 명령 추상화
    │   ├─ agent-pool.ts         ← 에이전트 인스턴스 관리
    │   └─ prompt-assembler.ts   ← 모듈식 프롬프트 조립
    ├─ memory/                   ← 기억 시스템
    │   ├─ guidelines-loader.ts  ← Layer 1 로더
    │   ├─ project-state.ts      ← Layer 2 관리
    │   └─ session-logger.ts     ← Layer 3 자동 생성
    ├─ orchestrator/             ← 오케스트레이션
    │   ├─ pipeline.ts           ← Planner→Generator→Evaluator 루프
    │   ├─ checkpoint.ts         ← 사용자 확인 체크포인트
    │   └─ evaluator-loop.ts     ← 자동 검증/재작업 루프
    └─ preset/                   ← 프리셋 관리
        ├─ preset-loader.ts      ← 프리셋 로드/저장
        └─ agent-schema.ts       ← 에이전트 YAML 스키마

  renderer/                      ← Electron Renderer (React)
    ├─ App.tsx
    ├─ pages/
    │   ├─ Discovery/            ← Discovery 위저드
    │   ├─ Dashboard/            ← 메인 대시보드
    │   ├─ PresetEditor/         ← 프리셋/에이전트 편집기
    │   └─ Settings/             ← 설정
    ├─ components/
    │   ├─ AgentCard/            ← 에이전트 상태 카드
    │   ├─ ActivityFeed/         ← 활동 타임라인
    │   ├─ SpecCard/             ← 스펙 요약 카드
    │   ├─ ProgressBar/          ← 진행률 바
    │   └─ ChangeSummary/        ← 변경 요약 (비전공자)
    ├─ stores/                   ← Zustand 상태관리
    └─ styles/                   ← Tailwind 설정

  shared/                        ← Main/Renderer 공유 타입
    ├─ types.ts
    └─ ipc-channels.ts           ← IPC 채널 정의

harness_data/                    ← 사용자 데이터 (앱 외부)
  ├─ guidelines/                 ← Layer 1
  ├─ presets/                    ← 프리셋 정의
  └─ projects/                   ← 프로젝트별 데이터
```

### 7.3 IPC 통신 구조

```
Renderer (React)          Main Process (Node.js)
     │                          │
     │  ── Discovery 완료 ──>   │
     │                          ├─ prompt-assembler.ts
     │                          ├─ cli-bridge.ts → Claude Code CLI
     │  <── 에이전트 상태 ──    │
     │  <── 활동 로그 ──        │
     │  <── 변경 요약 ──        │
     │                          │
     │  ── 일시정지 요청 ──>    │
     │  ── 체크포인트 승인 ──>  │
     │                          │
```

---

## 8. MVP 기능 우선순위

### Phase 1: 기본 동작 (v0.1)

1. Electron 앱 셸 + 다크 테마 레이아웃
2. Discovery 플로우 (하드코딩된 게임 프리셋 1개)
3. Planner → Generator → Evaluator 기본 루프
4. 에이전트 상태 카드 (실행/완료/오류)
5. 활동 타임라인 (기본 로그)
6. 변경 요약 표시
7. 지침 자동 주입 (모듈식 프롬프트 조립)
8. Project State 저장/불러오기

### Phase 2: 관리 기능 (v0.2)

9. 프리셋 시스템 (game + webapp)
10. 에이전트 생성/편집/삭제 GUI
11. 세션 요약 자동 생성
12. 데스크톱 알림
13. 프로젝트 진행률 표시
14. 뷰 전환 (리스트/보드)

### Phase 3: 고급 기능 (v0.3+)

15. Ctrl+K 커맨드 팔레트
16. 프리셋 커스텀 에디터
17. 프리셋 내보내기/가져오기
18. 토큰 사용량 모니터링
19. 프로젝트 히스토리 타임트래블

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`harness-tool.design.md`)
2. [ ] Electron 프로젝트 초기 셋업
3. [ ] Phase 1 구현 시작

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-28 | Initial draft — Discovery, 오케스트레이션, 대시보드, 기억시스템, 프리셋 기획 | User + Claude |
