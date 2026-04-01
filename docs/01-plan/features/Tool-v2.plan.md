# Tool-v2 Planning Document — GSD + Harness-100 피벗

> **Summary**: 자체 오케스트레이션 엔진을 GSD SDK + Harness-100으로 교체하고, GUI는 유지하여 Claude Code 에코시스템의 시각화 레이어로 전환
>
> **Project**: WorkTool
> **Version**: 0.3.0
> **Author**: User + Claude
> **Date**: 2026-04-02
> **Status**: Draft
> **PRD Reference**: `docs/00-pm/tool.prd.md`
> **Previous Plan**: `docs/01-plan/features/tool.plan.md` (v2, deprecated)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | WorkTool v2까지 자체 파이프라인 엔진(Director→Planner→Generator→Evaluator)을 직접 구현했으나, GSD와 Harness-100 등 오픈소스가 동일한 기능을 더 성숙하게 제공. 자체 엔진 유지보수 비용 대비 가치가 낮음 |
| **Solution** | 자체 오케스트레이션 엔진 5개 파일(~2000줄)을 삭제하고, GSD SDK의 프로그래밍 API로 교체. 프리셋은 Harness-100(200종)으로 확장. GUI 레이어와 SDK 채팅은 그대로 유지 |
| **Function/UX Effect** | 채팅(SDK 세션 유지) + 파이프라인 시각화(GSD 25종 이벤트) + 하네스 브라우저(200종 카드 탐색) + 일정/히스토리 관리. 사용자 경험은 동일하되 엔진 안정성 향상 |
| **Core Value** | "엔진은 오픈소스, GUI는 우리 것" — 바퀴를 재발명하지 않고 Claude Code 에코시스템의 시각적 프론트엔드로 포지셔닝 |

---

## 1. Overview

### 1.1 Purpose

Session 1~5에서 직접 구현한 오케스트레이션 엔진을 오픈소스 대체재로 교체하여:

1. **유지보수 비용 제거** — 자체 파이프라인 엔진 디버깅/개선 부담 해소
2. **기능 성숙도 확보** — GSD의 웨이브 병렬실행, 원자적 커밋, 컨텍스트 관리 활용
3. **프리셋 확장** — 자체 5종 → Harness-100의 200종(10개 도메인 카테고리)
4. **핵심 차별점 집중** — GUI 시각화와 사용자 경험에만 집중

### 1.2 Background

- GSD (`get-shit-done`): CLI 기반 메타프롬프팅 시스템. SDK 디렉토리에 프로그래밍 API 제공
- Harness-100: 100개 도메인별 하네스 프리셋 x 2언어(한/영). `.claude/` 폴더 복사로 적용
- 두 프로젝트 모두 `@anthropic-ai/claude-agent-sdk` 기반 — 우리 `sdk-chat.ts`와 동일 기술

### 1.3 Related Documents

- PRD: `docs/00-pm/tool.prd.md`
- Previous Plan v2: `docs/01-plan/features/tool.plan.md`
- GSD Repo: `C:/GameMaking/get-shit-done/`
- Harness-100 Repo: `C:/GameMaking/harness-100/`
- HANDOFF: `HANDOFF.md`

---

## 2. Scope

### 2.1 In Scope

- [ ] GSD SDK 빌드 및 Electron main에서 import
- [ ] `gsd-bridge.ts` — GSD SDK 래퍼 (파이프라인 실행 + 이벤트 전달)
- [ ] `gsd-status-parser.ts` — GSD 이벤트 → UI 이벤트 변환
- [ ] `harness-manager.ts` — Harness-100 카탈로그 인덱싱 + 적용
- [ ] 하네스 브라우저 UI (카테고리별 카드, 검색, 적용)
- [ ] 기존 OrchestrationPage를 GSD 이벤트에 연결
- [ ] 자체 엔진 파일 삭제 (pipeline.ts, director-agent.ts, smart-orchestrator.ts, prompt-assembler.ts)
- [ ] SDK 채팅 유지 (sdk-chat.ts 변경 없음)

### 2.2 Out of Scope

