# Handoff: S0 + 외부 리서치 동결 완료, S1 detail 작성 차례

**Generated**: 2026-05-29 00:30 KST
**Branch**: main
**Status**: ✅ **v1.0-α 진행 중. S0 완료 + 외부 리서치 5 critical gap 동결. 다음 = S1 detail 작성.**

---

## ⚠️ 다음 세션 Claude — 4-file read protocol (P8 + 리서치 동결본)

`v1.0-concept.md` §P8에 따라, 새 세션은 다음 4개 파일만 읽으면 *완전히 이어받음*:

1. **`_workspace/v1.0-concept.md`** (LOCKED v3) — 방향 + 8 원칙 (P1-P8)
2. **`_workspace/v1.0-resume.md`** — 현재 상태 + 다음 액션 + 사용자 결정 4개 대기 목록
3. **`_workspace/v1.0-research-distilled.md`** — 외부 prior art 5 critical gap (Codex 검증). S1+ detail이 cite하는 입력
4. **`_workspace/v1.0-detail-S1.md`** — *아직 없음, 다음 세션이 작성*

이 HANDOFF.md는 *맥락 요약*이지 진실의 원본은 아님. 충돌 시 위 4개 파일이 우선.

---

## Goal

사용자(시니어 게임 개발자, 1-2h/day, 회사 AX 분야)의 원래 동기:
> *"별다른 지시 없이도, 리서치를 통해, 게임다운 게임을, 스스로 계속, 입력 없이도 만들 수 있어야 한다."*

γ 자율 모델: **seed 1회 + 자율 진행 + playable build마다 1분 컨펌**.

**v1.0 = primary mode 변경** (LOCKED v3):
- 기존 v0.9: mechanic-validation 도구 (백지에서 시스템 새로 짜기)
- v1.0: **reference-clone-first 자율 게임 빌드** (검증된 레퍼런스 베끼고, 사용자가 차별화)

---

## 이번 세션 (2026-05-28 ~ 29)에서 한 일

### Phase 1: S0 실행 완료 (15분)
- archive/v0.10-auto-mode-wip 브랜치 생성 + push (8 파일, `a55397e`)
- main에서 v0.10 자산 정리 (git 자연 분리로 처리)
- `ddbfb9b` push (D-009 + D-011 fix)
- CHANGELOG/HANDOFF 갱신 + v1.0 산출물 5개 commit (`b6bc443`)
- `v1.0-resume.md` atomic write (`8bf68f8`)

### Phase 2: 외부 리서치 3-round (1-2시간)
- Round 1: 메모리 인덱스만 본 게으른 리서치 → 사용자 지적
- Round 2: 25 GitHub WebSearch + 18 WebFetch → 6 gap 후보
- Codex 검증: URL 정확, 가치 평가 부풀림 → 3 critical로 축소
- Round 3: Codex 지적 4 카테고리 보완 → 2 critical 추가 (PlayCoder, OpenGame)
- godogen README 직접 정독 → publish-render + stop-hook 발견

### Phase 3: 리서치 동결 + commit (`4f63293`)
- `_workspace/v1.0-research-distilled.md` 작성 — 5 critical gap + 7 pruned
- Cite-from-detail-plans 원칙 적용 (S1+ detail이 cite, 재리서치 금지)

### S0 + 리서치 학습 (S1 detail 작성에 반영)
- **archive 브랜치 commit 방식이 git 자연 분리로 main 정리 자동 처리** — Step 2 rm 불필요. S1+에서 git 자연-동작이 처리할 일은 절차에 박지 말 것.
- **외부 리서치 round 1 (메모리만) 항상 skip** — round 2 (진짜 WebSearch+WebFetch)부터 + Codex 검증 필수.
- **godogen 정독이 가장 큰 ROI 줌** — README 직접 읽는 게 subagent 요약보다 강함. 1순위 레포는 직접 정독.
- **PlayCoder + OpenGame이 v1.0 정합성 매우 높음** — `pillars.json` + milestone hypothesis가 그대로 "structured requirement spec" 역할.

---

## v1.0 Concept 핵심 8 원칙 (LOCKED v3)

| Principle | 한 줄 |
|-----------|------|
| P1 | genre-decisions는 machine-parseable (prose 금지) |
| P2 | Quit gate는 artifact-level (feeling-based 금지) |
| P3 | Dogfood 2개 (사용자 잘 아는 장르 + 모르는 장르) |
| P4 | Milestone = 분리 가능한 playable module 1개 |
| P5 | Check-in per playable build (.html 시각 컨펌) |
| P6 | JIT detail planning + backlog 체크리스트 통과 강제 |
| P7 | **Dispatch 위에 얹음** (자체 runner 짓지 않음, v0.10 코드 폐기) |
| P8 | Session continuity — resume.md + atomic write + verification 첫 sub-step |

