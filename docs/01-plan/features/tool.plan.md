# WorkTool Planning Document (v2 — Full Re-plan)

> **Summary**: Claude Code CLI를 감싸는 데스크톱 하네스 도구 — Discovery부터 자동 오케스트레이션, 기본 스킬/프리셋 번들링, 일정 관리까지
>
> **Project**: WorkTool
> **Version**: 0.2.0
> **Author**: User + Claude
> **Date**: 2026-03-29
> **Status**: Active
> **PRD Reference**: `docs/00-pm/tool.prd.md`
> **Previous Plan**: `docs/01-plan/features/harness-tool.plan.md` (Session 1, deprecated)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | Claude Code CLI는 비개발자에게 진입장벽이 높고, 에이전트 팀 관리/프로젝트 기억 유지/계획 완전성 검증이 불가능. 기존 AI 코딩 도구는 개발자 전용이거나 단순 도구에 그침 |
| **Solution** | Electron 데스크톱 앱으로 자연어 대화 → AI 파이프라인 자동 실행 → 시각적 관리. 기본 스킬 10종 + 프리셋 5종 번들링으로 즉시 사용 가능. 3-Tier 실행으로 토큰 비용 최적화 |
| **Function/UX Effect** | Discovery 대화 → 스펙 카드 → 에이전트 팀 자동 구성 → 캘린더/간트 일정 → 파이프라인 실행 → 실시간 시각화 → 자동 학습 → 스펙-기능 교차 검증 |
| **Core Value** | 하네스 엔지니어링의 코드화: CMD 수동 관리를 자동화/시각화하여 비개발자도 AI로 프로젝트를 완성 |

---

## 1. Overview

### 1.1 Purpose

tarrot 프로젝트에서 경험한 5가지 문제 + PRD에서 발굴한 2가지 신규 문제 해결:

1. **에이전트 가시성 부재** — CMD에서 누가 뭘 하는지 안 보임 ✅ 해결됨
2. **에이전트 드리프트** — 지침을 잊고 멋대로 행동 ✅ 해결됨
3. **장기 프로젝트 기억 손실** — 사용자도 AI도 맥락을 잃음 ✅ 해결됨
4. **PM 부재** — 프로젝트 전체 맥락을 유지하는 주체가 없음 ✅ 해결됨
5. **CMD 한계** — 비시각적, 멀티에이전트 관리 어려움 ✅ 해결됨
6. **계획 불완전** — 기능이 빠져서 검수→수정 반복 ❌ **미해결 (P0-03)**
7. **기본 콘텐츠 부재** — 스킬/프리셋 0개로 설치 후 즉시 사용 불가 ❌ **미해결 (P0-01, P0-02)**
8. **계획 문서 부재** — 변경사항이 생겨도 계획에 자동 반영되지 않음 ❌ **미해결 (P0-08)**

### 1.2 Related Documents

- PRD: `docs/00-pm/tool.prd.md`
- Previous Plan: `docs/01-plan/features/harness-tool.plan.md`
- Design: `docs/02-design/features/harness-tool.design.md`
- HANDOFF: `HANDOFF.md`

---

## 2. Current Implementation Status (Session 1-3)

### 2.1 Completed ✅

| Category | Items |
|----------|-------|
| **Core Architecture** | Electron+React+Vite+Tailwind+SQLite, IPC 40+핸들러, Schema v5, MemoryManager, CLIBridge, PromptAssembler |
| **Navigation & UI** | Dashboard (카드/타임라인), ProjectView (6 서브탭), SchedulePage (캘린더/간트), Discovery 대화, Chat UI, Orchestration 시각화, 한글화 |
| **Smart Systems** | 3-Tier (Direct/Light/Full), SmartOrchestrator, PromptTranslator, DecisionRequester, AgentLearning, AutoSkillDetection, PhaseDefinitions, R&D Agent, GitManager |
| **Polish** | Toast, Framer Motion, 키보드 단축키, ErrorBoundary, Skeleton, 다크/라이트 모드, 프로젝트별 workingDir, Chat 컨텍스트 연속성 |