- GSD 코드 자체 수정 (업스트림은 건드리지 않음)
- Harness-100 콘텐츠 수정 (그대로 사용)
- 새로운 UI 페이지 추가 (기존 페이지 재활용)
- 모바일/웹 버전

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | GSD SDK를 Electron main에서 ESM dynamic import로 로드 | High | Pending |
| FR-02 | `gsd.runPhase()` 호출로 파이프라인 실행 | High | Pending |
| FR-03 | GSD 25종 이벤트를 IPC로 renderer에 전달 | High | Pending |
| FR-04 | HumanGateCallbacks → UI 다이얼로그 연결 (승인/거절/수정) | High | Pending |
| FR-05 | Harness-100 카탈로그 JSON 인덱스 빌드타임 생성 | High | Pending |
| FR-06 | 하네스 선택 → `.claude/` 복사로 프로젝트에 적용 | High | Pending |
| FR-07 | 하네스 브라우저 UI (10개 카테고리, 검색, 한/영 전환) | Medium | Pending |
| FR-08 | GSD `.planning/` 상태 파일 읽어서 진행률 표시 | Medium | Pending |
| FR-09 | 파이프라인 일시정지/중단 (GSD SDK abort) | Medium | Pending |
| FR-10 | SDK 채팅 세션 유지 (기존 sdk-chat.ts 그대로) | High | Done |
| FR-11 | 비용 추적 (GSD CostUpdate 이벤트 활용) | Low | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | GSD 이벤트 → UI 반영 < 100ms | 이벤트 타임스탬프 비교 |
| Reliability | GSD SDK import 실패 시 에러 메시지 표시 | 수동 테스트 |
| Bundle Size | GSD SDK + 하네스 인덱스 추가로 인한 증가 < 5MB | 빌드 후 측정 |

---

## 4. Architecture

### 4.1 변경 전후 비교

```
[변경 전 — 자체 엔진]
renderer (UI) → IPC → main/orchestrator/ → cli-bridge.ts → claude --print
                            ├── pipeline.ts (자체 루프)
                            ├── director-agent.ts (자체 AI 판단)
                            ├── smart-orchestrator.ts (자체 실행 분배)
                            └── prompt-assembler.ts (자체 프롬프트 조립)

[변경 후 — GSD + Harness-100]
renderer (UI) → IPC → main/gsd-bridge.ts → GSD SDK → claude-agent-sdk
                       ├── gsd.runPhase() (GSD가 파이프라인 관리)
                       ├── onEvent() → IPC 전달 (25종 이벤트)
                       └── HumanGateCallbacks (UI 승인 다이얼로그)
                      main/harness-manager.ts → Harness-100 카탈로그
                       ├── 인덱스 JSON 로드
                       └── .claude/ 복사 적용
                      main/agent-runner/sdk-chat.ts (변경 없음)
                       └── 자유 채팅, 세션 유지
```

### 4.2 파일 변경 맵

| 파일 | 액션 | 설명 |
|------|------|------|
| `src/main/orchestrator/pipeline.ts` | **삭제** | GSD `runPhase()` 대체 |
| `src/main/orchestrator/director-agent.ts` | **삭제** | GSD orchestrator 대체 |
| `src/main/orchestrator/smart-orchestrator.ts` | **삭제** | GSD PhaseRunner 대체 |
| `src/main/orchestrator/phase-coach.ts` | **삭제** | GSD 단계 관리 대체 |
| `src/main/agent-runner/prompt-assembler.ts` | **삭제** | 하네스 .md 파일 대체 |
| `src/main/agent-runner/guideline-generator.ts` | **삭제** | 하네스에 포함 |
| `src/main/agent-runner/cli-bridge.ts` | **축소** | 레거시 호환용 최소 유지 또는 삭제 |
| `src/main/orchestrator/decision-requester.ts` | **수정** | GSD HumanGateCallbacks 연결 |
| `src/main/agent-runner/sdk-chat.ts` | **유지** | 채팅 세션 그대로 |
| `src/main/gsd-bridge.ts` | **신규** | GSD SDK 래퍼 |
| `src/main/gsd-status-parser.ts` | **신규** | GSD 이벤트 → UI 이벤트 변환 |
| `src/main/harness-manager.ts` | **신규** | Harness-100 카탈로그/적용 |
| `src/main/preset/preset-manager.ts` | **수정** | harness-manager로 위임 |
| `src/main/index.ts` | **수정** | IPC 핸들러 교체 (GSD/하네스) |
| `src/renderer/pages/OrchestrationPage.tsx` | **수정** | GSD 이벤트 구독으로 전환 |
| `src/renderer/pages/ChatPage.tsx` | **유지** | 변경 없음 |
| `src/renderer/components/AgentCard.tsx` | **수정** | 하네스 에이전트 정보 표시 |
| `src/renderer/components/HarnessBrowser.tsx` | **신규** | 하네스 카탈로그 브라우저 |
| `src/shared/types.ts` | **수정** | GSD 이벤트 타입 추가 |
| `resources/presets/` | **삭제** | Harness-100으로 교체 |