## v1.0 4-Layer Architecture

```
사용자 seed (예: "merge3 / cozy / PC Steam / Royal Match 비슷한")
   ↓
Layer 1   — Autonomous Reference Research (WebSearch+WebFetch)
Layer 1.5 — Reference-to-Production Translation (genre-decisions.json, P1)
Layer 2   — Module-Based Milestone Execution (playable HTML build)
Layer 3   — Dispatch-based Mobile-Trigger Cycles (PC 켜둠, 모바일 트리거)
```

## Sequencing (S0-S7)

| Step | 무엇 | 상태 |
|------|------|------|
| S0 | v0.10 freeze (이번 세션 산출물 commit + archive 브랜치 보존) | ✅ **완료** |
| S1 | Layer 1 SKILL: gmk-init 재설계 | ⏳ 다음 — detail 작성 |
| S1.5 | Layer 1.5: genre-decisions schema + gmk-genre-decide SKILL | 대기 |
| S2 | 모르는 장르 mini-dogfood (Layer 1+1.5만) | 대기 |
| S3 | Layer 2 SKILL: gmk-module-build | 대기 |
| S4 | Check-in SKILL: gmk-confirm | 대기 |
| S5 | merge3 M1 full dogfood (local) | 대기 |
| **S6** | **Dispatch 통합** — PC background worker + Channel(Telegram/Discord) 설정 | 대기 |
| **S7** | **M2 dispatch dogfood** — 모바일 트리거 → PC 실행 → 모바일 컨펌 | 대기 |

---

## Next Session — 즉시 다음 액션

**S1 detail 작성** (`_workspace/v1.0-detail-S1.md`):
- S1 = Layer 1 — `gmk-init` 재설계 (autonomous reference research, WebSearch+WebFetch)
- 입력:
  - `v1.0-concept.md` §S1 + §P1-P8
  - `v1.0-detail-backlog.md` 체크리스트
  - `v1.0-research-distilled.md` §Gap 1-5 (cite, restate 금지)
  - `skills/gmk-init/SKILL.md` (현 279 LOC, 재설계의 입력 — 재활용 ~70% 가정)
  - S0 학습 + 리서치 학습 (resume.md에 박힘)
- 출력: 5-10 step numbered procedure + artifact-level quit signal 표 + fallback 4개

**사용자에게 물어야 할 결정 4개** (S1 detail 안에 각 옵션 분기 procedure까지):
1. Layer 1 WebSearch 패턴 — Codex 5-stage research vs 단순 1-stage
2. F2P contamination filter 강도 — 관대 / 보통 / 엄격
3. 3회 시도 정의 — 검색 3회 / 페이지 3개 / 시도 3-cycle?
4. genre-decisions 포맷 잠정 결정 — S1에서 잡고 갈지 S1.5로 미룰지

**S1 detail 작성 시 적용할 7원칙** (리서치 산출, resume.md에 정리됨):
Resume Verification First / User Decisions Up-Front / Cite-Don't-Restate / Step ID + Quit Signal / Atomic Write + HANDOFF as Last Step / Reuse-vs-New Ratio / One-Detail-At-A-Time

작성 후 사용자 컨펌 받고 S1 실행 시작.

---

## Current State

**Working**:
- `_workspace/v1.0-concept.md` LOCKED v3
- `_workspace/v1.0-detail-backlog.md` (8 detail plan 큐)
- `_workspace/v1.0-detail-S0.md` (✅ 실행 완료)
- `_workspace/v1.0-resume.md` (S0 완료 상태 기록)
- `main` 깨끗함 (v0.10 코드 없음, ddbfb9b 반영)
- `archive/v0.10-auto-mode-wip` remote 보존됨

**Pending (다음 세션)**:
- `_workspace/v1.0-detail-S1.md` 작성 (Layer 1 gmk-init 재설계 절차)

**Stale (touch 안 함, 우리 작업 무관)**:
- `.bkit/*` (3 파일)
- `../scripts/prepare-vendor.sh`
- 부모 폴더 변경 (`.agents/`, `.claude/`, `.codex/`, `AGENTS.md` 등)

---

## Files to Know

