# Design-Implementation Gap Analysis: Dynamic Harness

> **Feature**: dynamic-harness (에이전트 풀 기반 동적 하네스 조합)
> **Design**: `docs/02-design/features/dynamic-harness.design.md`
> **Date**: 2026-04-02
> **Match Rate**: 96%
> **Verdict**: PASS

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Items Checked | 66 |
| Matches | 63 |
| Missing | 1 (cache, low impact) |
| Deviations | 2 (functionally equivalent) |
| Enhancements | 3 |
| **Match Rate** | **96%** |

---

## Category Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Phase A: Agent Pool .md Files (21) | 100% | PASS |
| Phase B: Backend (Types + Manager + IPC) | 98% | PASS |
| Phase C: Discovery Flow Changes | 93% | PASS |
| Phase D: Build Config | 100% | PASS |
| Deleted Files Verification | 100% | PASS |

---

## Detailed Comparison

### Section 2: Agent .md Files
- 21/21 files with correct frontmatter (name, displayName, icon, description, tags, category, trigger, model)
- core/4, game/12, web/5 all match design spec
- Minor: combat-designer.md has extra `combat` tag (enhancement)

### Section 2.3: PoolAgent Type
- 12/12 fields match exactly in `src/shared/types.ts`
- Enhancement: `PoolRecommendation` added as named interface

### Section 3: AgentPoolManager
- 5/6 methods match: constructor, buildIndex, getAll, recommend, applyAgents
- Missing: `.agent-pool-cache.json` cache (design mentioned, not implemented)
- Enhancement: Korean game indicators added to domain detection

### Section 4: IPC Interface
- 3/3 IPC handlers match (get-all, recommend, apply)
- 3/3 Preload API methods match

### Section 5: Discovery Flow
- Phase enum: `"chat" | "review" | "team_setup" | "confirmed"` -- MATCH
- Initial phase `"chat"` -- MATCH
- confirmSpec() uses IPC agent-pool:recommend -- MATCH
- goBack() stops at chat -- MATCH
- Deviation: `setRecommendedAgents` inlined in confirmSpec (functionally equivalent)
- Deviation: AgentTeamSetup uses CatalogAgent adapter instead of direct PoolAgent import (works correctly)

### Section 6: Electron Bundling
- extraResources agent-pool -- MATCH
- Dev/packaged path resolution -- MATCH

### Section 8: Deleted Files
- `agent-catalog.ts` -- CONFIRMED DELETED
- `HarnessSelectStep.tsx` -- CONFIRMED DELETED

---

## Gaps

### Missing (1)

| # | Item | Impact | Action |
|---|------|--------|--------|
| 1 | `.agent-pool-cache.json` cache | Low (21 files scan is fast) | Backlog |

### Deviations (2, functionally equivalent)

| # | Design | Implementation | Impact |
|---|--------|----------------|--------|
| 1 | `setRecommendedAgents` separate action | Logic inlined in `confirmSpec()` | None |
| 2 | `AgentTeamSetup` imports `PoolAgent` directly | Uses `CatalogAgent` adapter from `discovery-store` | None |

### Enhancements (3)

| # | Item | Description |
|---|------|-------------|
| 1 | `PoolRecommendation` named type | Design used inline return; impl adds reusable interface |
| 2 | Extended game indicators | Korean terms + more genres in domain detection |
| 3 | combat-designer extra tag | Added `combat` tag beyond design spec |

---

## Conclusion

Match Rate 96% >= 90% threshold. All core functionality implemented as designed.
No corrective iteration needed. Ready for completion report.