### 4.3 두 트랙 구조

| | 채팅 트랙 | 파이프라인 트랙 |
|---|---|---|
| **용도** | 클로드와 1:1 자유 대화 | 자동 프로젝트 빌드 |
| **엔진** | sdk-chat.ts (기존) | gsd-bridge.ts (신규) |
| **세션** | 프로젝트별 연속 세션 (resume) | GSD 내부 관리 |
| **UI** | ChatPage.tsx (기존) | OrchestrationPage.tsx (수정) |
| **하네스** | 불필요 | 프로젝트에 .claude/ 적용 |

### 4.4 GSD SDK 연동 상세

```typescript
// gsd-bridge.ts 핵심 구조
import { GSD, GSDEventType } from '@gsd-build/sdk';

class GsdBridge extends EventEmitter {
  private gsd: GSD;

  async startPhase(phaseNumber: string, projectDir: string) {
    this.gsd = new GSD({ projectDir });

    // 이벤트 → IPC 전달
    this.gsd.onEvent((event) => {
      this.emit('gsd-event', event);
    });

    // 파이프라인 실행 + UI 승인 연결
    const result = await this.gsd.runPhase(phaseNumber, {
      callbacks: {
        onDiscussApproval: async (ctx) => {
          // UI 다이얼로그 띄우고 사용자 응답 대기
          return await this.requestUserApproval('discuss', ctx);
        },
        onVerificationReview: async (result) => {
          return await this.requestUserApproval('verify', result);
        },
      },
      model: 'claude-sonnet-4-6',
    });

    return result;
  }

  // 상태 조회 (.planning/ 파일)
  async getStatus(projectDir: string) {
    const tools = GSD.createTools(projectDir);
    return await tools.roadmapAnalyze();
  }
}
```

### 4.5 Harness-100 연동 상세

```typescript
// harness-manager.ts 핵심 구조
interface HarnessEntry {
  id: string;           // "05-game-narrative"
  number: number;       // 5
  category: string;     // "Content Creation"
  name: { en: string; ko: string };
  description: { en: string; ko: string };
  agents: string[];     // ["worldbuilder", "quest-designer", ...]
  skills: string[];
}

class HarnessManager {
  private catalog: HarnessEntry[] = [];
  private basePath: string;  // C:/GameMaking/harness-100

  // 빌드타임 또는 첫 실행 시 카탈로그 생성
  async buildCatalog(): Promise<HarnessEntry[]> {
    // ko/, en/ 디렉토리 스캔 + frontmatter 파싱
  }

  // 하네스 적용 = .claude/ 복사
  async applyHarness(harnessId: string, projectDir: string, lang: 'ko' | 'en') {
    const src = path.join(this.basePath, lang, harnessId, '.claude');
    const dest = path.join(projectDir, '.claude');
    fs.cpSync(src, dest, { recursive: true });
  }

  // 카테고리별 검색
  search(query: string): HarnessEntry[] { ... }
}
```

---

## 5. Implementation Order

### Phase 0~4: 백엔드 피벗 ✅ (Session 7 완료)

