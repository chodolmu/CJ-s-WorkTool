# S2 Dogfood Verdict — roguelike-deckbuilder (Layer 1 validity test)

**Date**: 2026-05-29 20:45 KST
**Genre**: roguelike-deckbuilder (unfamiliar — user is merge3 senior, weak in deck-builders)
**PASS 기준 (detail D2, M2-pinned)**: research가 사전 등록(K1-K4)에 *없던* **artifact-mandatory** convention(`acceptance != null` OR anti-trope 대척점)을 ≥1개 surface하면 PASS. 사용자 인정은 evidence이지 gate 아님 (P2).

---

## VERDICT: **PASS** ✅

Layer 1 research가 사용자 사전 지식(player-experience aesthetic 4개)을 **mechanic-level convention으로 능가**함. multiple artifact-mandatory SURFACED-UNKNOWN. concept §5 S2 quit signal 충족 — "research가 사용자가 모르던 convention을 surface".

---

## Pre-registration baseline (K1-K4, research 전 사용자 발화)

| K | 사용자가 적은 것 | 성격 |
|---|------|------|
| K1 | 전략적 선택의 자유 | aesthetic |
| K2 | 리스크와 리턴 | aesthetic |
| K3 | 운적인 요소 | system property |
| K4 | 선택에 대한 효능감 | aesthetic |

전부 *왜 재밌는가*(aesthetic) 레벨. *어떻게 구현되는 관습*(mechanic-level)은 0개.

## Classification: research-surfaced conventions × KNOWN / SURFACED-UNKNOWN

| conv | statement (요약) | 분류 | artifact-mandatory? | 사용자 인정 (evidence) |
|------|------|------|---------------------|----------------------|
| C1 | efficacy = plans+luck | **KNOWN** | — | (= K3+K4) |
| C2 | anti-dominant via encounter variety + metrics | **SURFACED-UNKNOWN** | ✅ **A1 대척점** | ✅ 인정 |
| C3 | bounded transparent RNG (player allocates) | borderline (K3는 "운 있음"만; bounded/allocate는 surfaced) | ✅ **A2 대척점** | — |
| C4 | cards-as-puzzle combo payoff | **SURFACED-UNKNOWN** | (qualitative) | — |
| C5 | energy economy (3/turn) | **SURFACED-UNKNOWN** | ✅ **`acceptance != null`** (energy_per_turn==3) | ✅ 인정 |
| C6 | deck-thinning / card-removal | **SURFACED-UNKNOWN** | ✅ **A3 대척점** | ✅ 인정 |
| C7 | relics / permanent modifiers | **SURFACED-UNKNOWN** | (qualitative) | ✅ 인정 |
| C8 | metrics-driven balance | **SURFACED-UNKNOWN** | (qualitative) | — |
| C9 | map-node path choice | **SURFACED-UNKNOWN** | (qualitative) | (asked, not selected) |
| C10 | permadeath + meta-progression | **SURFACED-UNKNOWN** | (qualitative) | — |
| C11 | no wasted resources | **SURFACED-UNKNOWN** | (qualitative) | ✅ 인정 |
| C12 | run ~30-60min (NOT ≤5min) | **SURFACED-UNKNOWN** | ✅ **`acceptance != null`** (run_length range) | — |

## Gate evaluation (artifact-pinned, M2)

**SURFACED-UNKNOWN with artifact-mandatory proxy** (the gate):
- **C5** — `acceptance != null` (energy_per_turn == 3) ✅
- **C12** — `acceptance != null` (run_length range [30,60]) ✅
- **C2** — anti-trope A1 대척점 (dominant-strategy) ✅
- **C3** — anti-trope A2 대척점 (opaque RNG) ✅
- **C6** — anti-trope A3 대척점 (deck bloat) ✅

**5 artifact-mandatory SURFACED-UNKNOWN ≥ 1 → PASS.** (Gate met by pure-machine proxy `acceptance != null` alone via C5/C12, before even counting anti-trope counterparts.)

**Corroborating evidence (not gate)**: user explicitly acknowledged C6, C2, C5/C7/C11 as "important but not in my pre-registration." User acknowledgment aligns with artifact gate — but per M2, even if the user had shrugged, C5/C12's `acceptance != null` would carry PASS alone.

## Why this is a real validity result (not false PASS)

- Pre-registration was captured **before** any web call (D5 ordering guard enforced — Step 2 refused entry without known-conventions.md). No hindsight backfill possible.
- User's 4 pre-registered items were all *aesthetics*; research returned the *mechanics that produce those aesthetics* (e.g. K1 "strategic choice" → C9 map-node + C2 encounter-variety as the mechanism). This is exactly the gap P3 predicts a genre-expert would silently fill — here the user is NOT an expert, so the gap was real and research filled it visibly.
- Contrast with merge3 (S1): the user is a merge3 senior, so S1 tested *workflow*, not research validity. S2 is the first run where research had to actually exceed user knowledge — and it did.

## 학습 (다음 step / kit 개선 반영)

- **Layer 1이 unfamiliar 장르에서 진짜 작동** — site:-restricted dev-source query는 0건이었지만(merge3와 동일 패턴) broader-web + dev-source 후속 검색으로 dev-grade 3 refs 확보. multi-term query(S1 Fix 1)가 여기서도 필수였음.
- **장르별 dev-source 밀도**: roguelike-deckbuilder는 merge3보다 dev-grade 1차 자료 풍부 (GDC talk + gamedeveloper.com design pieces + 개발자 인터뷰 다수). 단 GDC Vault 영상은 fetch 불가 → 숫자 convention(energy=3/turn)은 weak-source라 `verified:false` 정직 플래그. **kit 개선 신호**: 숫자 convention이 영상 뒤에 숨으면 Layer 1이 못 긁음 — gmk-init Stage 3에 "numeric convention은 transcript/2차 텍스트 소스 추가 검색" sub-step 후보 (S1 RE-OPEN 아니라 별도 patch, concept P6 JIT).
- **supported-genres gate가 실제로 신호를 냄** — session_under_5min=false가 정확히 잡힘 (RLDB는 long-session). gmk-init "do not refuse"가 의도대로 작동(기록만). D6 분기가 실전에서 유효함을 실증.
- **dogfood path substitution(D7) + intermediate commit이 매끄럽게 작동** — gmk-genre-decide commit-gate를 Step 2.7 intermediate commit으로 통과. SKILL 편집 0 (D5 유지).
- **cost 10/100, ~12min/30** — Layer 1+1.5 전체가 cap의 1/10. 헤드룸 충분. 자율 진행 시 비용 걱정 낮음.

## Cost
WebSearch 5 + WebFetch 5 (1×404, 1×announcement) = 10 calls / 100. ~12 active min / 30.

**Artifact quit signal (Step 4 = S2 전체)**: ✅ dogfood-verdict.md 존재 + PASS 명시 + surfaced-unknown artifact-mandatory ≥1 (C5/C12 `acceptance!=null` + C2/C3/C6 anti-trope 대척점) + 사용자 인정 evidence 기록.