### 2.2 Not Done ❌

아래 Section 3에서 상세 정리.

---

## 3. Requirements (재정리)

### 3.1 P0 — Alpha 필수 (구현 순서대로)

| ID | Requirement | Effort | Dependencies | Status |
|----|-------------|--------|--------------|--------|
| **P0-01** | 기본 프리셋 5종 번들링 | Medium | 없음 | Pending |
| **P0-02** | 기본 스킬 10종 내장 | Medium | 없음 | Pending |
| **P0-03** | 스펙-기능 교차 검증 | Medium | P0-01 | Pending |
| **P0-04** | PhaseTracker 실제 연결 | Low | 없음 | Pending |
| **P0-05** | Electron 폴더 선택 다이얼로그 | Low | 없음 | Pending |
| **P0-06** | E2E 엔진 테스트 | High | P0-01~05 | Pending |
| **P0-07** | Windows 패키징 | Medium | P0-06 | Pending |
| **P0-08** | 프로젝트 계획 문서 자동 관리 | Medium | P0-03 | Pending |

### 3.2 P1 — Beta

| ID | Requirement | Effort |
|----|-------------|--------|
| P1-01 | 토큰 사용량 대시보드 | Medium |
| P1-02 | 기능 누락 감지 알림 (지속적) | Medium |
| P1-03 | 세션 복구 (크래시 후 재개) | Medium |
| P1-04 | 자동 업데이트 (electron-updater) | Medium |
| P1-05 | 설치 마법사 + Claude Code 사전 체크 | Low |
| P1-06 | 다국어 지원 기반 (i18n) | Medium |
| P1-07 | 프로젝트 Import/Export | Low |
| P1-08 | 프리셋 에디터 고도화 | Medium |

### 3.3 P2 — Launch

| ID | Requirement | Effort |
|----|-------------|--------|
| P2-01 | 스킬 마켓플레이스 | High |
| P2-02 | 비용 예측 시스템 | Medium |
| P2-03 | 팀 협업 (멀티 사용자) | High |
| P2-04 | 영문화 | Medium |
| P2-05 | macOS/Linux 빌드 | Medium |

---

## 4. P0 Feature Details

### 4.1 P0-01: 기본 프리셋 5종 번들링

**현황**: `mock-presets.ts`에 Game/WebApp 2종만, agents/evaluatorCriteria 비어있음

**번들할 프리셋:**

| Preset ID | Name | Discovery 질문 | 전문 에이전트 | Evaluator 기준 |
|-----------|------|:---------:|:----------:|:----------:|
| `game` | 게임 | 7개 (장르, 루프, 조작, 레퍼런스, 타겟, 그래픽, 사운드) | BalanceTester, UXReviewer | 빌드 통과, 게임루프 동작, 입력 반응 |
| `webapp` | 웹 앱 | 6개 (인증, 핵심기능, DB, 반응형, API, 타겟) | APIDesigner, A11yChecker | 빌드, 라우팅, 반응형, API |
| `mobile` | 모바일 앱 | 5개 (플랫폼, 오프라인, 카메라/GPS, 푸시, 프레임워크) | PlatformAdapter, OfflineHandler | 빌드, 네이티브 기능 |
| `api-server` | API 서버 | 5개 (인증, 엔드포인트, DB, 실시간, 문서화) | SecurityAuditor, DocGenerator | 엔드포인트 응답, 인증, 에러처리 |
| `desktop` | 데스크톱 앱 | 5개 (프레임워크, OS, 네이티브기능, 업데이트, 패키징) | NativeIntegrator, InstallerBuilder | 빌드, 네이티브, 패키징 |

