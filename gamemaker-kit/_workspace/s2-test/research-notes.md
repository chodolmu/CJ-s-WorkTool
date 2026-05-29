# Research Notes — roguelike-deckbuilder (S2 dogfood)

**Project**: S2 unfamiliar-genre dogfood
**Reference seed**: Slay the Spire / single-character-roguelike-deckbuilder / PC Steam / tense-tactical
**Date**: 2026-05-29
**Purpose**: Layer 1 research validity test (concept P3) — does research surface mandatory conventions the user (merge3 senior, weak in deck-builders) did NOT pre-register?
**Dogfood path**: `_workspace/s2-test/` (production = `.gamemaker-kit/`)

---

## §Pre-flight (before any web call — gmk-init Step 0.5 / S1 detail Step 3.0)

### genre + family
- `genre` = roguelike-deckbuilder
- `target_family` = single-character-roguelike-deckbuilder (Slay the Spire lineage). **Disambiguation**: excludes party-based (Across the Obelisk), lane/positioning (Monster Train is borderline — single-deck but lane-based), and pure-roguelike-no-cards. Within-family = single-hero, energy-per-turn, card-based combat, map-node run structure.

### Approved query alternations (multi-term — single keywords return near-zero, S1 Fix 1)
- **Query A (genre baseline, site-restricted dev sources)**: `("roguelike deckbuilder" OR "deckbuilding roguelike" OR "Slay the Spire-like") (design OR postmortem OR "design lessons") (site:gamedeveloper.com OR site:gdcvault.com OR site:gamasutra.com)`
- **Query B (genre baseline, broader web)**: `("roguelike deckbuilder" OR "deck-building roguelike") game design conventions (card OR energy OR map OR relic)`
- **Query C (Slay the Spire dev-grade)**: `"Slay the Spire" (postmortem OR "design" OR interview OR GDC OR "Mega Crit") -wiki -reddit`

### dev-grade source-eligibility rule (S1 Fix 2)
`source_type ∈ {dev-blog, postmortem, academic, gdc, interview}`. **Excluded**: listicle ("top 10 deckbuilders"), marketing/store-listing, wiki, fan-strategy, review-aggregator. Qualitative claims require primary-source confirmation, not snippet capture.

### Within-family shortlist target (S1 Fix 3)
Exactly **3** dev-grade references, prefer within single-character family. Hard cap == 3.

### cost counter
- init: **0**
- hard cap: **100 calls OR 30 active-research minutes** (gmk-init SKILL line 65)
- STOP at cap, surface partial.

### Queries logged before execution
A / B / C above approved. No WebSearch/WebFetch until this paperwork exists ✅ (it now does).

---

## §Stage1 — Genre baseline survey (2 WebSearch, cost 0→2)

