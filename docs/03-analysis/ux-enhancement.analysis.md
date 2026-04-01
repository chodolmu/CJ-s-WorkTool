# Gap Analysis: UX Enhancement

**Date**: 2026-03-31
**Design**: `docs/02-design/features/ux-enhancement.design.md`

## Overall Match Rate: 97% (after fixes)

| Feature | Initial | After Fix | Status |
|---|:---:|:---:|:---:|
| Dashboard 강화 | 100% | 100% | PASS |
| Worker Agent | 100% | 100% | PASS |
| Phase Coach | 87% | 100% | PASS |
| Smart Input | 83% | 100% | PASS |

## Gaps Found & Fixed

| # | Gap | Impact | Fix |
|---|---|---|---|
| 1 | `smart-input:respond` IPC 핸들러 누락 | High | index.ts에 핸들러 추가 |
| 2 | `phase:coach-respond` IPC 핸들러 누락 | High | index.ts에 핸들러 추가 |
| 3 | Orchestrator `agent_status` broadcast 누락 | Medium | initServices()에 이벤트 연결 추가 |

## Design Deviations (Accepted)

| # | 항목 | Design | Implementation | 판단 |
|---|---|---|---|---|
| 1 | PhaseCoachBanner | onAction만 | onDismiss 추가 | 개선 (AUTO 레벨 자동 닫기) |
| 2 | SmartInputForm onSubmit | SmartInputResponse 래퍼 | Record<string,string> 직접 | 단순화 — ChatPage에서 래핑 |
| 3 | Phase Coach 통합 | 별도 emitPhaseCoach() | advancePhase() 내부 | 캡슐화 개선 |

## Files Changed (18 total)

**신규 (3)**:
- `src/main/orchestrator/phase-coach.ts`
- `src/renderer/components/PhaseCoachBanner.tsx`
- `src/renderer/components/SmartInputForm.tsx`

**Worker YAML (5)**:
- `resources/presets/{game,api-server,desktop,mobile,webapp}/agents/worker.yaml`

**수정 (10)**:
- `src/shared/types.ts`
- `src/main/orchestrator/pipeline.ts`
- `src/main/orchestrator/smart-orchestrator.ts`
- `src/main/orchestrator/director-agent.ts`
- `src/main/index.ts`
- `src/renderer/stores/app-store.ts`
- `src/renderer/hooks/useIpcEvents.ts`
- `src/renderer/components/AgentCard.tsx`
- `src/renderer/pages/ChatPage.tsx`