**구현 위치:**
- `resources/presets/{id}.json` — 각 프리셋 완전한 JSON 파일
- `src/main/preset/preset-manager.ts` — 빌트인 로딩 로직

**Acceptance Criteria:**
- [ ] 5개 프리셋 JSON 파일 존재하고 Discovery 시작 가능
- [ ] 각 프리셋에 core 3 (planner/generator/evaluator) + specialized N개 에이전트
- [ ] 각 프리셋에 evaluatorCriteria + baseGuidelines 완비
- [ ] Discovery 질문 세트가 각 프리셋에 적합한 내용

---

### 4.2 P0-02: 기본 스킬 10종 내장

**현황**: project_skills 테이블과 UI는 있지만 기본 스킬 0개

**번들할 스킬:**

| # | ID | Name | Category | Description | Trigger |
|---|-----|------|----------|-------------|---------|
| 1 | `handoff` | 인수인계 | Workflow | 에이전트 간 작업 인수인계 + 컨텍스트 전달 | 에이전트 전환 시 |
| 2 | `code-review` | 코드 리뷰 | Quality | 생성 코드의 품질/보안/성능 리뷰 | Generator 완료 후 |
| 3 | `testing` | 테스트 생성 | Quality | 단위/통합 테스트 자동 생성 | 기능 구현 완료 후 |
| 4 | `deployment` | 배포 가이드 | DevOps | 빌드+패키징+배포 가이드 생성 | 프로젝트 완료 시 |
| 5 | `documentation` | 문서 생성 | Docs | README, API 문서, 사용자 가이드 | 기능 완료 시 |
| 6 | `error-recovery` | 오류 복구 | Reliability | 에이전트 실패 시 자동 복구 전략 | 에러 발생 시 |
| 7 | `spec-validation` | 스펙 검증 | Planning | 스펙 카드 ↔ 구현 일치 검증 | Evaluator 단계 |
| 8 | `token-optimizer` | 토큰 최적화 | Cost | 프롬프트 압축 + 불필요 컨텍스트 제거 | 매 에이전트 호출 전 |
| 9 | `git-workflow` | Git 자동화 | VCS | 기능별 브랜치+커밋+PR 자동화 | 기능 시작/완료 시 |
| 10 | `progress-report` | 진행 보고 | Reporting | 프로젝트 진행 상황 자동 요약 | 사용자 요청 or 세션 종료 |

**구현 위치:**
- `resources/skills/` — 스킬 정의 JSON 파일
- `src/main/memory/memory-manager.ts` — `seedDefaultSkills()` 메서드
- 앱 첫 실행 시 DB에 자동 삽입

**Acceptance Criteria:**
- [ ] 10개 스킬이 `resources/skills/` 에 정의 파일로 존재
- [ ] 앱 첫 실행 시 project_skills 테이블에 자동 seed
- [ ] 프리셋 페이지에서 기본 스킬 확인 가능
- [ ] 각 스킬에 name, description, pattern, template 완비

---

### 4.3 P0-03: 스펙-기능 교차 검증

**문제**: "일정 탭 만들겠다고 했었잖아" — Planner가 스펙 카드의 기능을 누락

**구현 위치:** `src/main/orchestrator/pipeline.ts` > `runPlanner()` 후, `requestCheckpoint()` 전

**로직:**
```
1. Discovery 대화 내용 (SpecCard.rawAnswers) + SpecCard.coreDecisions/expansions 추출
2. Planner 출력 (Feature 목록)과 비교
3. SpecCard에는 있지만 Feature에 없는 키워드/기능 감지
4. CheckpointModal에 "누락 가능성" 경고 표시
5. 사용자가 "추가" 또는 "무시" 선택
```

**Acceptance Criteria:**
- [ ] Discovery에서 언급한 기능이 Planner 결과에 없으면 경고 표시
- [ ] CheckpointModal에 "누락 가능성 있는 기능" 섹션 추가
- [ ] 사용자가 누락 항목을 "추가" 선택 시 Feature 목록에 즉시 추가