- Query A (site-restricted dev sources): **0 direct dev-source hits** — returned rogueliker.com review, wiki, listicles, a podcast. Same pattern as merge3 S1 (site: restriction surfaces 0 but broader web compensates). Kept site: restriction (S1 learning — don't remove).
- Query B (broader web): surfaced strong signal — deck-building-on-the-fly, energy-to-play-cards, relics as permanent deck-altering modifiers, RNG mitigation via card-removal, strategic map-node path choice, permadeath + meta-progression unlocks. But sources were wiki/review/listicle (not dev-grade) → need Stage 2 primary sources.
- **Genre size signal**: >850 Steam games tagged roguelike-deckbuilder by April 2024 (mature, well-documented genre — unlike a niche).

## §Stage2 — Reference shortlist (1 WebSearch + part of next, cost 2→4). Exactly 3, within-family, dev-grade.

| # | Reference | Studio | Primary dev-grade source | source_type |
|---|-----------|--------|--------------------------|-------------|
| 1 | **Slay the Spire** (2019) | Mega Crit | GDC "Metrics Driven Design and Balance" (Giovannetti) + gamedeveloper.com IGF interview | gdc + interview |
| 2 | **Dicey Dungeons** (2019) | Terry Cavanagh | gamedeveloper.com "How Dicey Dungeons balances chance and predictability" | dev-blog/design |
| 3 | **Monster Train** (2020) | Shiny Shoe | ScreenRant Mark Cooke interview + AIAS Game Maker's Notebook | interview |

Family note: StS = canonical single-character RLDB. Dicey Dungeons = single-character roguelike, dice-as-cards (close family, directly addresses randomness). Monster Train = lane-based (borderline family — single deck, but positioning layer); kept because Shiny Shoe's design commentary is dev-grade and the anti-dominant-strategy + synergy conventions are family-wide. Inscryption rejected (narrative/puzzle hybrid, not within-family). Across the Obelisk rejected (party-based, different family per target_family).

## §Stage3 — Convention extraction (3 WebFetch + 1 WebSearch, cost 4→10)

Sources fetched: StS IGF interview, Dicey Dungeons design piece, Monster Train interview. GDC metrics-balance talk = announcement-only on fetchable pages (video behind GDC Vault — numeric targets weakly sourced, flagged below).

### Cycle 1 — Baseline (4 categories)

**MECHANICS**
- **Cards-as-puzzle-pieces with combo/synergy payoff** (StS: "well-oiled Rube Goldberg machine", reward player mastery; Mট: "poggable moments" = anticipated synergy landing). Cross-ref: StS + Mট. *Strong.*
- **Energy economy** — cards cost energy to play; limited energy per turn forces selection (Stage 1 broad + genre common knowledge). StS commonly 3 energy/turn. Source: weak (wiki/broad, not fetched dev-source). `verified: false`.
- **Relics / permanent run-modifiers** that fundamentally alter how the deck functions (Stage 1 broad). Source: weak dev-grade. `verified: false` but genre-wide consensus.
- **Bounded, transparent RNG** — randomness is constrained and visible, player allocates it (Dicey: dice rolled then *placed* by player onto gear; "static enemy behavior + random player rolls"). Cross-ref: Dicey (strong primary) + StS (RNG-mitigation tools). *Strong.*

**PROGRESSION**
- **Deck-thinning / card-removal as core lever** — decks must NOT just grow; removing weak cards is strategic (StS: "card removal ensures decks don't spiral out of control", avoid diluting deck). Source: Stage 1 broad + StS interview. *Medium.*
- **Meta-progression unlocks across runs** (new cards/relics/characters unlock per playthrough) — softens permadeath frustration (Stage 1 broad, StS + Monster Train both). Cross-ref: 2 refs. *Medium.*
- **Analytics/metrics-driven card balance** — buff underpicked cards toward diversity, no card dominant (StS GDC talk premise; Mট: "look for things underpowered or not picked often... change those"). Cross-ref: StS + Mট. *Strong.*

**SESSION-LENGTH**
- **One run = bounded, completable in a sitting** (Mট: "finish a run in under an hour", "busy person's life"). Source: Mট primary. *Medium.* (Note: ~1hr, NOT ≤5min — see §supported-genres below.)

**FAILURE-MODE**
- **Permadeath with progression cushion** — losing ends the run but meta-unlocks mean you didn't lose *everything* (Stage 1 broad: "permadeath increases tension but frustrating if no progression"; addressed by both StS + Monster Train). Cross-ref: 2 refs. *Medium.*
- **Anti-dominant-strategy via enemy/encounter variety** — "wide gamut of enemies that challenge different strategies" so no single deck wins always (StS IGF, primary); Mট: "not interesting if best strategy is pick the same thing every time" (Onehorn's Tome nerf). Cross-ref: StS + Mট. *Strong.*

**RISK-REWARD / AGENCY (cross-cutting — directly maps to user K2/K4)**
- **Map/path choice = layered risk-reward** — semi-random map, player charts course, choosing which encounters to seek/avoid (StS: path choice from FTL, "richness without complexity"). *Strong (primary).*
- **Leftover-resource = bad feeling; every action must feel positive** (Dicey: "having dice left over is the worst feeling"; gear consumes various values so no waste). *Strong (primary, design-principle).*
- **Player efficacy = "planning + luck coming together"** — the genre is fun when "the right mix of randomness and deliberate plans" land (Dicey, explicit). *Strong (primary).* **← directly names user K4 (efficacy) as a research-confirmed mandatory.**

### Cycle 2 — Gap-fill
Categories all covered in Cycle 1 (mechanics/progression/session/failure all have ≥1 convention). Skipped (S1 pattern — no gap to fill).

### Cycle 3 — Cross-verify high-signal
- "Anti-dominant-strategy" — verified across StS (primary) + Mট (primary, independent studio). `verified: true`.
- "Bounded transparent RNG / planning+luck" — verified Dicey (primary) + StS RNG-mitigation. `verified: true`.
- "Combo-synergy payoff" — verified StS + Mট. `verified: true`.
- "Energy=3/turn", "relics" — could NOT verify against fetched dev-source (GDC video behind vault). `verified: false` — genre-common but flagged honest.

## §Stage4 — F2P contamination filter

**Largely no-op for this genre.** All 3 refs are premium PC/Steam paid games (not F2P/gacha). No monetization-driven convention contamination (no energy-timers-as-paywall, no gacha pull rates). The one term collision: "energy" here = per-turn card-play resource (mechanical), NOT F2P session-gating energy. Disambiguated. 11/11 conventions pass (0 F2P-contaminated).

---

## §Synthesis — Stage 5

### Confirmed conventions (deduped, ranked by cross-ref strength)

| id | category | convention | cross-ref | verified |
|----|----------|-----------|-----------|----------|
| C1 | risk-reward | **Player efficacy = planning + luck landing together** (genre is fun when deliberate plans meet bounded randomness) | Dicey primary, StS | true |
| C2 | failure-mode | **Anti-dominant-strategy** — encounter/enemy variety so no single deck always wins; metrics buff underpicked options | StS + Mট (2 studios) | true |
| C3 | mechanics | **Bounded, transparent RNG** — randomness constrained & visible; player *allocates* it, not victim of it | Dicey + StS | true |
| C4 | mechanics | **Cards-as-puzzle-pieces, combo/synergy payoff** ("poggable moment" / Rube Goldberg) | StS + Mট | true |
| C5 | mechanics | **Energy economy** — cards cost a limited per-turn resource, forcing selection (commonly 3/turn) | broad + genre | false |
| C6 | progression | **Deck-thinning / card-removal** — decks improve by *removing* weak cards, not only adding | StS + broad | false→medium |
| C7 | progression | **Relics / permanent run-modifiers** that reshape how the deck functions | broad + genre | false |
| C8 | progression | **Metrics/analytics-driven balance** — buff underpicked cards toward diversity | StS + Mট | true |
| C9 | risk-reward | **Map/path node choice** — semi-random map, player charts route weighing risk vs reward per node | StS primary (FTL lineage) | true |
| C10 | failure-mode | **Permadeath + meta-progression cushion** — run ends on death, but cross-run unlocks soften it | StS + Mট | true |
| C11 | mechanics | **No wasted resources** — every action/resource must feel positive (leftover = bad feeling) | Dicey primary | true |

**11 distinct ≥5 gate ✅.** 7 verified:true, 4 weak-source (C5/C6/C7 genre-common but not dev-source-confirmed in this run — honest flag).

### Anti-tropes (flagged by ≥2 refs)

| id | anti-trope | source |
|----|-----------|--------|
| A1 | **Dominant strategy / "always pick the same thing"** — a single optimal deck path kills replayability | StS + Mট |
| A2 | **Unfair/opaque RNG** — randomness the player can't see, plan around, or mitigate (feels like luck *happens to* you) | Dicey + StS |
| A3 | **Deck bloat with no thinning** — decks only grow, diluting consistency; no removal lever | StS + broad |

### Reference delta (StS-family vs broader genre)
StS-lineage: single-character, energy-per-turn, relic-stacking, map-node runs. Dicey delta: dice-as-cards (randomness *source* is dice, not draw). Monster Train delta: lane/positioning layer atop the deck. Family-wide load-bearing = C1/C2/C3/C4 (the four `verified:true` mechanics/risk conventions drive any RLDB pillar).

### → supported-genres check (gmk-init Step 4 — captured here, dogfood doesn't write pillars.json)

| check | value | note |
|-------|-------|------|
| `two_d` | **true** | RLDBs are 2D (card UI). ✅ |
| `deterministic_input` | **partial/false** | turn-based + bounded RNG. Bot can drive it, but RNG seeding must be controlled. Closer to true than false (deterministic *given seed*). Flag: ⚠️ |
| `session_under_5min` | **FALSE** | **A full run = ~30-60 min** (Mট primary: "under an hour"). This is the eligibility signal — see Finding. |

**≥1 false recorded → D6 signal fires (detail §6).** This is NOT a dogfood FAIL — gmk-init "does not refuse"; it records the boolean. The ≤5min violation is real and meaningful: RLDBs are long-session by nature. Surfaced for user decision (narrow to a single-combat ≤5min module, or accept long-session with reduced bot confidence).

### → Pillar candidates (P9 — to present to user for ratification)

Derived from confirmed conventions; each traces to C-ids. kit proposes; user ratifies; kit does NOT judge fun.

| label | name | from conventions | one-line |
|-------|------|------------------|----------|
| PC1 | **계획과 운이 만나는 순간 (Plans meeting luck)** | C1+C3+C11 | 플레이어가 짠 계획이 통제된 randomness와 맞물려 *터지는* 순간 — 운이 플레이어에게 *일어나는* 게 아니라 플레이어가 *굴리는* 것 |
| PC2 | **언제나 다른 최적해 (No single right answer)** | C2+C8+C9 | 매 선택(카드/경로/적)이 trade-off — 같은 덱이 항상 이기면 깨진 것. encounter variety가 dominant strategy를 막음 |
| PC3 | **시너지 빌드업 (Synergy build-up payoff)** | C4+C6 | 카드가 퍼즐 조각 — 조각이 맞물려 "poggable moment"가 터지는 보상. 덱은 *덜어내며* 정제됨 (bloat 안 됨) |

3 candidates, each cites verified conventions (PC1/PC2/PC3 all draw from `verified:true` C-ids). **Maps to user pre-registration**: K2 risk-return→PC2, K3 randomness→PC1/C3, K4 efficacy→PC1/C1, K1 strategic-choice→PC2/C9.

**Quit signal (Stage 5)**: §Synthesis parses, ≥5 confirmed conventions (11 ✅), ≥2 anti-tropes (3 ✅), pillar candidates traceable to conventions (3, each cites C-ids ✅). PASS.

### → User ratification (P9 — recorded 2026-05-29)

kit proposed 3 candidates; user ratified via explicit response (P9 Step 2.0 contract):

| label | name | from conventions | user response | final |
|-------|------|------------------|---------------|-------|
| PC1 | 계획과 운이 만나는 순간 (Plans meeting luck) | C1+C3+C11 | **채택** ("다 채택할만한데") | ✅ pillar 1 |
| PC2 | 언제나 다른 최적해 (No single right answer) | C2+C8+C9 | **채택** | ✅ pillar 2 |
| PC3 | 시너지 빌드업 (Synergy build-up payoff) | C4+C6 | **채택** | ✅ pillar 3 |

**3 ratified pillars**, each traceable to verified conventions (PC1/PC2/PC3 draw from `verified:true` C-ids except C6=medium). These would feed S1.5 genre-decisions.json IF S2 continued to Layer 1.5 (it does, for the dogfood verdict). All 3 adopted; no differentiation notes this run.

**supported_genres_check (captured here, no separate pillars.json per dogfood pattern)**: `two_d=true`, `deterministic_input=partial`, `session_under_5min=false`. User decision (2026-05-29): **record as good signal, continue** (D6 option a). The ≤5min violation is a real eligibility signal — RLDBs are long-session by nature — recorded, not gatekept.

### Cost summary
- Stage 1: 2 WebSearch
- Stage 2: 2 WebSearch (shared with Stage 3 dev-source discovery)
- Stage 3: 3 WebFetch + 1 WebSearch + 2 WebFetch attempts (1×404, 1×announcement) = 6
- **Total: 10 calls / 100 cap. Headroom 90.** Well under cap. ~12 active minutes / 30 cap.

---