- [x] vendor/ 번들링 (GSD SDK + Harness-100, 14MB)
- [x] gsd-bridge.ts, harness-manager.ts 신규 생성
- [x] index.ts: GSD 6개 + Harness 6개 IPC 핸들러
- [x] chat:send / discovery:chat SDK 전환 (CLI 폴백)
- [x] 자체 엔진 9파일 + resources/presets/ 삭제
- [x] E2E 감사 17항목 전부 통과
- [x] 빌드 3/3 성공

### Phase 5: UI 플로우 재설계 (다음 세션)

핵심 변경: **채팅 탭 제거 → 파이프라인 + 채팅 통합 뷰**

1. 프로젝트 생성 플로우 교체
   - 기존: 프리셋 선택 → Discovery 대화 → SpecCard → 에이전트 팀 구성
   - 변경: 하네스 브라우저에서 선택 → .claude/ 자동 적용 → 완료
2. 파이프라인 + 채팅 통합 레이아웃
   - 좌측: GSD 파이프라인 단계 진행 (discuss→plan→execute→verify)
   - 우측: 현재 활성 단계의 채팅 세션
3. 단계별 독립 세션
   - 각 GSD phase마다 별도 SDK 세션
   - 세션 시작 시 이전 phase의 .planning/ 산출물을 context로 주입 (handoff)
4. 네비게이션 정리
   - 채팅 탭 제거 (파이프라인에 통합)
   - 하네스 브라우저를 프로젝트 생성 플로우에 통합

### Phase 6: 하네스 적용 + GSD init 연결

5. 하네스 선택 → applyHarness() → GSD init → .planning/ 생성
6. GSD initProject()로 PROJECT.md, ROADMAP.md 자동 생성
7. 이후 runPhase()로 단계별 실행

### Phase 7: 최종 정리

8. 레거시 UI 컴포넌트 삭제 (PhaseCoachBanner, SmartInputForm 등)
9. 레거시 프리셋/Discovery 관련 코드 정리
10. 통합 테스트 + 빌드 확인

---

## 6. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| GSD SDK `dist/` 빌드 실패 | High | Medium | SDK 소스를 직접 번들러로 포함하거나, CLI 폴백 |
| GSD SDK ESM + Electron CJS 충돌 | Medium | Medium | `await import()` 패턴 (sdk-chat.ts에서 검증됨) |
| GSD `gsd-tools.cjs` 경로 문제 | Medium | High | 설치 스크립트로 `~/.claude/get-shit-done/bin/`에 배치 |
| Harness-100 구조 변경 (업스트림) | Low | Low | 특정 커밋 고정 또는 포크 |
| GSD SDK가 API 키 요구 | Medium | High | claude-agent-sdk 구독 플랜으로 해결 (기존과 동일) |

---

## 7. Success Criteria

### 7.1 Definition of Done

- [x] GSD SDK를 Electron에서 import 가능
- [x] Harness-100 카탈로그 로드 (200종)
- [x] 자체 엔진 파일 전부 삭제 완료
- [x] `npx electron-vite build` 성공
- [x] E2E 감사 17/17 통과
- [ ] 하네스 선택 → 프로젝트에 적용 → GSD init (UI 플로우)
- [ ] 파이프라인 + 채팅 통합 뷰 (단계별 세션)
- [ ] GSD 파이프라인 실행 → 실시간 UI 표시
- [ ] HumanGate → UI 승인 다이얼로그

### 7.2 Quality Criteria

- [x] 삭제된 코드 > 신규 코드 (순 코드량 감소)
- [x] 빌드 에러 없음
- [ ] 전체 플로우 수동 테스트 통과 (하네스 → 파이프라인 → 채팅)

---

## 8. Next Steps

1. [ ] Phase 5: UI 플로우 재설계 (파이프라인 + 채팅 통합)
2. [ ] Phase 6: 하네스 → GSD init 연결
3. [ ] Phase 7: 레거시 UI 정리

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-02 | Initial draft — GSD + Harness-100 피벗 | User + Claude |
| 0.2 | 2026-04-02 | Phase 0~4 완료 반영 + Phase 5~7 추가 (파이프라인+채팅 통합 UX) | User + Claude |