---

### 4.4 P0-04: PhaseTracker 실제 연결

**현황**: PhaseTracker 컴포넌트 + phase-definitions.ts 있지만 파이프라인 미연결

**구현:**
- Pipeline 실행 시 Phase 자동 업데이트 (`planning` → `implement` → `test`)
- Evaluator 통과 시 체크리스트 자동 완료
- ProjectView 개요 탭의 PhaseTracker가 실시간 반영

**구현 위치:**
- `src/main/orchestrator/pipeline.ts` — Phase 상태 전환 로직 추가
- `src/main/index.ts` — `phase:update` IPC에서 PhaseTracker 연동
- `src/renderer/pages/ProjectView.tsx` — PhaseTracker 와이어링

**Acceptance Criteria:**
- [ ] Pipeline 시작 시 Phase → "implement" 자동 전환
- [ ] Feature 완료마다 체크리스트 항목 자동 완료
- [ ] Evaluator 통과 시 "빌드 에러 없음" 자동 체크
- [ ] UI PhaseTracker가 실시간 상태 반영

---

### 4.5 P0-05: Electron 폴더 선택 다이얼로그

**현황**: Discovery에서 workingDir를 텍스트 input으로 직접 입력

**구현:**
- IPC 핸들러: `dialog:select-folder` → `dialog.showOpenDialog({ properties: ['openDirectory'] })`
- preload API: `dialog.selectFolder()`
- DiscoveryChat에서 폴더 선택 버튼 추가

**Acceptance Criteria:**
- [ ] "폴더 선택" 버튼 클릭 시 OS 네이티브 다이얼로그
- [ ] 선택 후 경로가 UI에 표시
- [ ] 유효성 검증 (존재 여부, 쓰기 권한)

---

### 4.6 P0-06: E2E 엔진 테스트

**현황**: UI 완성, Claude CLI 연동 미검증

**테스트 시나리오:**

| # | 모드 | 시나리오 | 예상 결과 |
|---|------|----------|-----------|
| 1 | Direct | "버튼 색상을 빨간색으로 변경" | Generator 1회 호출, 파일 변경 |
| 2 | Light | "비밀번호 확인 필드 추가" | Generator+Evaluator, 검증 통과 |
| 3 | Full | "사용자 인증 시스템 구현" | Planner→Generator→Evaluator 전체 루프 |
| 4 | Discovery | 자연어 대화로 프로젝트 정의 | 스펙 카드 생성 |
| 5 | Pipeline | Pipeline 시작 버튼 | Feature 분해 → 코드 생성 → 검증 루프 |

**Acceptance Criteria:**
- [ ] 5개 시나리오 모두 에러 없이 완주
- [ ] 토큰 사용량이 agent_runs 테이블에 기록
- [ ] 결과가 UI에 실시간 표시
- [ ] Decision Requester가 AI 출력에서 질문 감지

---

### 4.7 P0-07: Windows 패키징

**구현:**
- `npm run package` → electron-builder로 Windows .exe 생성
- better-sqlite3 네이티브 모듈 포함
- `resources/` (프리셋, 스킬) 포함
- 앱 아이콘 (최소 256x256)

**Acceptance Criteria:**
- [ ] 깨끗한 Windows 환경에서 설치 및 실행 가능
- [ ] SQLite DB 정상 생성
- [ ] 프리셋/스킬이 로드됨
- [ ] Claude Code CLI 연동 정상

---

### 4.8 P0-08: 프로젝트 계획 문서 자동 관리

**문제**: 현재 앱에 "계획 문서"라는 개념이 없음. SpecCard는 Discovery 후 고정되고, Feature 목록이 변경돼도 반영 안 됨. 스펙/기능/일정/에이전트 구성이 각각 흩어져 있어서, 프로젝트가 진행되면서 "원래 뭘 만들기로 했는지" 추적이 불가능.