| File | 용도 |
|------|------|
| `_workspace/v1.0-concept.md` | **LOCKED v3 — 매 세션 시작 시 정독** |
| `_workspace/v1.0-resume.md` | 현재 위치 + 다음 액션 + 사용자 결정 4개 대기 (atomic write) |
| `_workspace/v1.0-research-distilled.md` | **외부 prior art 5 critical gap (Codex 검증). S1+ detail이 cite** |
| `_workspace/v1.0-detail-backlog.md` | Detail plan 큐 + 체크리스트 |
| `_workspace/v1.0-detail-S0.md` | S0 실행 절차 (완료, 역사적 기록) |
| `_workspace/v1.0-plan.md` | 초기 plan 349줄, 역사적 기록 |
| `_workspace/v1.0-plan-comparison.md` | 3 plan 비교 (Plan A/B/C) |

---

## Failed Approaches (Don't Repeat)

### 함정 1 — "OS-level Node runner 직접 짜기"
v0.10에서 `scripts/auto-runner.js` 880 LOC 짰음. *Claude Code Dispatch*가 같은 문제를 *이미 풂*. **v1.0 Layer 3은 Dispatch 위에 얹음**.

### 함정 2 — "procedural confidence without executable contracts"
올바른 게이트 이름은 부르지만 *기계 검사 가능한 계약*으로 만들지 않음. 방어: P1 + P2 + P8.

### 함정 3 — "Concept-detail mixed plan"
초기 349줄 plan이 concept과 detail 섞임. **TaskForge Pro JIT 패턴 차용** = concept LOCK + detail JIT.

### 함정 4 — "Mechanic-validation as primary mode"
v0.9까지 kit은 백지에서 mechanic 도출. v1.0 = reference-clone-first.

### 함정 5 — "사용자 잘 아는 장르로만 dogfood"
사용자가 merge3 시니어라 *Layer 1 research 부실해도 머릿속이 채움*. **방어: dogfood 2개**.

### 함정 6 — "Session continuity = 자동으로 풀림 가정"
LOCKED v1까지 *세션 한계*를 plan이 모르고 있었음. **방어: P8 + Resume Verification Rule + atomic write**.

### 함정 7 — "Iteration N은 항상 더 좋음"
검증 사이클 추가하고 싶어지면 *진짜 추가 정보 있는지* 자문 후 결정.

---

## Key Decisions (이번 세션)

| Decision | Rationale |
|----------|-----------|
| S0 결정 1: `ddbfb9b` 지금 push | v1.0의 secondary validation에 바로 필요 |
| S0 결정 2: archive 브랜치 = `archive/v0.10-auto-mode-wip` | 명시적, 다른 archive 브랜치와 정합 |
| S0 결정 3: CHANGELOG/HANDOFF만 commit, stale touch X | bkit은 우리 책임 아님 |

---

## Warnings

- **`v1.0-concept.md` LOCKED v3 — 변경 금지**. 변경하려면 *concept-level 누락 발견* 명시 + RE-OPEN.
- **3-file read protocol 지킬 것** (concept + resume + current detail).
- **`v1.0-detail-S1.md`의 Step 0 (Resume Verification)을 *반드시* 설계 + 실행** — P8 critical rule.
- **Atomic write 지킬 것** — write-temp-then-rename. resume.md 갱신 시 특히.
- **사용자가 Claude 구독 해지 + Codex 이탈 고민 중**. *"거의 됐어 한 phase 더만"* 금지. quit gate에서 *진짜로* 멈출 것.
- **dogfood validity threat** — 사용자가 merge3 너무 잘 안다는 사실 *기억*. S2 unfamiliar genre가 *진짜 Layer 1 검증*.
- **Dispatch는 PC 켜져있어야 함** (S6 이후 적용).
- **Stale 변경 (`.bkit/*`, `scripts/prepare-vendor.sh`, 부모 폴더) commit 금지** — 이 작업과 무관.

---

## End of Session Summary

이번 세션:
- Phase 1: S0 (v0.10 freeze) 완료
- Phase 2: 외부 리서치 3-round (25 GitHub WebSearch + Codex 검증 + 4 카테고리 보완 + godogen 정독)
- Phase 3: `v1.0-research-distilled.md` 동결 commit (`4f63293`)
- Phase α (이 변경 묶음): resume.md + HANDOFF.md 갱신 + push

다음 세션은:
1. 4-file read protocol: concept + resume + **research-distilled** + (작성될) detail-S1
2. S1 detail 작성 (`v1.0-detail-S1.md`) — 사용자 결정 4개 분기 포함
3. 사용자 컨펌 후 S1 실행 시작

수고하셨습니다.