**핵심 원칙**: 우리가 지금 직접 겪고 있는 문제 — "일정 탭 만들겠다고 했었잖아" — 를 사용자도 겪게 됨. Plan 문서가 있고 변경 시 자동 업데이트되면 이 문제가 해결됨.

**구현 범위:**

#### A. Plan Document 데이터 모델

DB에 `project_plans` 테이블 추가 (Schema v6):

```sql
CREATE TABLE project_plans (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  content_json TEXT NOT NULL,    -- 구조화된 계획 문서
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

`content_json` 구조:
```json
{
  "overview": "프로젝트 한 줄 요약",
  "specSummary": { /* SpecCard에서 추출 */ },
  "features": [
    {
      "featureId": "...",
      "name": "사용자 인증",
      "description": "...",
      "status": "pending",
      "estimatedStart": "...",
      "estimatedEnd": "...",
      "assignedAgent": "generator"
    }
  ],
  "agentTeam": [ /* 에이전트 구성 */ ],
  "techStack": ["React", "Node.js"],
  "changeLog": [
    { "date": "...", "action": "feature_added", "detail": "일정 관리 기능 추가", "trigger": "user" },
    { "date": "...", "action": "feature_completed", "detail": "로그인 구현 완료", "trigger": "pipeline" }
  ]
}
```

#### B. 자동 생성 타이밍

| 이벤트 | Plan 문서 동작 |
|--------|---------------|
| Discovery 완료 | Plan v1 자동 생성 (SpecCard → 초기 계획) |
| Planner 완료 | Feature 목록 반영 → Plan 업데이트 |
| Feature 추가/삭제 | Feature 섹션 업데이트 + changeLog 기록 |
| Feature 상태 변경 | status 업데이트 (pending→in_progress→completed) |
| 일정 변경 | 일정 섹션 업데이트 |
| 에이전트 팀 변경 | agentTeam 섹션 업데이트 |
| 사용자가 Chat에서 새 기능 요청 | Feature 추가 → Plan 업데이트 |

#### C. Plan Document UI

ProjectView에 **"계획"** 서브탭 추가 (기존 6탭 → 7탭):

```
[개요] [계획] [채팅] [에이전트] [파이프라인] [스펙] [로그]
```

계획 탭 내용:
- **프로젝트 개요** (한 줄 요약 + 기술 스택)
- **기능 목록** (상태별 색상, 진행률 바)
- **에이전트 팀 구성** (역할 요약)
- **변경 이력** (changeLog 타임라인 — "누가 언제 뭘 바꿨는지")
- **스펙 ↔ 기능 일치도** (P0-03 교차검증 결과 표시)

#### D. 자동 업데이트 로직

**구현 위치:** `src/main/memory/plan-manager.ts` (신규)

```typescript
class PlanManager {
  // Discovery 완료 시 호출
  createFromSpecCard(projectId, specCard, agents): PlanDocument

  // Pipeline/Feature 변경 시 호출
  updateFeatures(projectId, features): void
  addChangeLog(projectId, action, detail, trigger): void

  // 현재 Plan 조회
  getPlan(projectId): PlanDocument

  // 스펙-기능 일치도 계산 (P0-03 연동)
  getSpecMatchRate(projectId): { rate: number, missing: string[], extra: string[] }
}
```

**자동 업데이트 훅 (기존 코드에 삽입):**

| 코드 위치 | 추가할 호출 |
|-----------|------------|
| `pipeline.ts` > Feature 생성 후 | `planManager.updateFeatures()` |
| `pipeline.ts` > Feature 상태 변경 시 | `planManager.addChangeLog("feature_status_changed", ...)` |
| `memory-manager.ts` > `updateFeatureSchedule()` | `planManager.addChangeLog("schedule_updated", ...)` |
| `index.ts` > `discovery:complete` | `planManager.createFromSpecCard()` |
| `index.ts` > `chat:send` (새 기능 감지 시) | `planManager.addChangeLog("feature_requested", ...)` |

#### E. IPC API

```typescript
// preload
plan: {
  get: (projectId) => ipcRenderer.invoke("plan:get", { projectId }),
  getMatchRate: (projectId) => ipcRenderer.invoke("plan:match-rate", { projectId }),
}
```

**Acceptance Criteria:**
- [ ] Discovery 완료 시 Plan 문서 v1 자동 생성
- [ ] Planner 완료 후 Feature 목록이 Plan에 자동 반영
- [ ] Feature 상태 변경(pending→completed 등) 시 Plan 자동 업데이트
- [ ] 일정 변경 시 Plan에 즉시 반영
- [ ] ProjectView "계획" 탭에서 현재 Plan 확인 가능
- [ ] changeLog에 모든 변경사항이 시간순으로 기록됨
- [ ] 스펙 ↔ 기능 일치도가 표시됨 (P0-03 연동)

---

## 5. Architecture

### 5.1 Tech Stack (확정)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Electron 33 | 데스크톱 네이티브, 파일시스템 접근 |
| UI | React 18 + TypeScript | 기존 구현, 컴포넌트 생태계 |
| State | Zustand | 가벼움, React 특화 |
| Styling | Tailwind CSS 3 | 빠른 UI 구현, v4 불가 (Vite 5 제한) |
| Animation | Framer Motion | 이미 전체 적용됨 |
| DB | better-sqlite3 (WAL) | 서버 없는 로컬 DB, 동적 require 필수 |
| Build | electron-vite 2.3 | Electron 전용 Vite 빌드 |
| CLI | Claude Code `--print --output-format json` | 비대화형 실행, 구조화 출력 |

### 5.2 Folder Structure

```
src/
├── main/                     # Electron Main Process
│   ├── agent-runner/         # CLI Bridge, Prompt 조립
│   ├── memory/               # SQLite DB, MemoryManager
│   ├── orchestrator/         # Pipeline, SmartOrchestrator, TaskRouter
│   ├── preset/               # PresetManager
│   └── tools/                # GitManager
├── renderer/                 # React UI
│   ├── components/           # 공유 컴포넌트
│   ├── pages/                # Dashboard, ProjectView, Schedule, Settings...
│   ├── stores/               # Zustand stores
│   └── hooks/                # Custom hooks
├── shared/                   # 공유 타입, 상수
├── preload/                  # IPC Bridge
resources/
├── presets/                  # [NEW] 빌트인 프리셋 5종 JSON
└── skills/                   # [NEW] 빌트인 스킬 10종 JSON
```

### 5.3 SQLite Schema v5

현재 테이블: `projects`, `features` (+ 일정 컬럼), `agent_runs`, `activities`, `sessions`, `chat_messages`, `agent_learnings`, `project_skills`

### 5.4 Key Constraints (Failed Approaches — 반복 금지)

1. better-sqlite3는 반드시 `require()` 동적 로딩
2. npm install 후 `npx electron-rebuild -f -w better-sqlite3` 필수
3. Tailwind v3 유지 (v4는 Vite 6 필요)
4. 모든 .tsx에 `import React from "react"` 필요
5. `prompt()` 사용 불가 — input 직접 사용
6. button 안에 button 금지 — div[role=button] 사용
7. SCHEMA_VERSION 업데이트 빠뜨리면 마이그레이션 안 돌아감

---

## 6. Implementation Roadmap

### Week 1-2: Foundation (P0-01, P0-02, P0-05)

```
Day 1-2: P0-05 폴더 선택 다이얼로그 (Quick Win)
  - dialog:select-folder IPC
  - DiscoveryChat UI 버튼

Day 3-5: P0-01 프리셋 5종 데이터 작성
  - resources/presets/game.json
  - resources/presets/webapp.json
  - resources/presets/mobile.json
  - resources/presets/api-server.json
  - resources/presets/desktop.json
  - PresetManager 빌트인 로딩

Day 6-8: P0-02 스킬 10종 데이터 작성
  - resources/skills/*.json
  - seedDefaultSkills() 메서드
  - SkillsLibrary UI 연동
```

### Week 3-4: Core Engine (P0-03, P0-04, P0-08)

```
Day 9-10: P0-04 PhaseTracker 연결
  - Pipeline → Phase 상태 전환
  - ProjectView 와이어링

Day 11-13: P0-08 프로젝트 계획 문서 자동 관리
  - Schema v6 (project_plans 테이블)
  - PlanManager 클래스 (생성/업데이트/조회)
  - Discovery→Pipeline→Feature 변경 훅 삽입
  - ProjectView "계획" 서브탭 UI

Day 14-16: P0-03 스펙-기능 교차 검증
  - SpecCard ↔ Feature 비교 로직 (PlanManager.getSpecMatchRate() 연동)
  - CheckpointModal 경고 UI

Day 17-20: P0-06 E2E 엔진 테스트
  - Direct/Light/Full 모드 실행
  - Discovery → Pipeline 전체 루프
  - Plan 문서 자동 생성/업데이트 확인
  - 버그 수정 반복
```

### Week 5-6: Packaging & Release (P0-07)

```
Day 19-21: P0-07 Windows 패키징
  - electron-builder 설정 검증
  - 네이티브 모듈 포함
  - resources 포함

Day 22-24: 통합 테스트 + 폴리싱
  - 깨끗한 환경 설치 테스트
  - README 작성
  - Alpha 릴리즈 태깅
```

---

## 7. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Claude Code CLI API 변경 | High | Medium | CLIBridge 추상화 레이어로 격리 |
| better-sqlite3 네이티브 빌드 실패 | High | Medium | electron-rebuild + 버전 핀닝 |
| 프리셋 품질 (AI 생성 코드의 질) | High | High | Evaluator 검증 + 학습 시스템으로 반복 개선 |
| Electron 앱 크기 300MB+ | Medium | Low | 불필요 의존성 제거 |
| 토큰 비용 폭주 | High | Medium | 3-Tier + token-optimizer 스킬 |
| 스펙-기능 교차 검증 정확도 | Medium | Medium | 키워드 + AI 비교 하이브리드 |

---

## 8. Success Criteria

### 8.1 Alpha Definition of Done

- [ ] P0-01~08 전체 구현 완료
- [ ] 5개 E2E 시나리오 통과
- [ ] Plan 문서가 Discovery→Pipeline 전체 과정에서 자동 관리됨
- [ ] Windows .exe 설치 및 실행 성공
- [ ] 1개 실제 프로젝트를 WorkTool로 완성 (dogfooding)

### 8.2 Quality Metrics

| Metric | Target |
|--------|--------|
| Discovery → 첫 Pipeline 실행 | < 10분 |
| electron-vite build | 에러 0 |
| Evaluator 첫 통과율 | > 40% |
| 앱 시작 시간 | < 3초 |

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`/pdca design tool`)
2. [ ] P0-05 폴더 선택 다이얼로그 구현 (Quick Win)
3. [ ] P0-01 프리셋 5종 데이터 작성
4. [ ] P0-02 스킬 10종 데이터 작성

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-28 | Initial draft (Session 1) | User + Claude |
| 0.2 | 2026-03-29 | Full re-plan based on PRD. P0 7항목 + 스킬/프리셋 번들링 추가. 기존 구현 현황 반영. 일정 탭 구현 완료. | User + Claude |
| 0.3 | 2026-03-29 | P0-08 "프로젝트 계획 문서 자동 관리" 별도 항목으로 추가. Plan 문서 자동 생성/업데이트/changeLog 추적. 로드맵 반영. | User + Claude |
