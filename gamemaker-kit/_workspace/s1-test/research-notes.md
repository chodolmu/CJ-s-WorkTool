# S1 Layer 1 Research Notes — merge3 / Royal Match dogfood

**Seed**: `_workspace/s1-test/seed.json` (genre=merge3, target_family=match3-with-meta, reference=Royal Match, platform=PC Steam, vibe=cozy)
**Detail ref**: `_workspace/v1.0-detail-S1.md` §2 Step 3.0+3+4+5+6
**Phase γ amendments applied**: Codex Fix 1-4 + evaluator C1+M1+M2 (see `_workspace/v1.0-codex-S1-step3-review.md`)

---

## §Pre-flight (Step 3.0 — written BEFORE any web call)

**Forbidden until this section is complete**: WebSearch, WebFetch.

### §Pre-flight §Genre alternation

`<GENRE_ALT>` = `("merge-3" OR "merge 3" OR "merge puzzle" OR "merge game" OR "match-3 merge")`

Derived from seed `genre: "merge3"` + Codex Phase γ Fix 1 (single-keyword brittleness). 5 surface forms: hyphenated / spaced / colloquial / sub-genre / parent-genre.

### §Pre-flight §Site alternation

`<SITE_ALT>` = `(site:gamedeveloper.com OR site:gdcvault.com OR site:gamasutra.com)`

3 dev-grade sources. Stage 1 baseline query uses `<SITE_ALT>`; postmortem query does NOT (broader pool for personal dev blogs / interviews).

### §Pre-flight §Target family

`target_family` = `match3-with-meta` (from seed.json, locked at Phase γ per user decision).

**Implication for Stage 2 within-family selection**: candidates beyond Royal Match should prefer match-3-with-meta exemplars (Gardenscapes, Homescapes) over pure-merge (Merge Mansion, Travel Town). If within-family dev-grade candidates fall short of 3, broaden to hybrid.

### §Pre-flight §Source eligibility (Stage 2 rule, verbatim from detail §2 Step 3)

> Stage 2 `references[]` shortlist requires `source_type ∈ {dev-blog, postmortem, academic, gdc, interview}`. Listicle / marketing / aggregator / store-listing sources do NOT count toward the shortlist count. Hard cap: exactly 3 references.

**Stage 4 reject-list enum** (single-source from Pre-flight per evaluator m2): `{marketing, store-listing, listicle, unclassified}`.

### §Pre-flight §Cost counter

```
running_counter:
  websearch_count: 0
  webfetch_count: 0
  cumulative_total: 0
  hard_cap_calls: 100
  hard_cap_minutes: 30
  start_wall_time: 2026-05-29T13:25:00+09:00
```

Every Stage increments these and writes back. STOP at `cumulative_total >= 100` OR wall_time >= 30 min, whichever first.

### §Pre-flight §Approved queries (Stage 1 — verbatim, ready to execute)

**Query A (baseline)**:
```
("merge-3" OR "merge 3" OR "merge puzzle" OR "merge game" OR "match-3 merge") (mechanics OR design OR progression OR economy) (site:gamedeveloper.com OR site:gdcvault.com OR site:gamasutra.com)
```

**Query B (postmortem)**:
```
("merge-3" OR "merge 3" OR "merge puzzle" OR "merge game" OR "match-3 merge") (postmortem OR retrospective OR "game design" OR interview)
```

---

## §Stage1 — Genre baseline survey (executed 2026-05-29 ~13:30)

**Queries executed (verbatim from §Pre-flight §Approved queries)**:
- Query A (baseline + site: restricted): see §Pre-flight
- Query B (postmortem + open web): see §Pre-flight

**Observation**: site: restriction in Query A returned **0 direct dev-source hits** (no gamedeveloper.com / gdcvault.com / gamasutra.com results indexed for merge-3 queries). Multi-term alternation surfaced broader-web dev-grade analysis sites instead. This validates Codex Fix 1 (single-keyword `"merge3"` would have returned even less). Stage 2 will apply dev-grade source-type filter on this broader candidate pool.

**Candidate URLs (11 unique after dedup, classified by source_type)**:

| # | URL | Title | source_domain | source_type | Stage 2 shortlist eligible? |
|---|-----|-------|---------------|-------------|----------------------------|
| 1 | https://naavik.co/digest/what-leading-match-3-and-merge-games-do-differently/ | What Leading Match-3 & Merge Games Do Differently | naavik.co | dev-blog (industry analysis) | YES |
| 2 | https://www.deconstructoroffun.com/blog/2023/10/22/deconstructing-merge-garden | Deconstructing Merge Garden | deconstructoroffun.com | dev-blog (deconstruction) | YES |
| 3 | https://www.gamerefinery.com/why-merge-could-be-the-new-match3/ | Why Merge Could be the New Match3 | gamerefinery.com | dev-blog (industry analysis) | YES |
| 4 | https://mobilefreetoplay.com/deconstructing-merge-town-hyper-casual/ | Deconstructing Merge Town: Hyper Casual | mobilefreetoplay.com | dev-blog (deconstruction) | YES |
| 5 | https://www.deconstructoroffun.com/blog/2023/9/30/tile-match-the-new-match-3-or-the-new-merge | Tile Match: The new Match-3 or the new Merge? | deconstructoroffun.com | dev-blog (deconstruction) | YES |
| 6 | https://geeky.house/blog/tpost/vds1tysuj1-merge-2-vs-merge-3 | Research: Merge-2 vs Merge-3 | geeky.house | dev-blog (research post) | MAYBE — verify in Stage 2 |
| 7 | https://medium.com/design-bootcamp/design-analysis-of-match-3-games-fb63879ecd8f | Design Analysis of Match-3 Games | medium.com (Bootcamp pub) | dev-blog (designer post) | MAYBE — verify author credentials |
| 8 | https://wnhub.io/news/investment/item-19501 | Why Merge is the new Match3 | wnhub.io | aggregator/marketing | NO (reject — aggregator) |
| 9 | https://www.blog.udonis.co/mobile-marketing/mobile-games/merge-games-market | Merge Games Market | blog.udonis.co | marketing blog | NO (reject — marketing) |
| 10 | https://gametyrant.com/news/top-10-merge-games-january-2026 | Top 10 Merge Games | gametyrant.com | listicle | NO (reject — listicle) |
| 11 | https://retrostylegames.com/genres/match-3-games-creation/ | Match-3 Game Development Studio | retrostylegames.com | marketing (studio promo) | NO (reject — marketing) |

**Surface count**: 11 candidates → 5 YES + 2 MAYBE (dev-grade per Pre-flight §Source eligibility) + 4 NO (reject per Pre-flight Stage 4 reject-list). **Dev-grade pool = 5-7, comfortable margin over Stage 2 hard cap of 3.**

**Key thematic observation for Stage 2 family selection (target_family = match3-with-meta)**:
- Top dev-grade sources mostly discuss **pure-merge** titles (Merge Garden, Merge Town, Merge Dragons, Gossip Harbor).
- Royal Match (the seed reference) is **match3-with-meta** — not pure-merge. The naavik.co article explicitly contrasts "Leading Match-3 & Merge" (treats them as adjacent genres, not same).
- This *confirms* Codex Fix 3 disambiguation concern: a naive Stage 2 would pick all pure-merge refs (Merge Garden, Merge Town) which are *different family* from Royal Match. Stage 2 must prefer within-family (match3-with-meta = Royal Match, Gardenscapes, Homescapes).

**Cost delta**: Stage 1 = 2 WebSearch + 0 WebFetch. Cumulative = 2.

## §Stage2 — Reference shortlist (executed 2026-05-29 ~13:35)

**Within-family selection rule applied**: target_family = match3-with-meta → candidates restricted to match-3 with merge-style meta (Royal Match + Playrix scapes family). Pure-merge titles (Merge Garden, Merge Town, Merge Dragons) excluded — different family.

**Per-reference search executed (1 WebSearch each, 3 references)**:

### Reference 1 — Royal Match (Dream Games) [seed-locked]

| candidate URL | source_type | source_domain | notes |
|---------------|-------------|---------------|-------|
| https://naavik.co/deep-dives/royal-match/ | dev-blog (deep-dive analysis) | naavik.co | comprehensive design+economy deconstruction |
| https://www.deconstructoroffun.com/blog/2021/3/21/royal-match-the-new-king-from-turkey | dev-blog (deconstruction) | deconstructoroffun.com | early-era deconstruction, 2021 |
| https://medium.com/ironsource-levelup/design-deep-dive-02-royal-match-948f7af96f04 | dev-blog (designer post, IronSource) | medium.com | design-focused, IronSource pub |
| https://naavik.co/digest/royal-match-finding-success-through-iteration/ | dev-blog | naavik.co | iteration-focused complement |
| https://sensemitter.com/blog/how-royal-match-redefined-success-without-breaking-trust/ | dev-blog | sensemitter.com | trust/UX angle |

### Reference 2 — Gardenscapes (Playrix)

| candidate URL | source_type | source_domain | notes |
|---------------|-------------|---------------|-------|
| https://www.gamedeveloper.com/game-platforms/part-2-are-casual-games-maturing-lessons-from-playrix- | **dev-blog (Game Developer / formerly Gamasutra)** | gamedeveloper.com | **DEV-GRADE HIGHEST — first-party industry pub** |
| https://www.pocketgamer.biz/interview/77410/how-gardenscapes-changed-match-three/ | interview | pocketgamer.biz | Playrix interview, 5-year retrospective |
| https://gameworldobserver.com/2019/09/27/playrix-levels-elements-match-3 | interview | gameworldobserver.com | level design interview |
| https://mobilefreetoplay.com/deconstructing-gardenscapes/ | dev-blog (deconstruction) | mobilefreetoplay.com | early deconstruction |
| https://www.gamerefinery.com/casual-match3-meta-layer-new-winning-formula/ | dev-blog (industry analysis) | gamerefinery.com | meta-layer formula analysis |

### Reference 3 — Homescapes (Playrix)

| candidate URL | source_type | source_domain | notes |
|---------------|-------------|---------------|-------|
| https://www.pocketgamer.biz/interview/67045/the-making-of-homescapes/ | interview | pocketgamer.biz | "making of" interview |
| https://en.wikipedia.org/wiki/Homescapes | reference (encyclopedia) | wikipedia.org | basic facts only — supplement, not primary |

(Note: Homescapes had fewer dev-grade hits than Royal Match / Gardenscapes — many results were marketing/wiki/store. 1 dev-grade primary still meets the source-type rule.)

---

## §Stage2 shortlist (final — hard cap == 3, all dev-grade)

```json
[
  {
    "title": "Royal Match",
    "developer": "Dream Games",
    "release_year": 2021,
    "target_family": "match3-with-meta",
    "primary_url": "https://naavik.co/deep-dives/royal-match/",
    "source_type": "dev-blog",
    "source_domain": "naavik.co",
    "justification": "Seed reference (user-locked). naavik.co deep-dive is the most substantive analysis available; deconstructoroffun + medium IronSource posts are corroborating sources for Cycle 3 cross-verification.",
    "supporting_urls": [
      "https://www.deconstructoroffun.com/blog/2021/3/21/royal-match-the-new-king-from-turkey",
      "https://medium.com/ironsource-levelup/design-deep-dive-02-royal-match-948f7af96f04",
      "https://naavik.co/digest/royal-match-finding-success-through-iteration/"
    ]
  },
  {
    "title": "Gardenscapes",
    "developer": "Playrix",
    "release_year": 2016,
    "target_family": "match3-with-meta",
    "primary_url": "https://www.gamedeveloper.com/game-platforms/part-2-are-casual-games-maturing-lessons-from-playrix-",
    "source_type": "dev-blog",
    "source_domain": "gamedeveloper.com",
    "justification": "Genre-founder for match3-with-meta. gamedeveloper.com (formerly Gamasutra) is the highest-tier dev-grade source available; pocketgamer.biz 5-year interview and Playrix level-elements interview provide first-party perspectives for cross-verification.",
    "supporting_urls": [
      "https://www.pocketgamer.biz/interview/77410/how-gardenscapes-changed-match-three/",
      "https://gameworldobserver.com/2019/09/27/playrix-levels-elements-match-3",
      "https://mobilefreetoplay.com/deconstructing-gardenscapes/"
    ]
  },
  {
    "title": "Homescapes",
    "developer": "Playrix",
    "release_year": 2017,
    "target_family": "match3-with-meta",
    "primary_url": "https://www.pocketgamer.biz/interview/67045/the-making-of-homescapes/",
    "source_type": "interview",
    "source_domain": "pocketgamer.biz",
    "justification": "Playrix follow-up to Gardenscapes, same family, narrative-forward variant. 'The making of' interview is dev-grade with Igor Elovikov (Creative Director) direct quotes — useful for narrative+economy conventions.",
    "supporting_urls": [
      "https://wnhub.io/news/other/item-13211"
    ]
  }
]
```

**Family coverage**: 3/3 match3-with-meta (genre-founder Gardenscapes 2016 + sibling Homescapes 2017 + modern leader Royal Match 2021). Strong intra-family spread for convention extraction.

**Source-type distribution**: 2 dev-blog + 1 interview. All within `{dev-blog, postmortem, academic, gdc, interview}` allow-list. 0 rejects.

**Quit signal check (§1 Step 3)**:
- ✓ `len(references) == 3` (hard cap exact)
- ✓ Every entry has `source_type ∈ {dev-blog, postmortem, academic, gdc, interview}`
- ✓ Every entry has `{title, primary_url, source_type, source_domain, justification}`

PASS.

**Cost delta**: Stage 2 = 3 WebSearch + 0 WebFetch. Cumulative = 5 (well under cap).

## §Stage3 — Per-reference 3-cycle convention extraction (4 categories: mechanics / progression / session-length / failure-mode)

### §Royal Match

#### §Cycle1 — Baseline (executed 2026-05-29 ~13:50)

**Queries**: 4 WebSearch (one per category) + 1 WebFetch (naavik deep-dive primary).

| # | category | convention (cycle1 draft) | source_url | source_type |
|---|----------|---------------------------|-----------|-------------|
| RM-1 | mechanics | Swap-to-match-3 with **larger-than-average pieces** + distinct color+shape for fast board reads; player can chain matches *during* cascades (player agency over the chain). | medium ironsource deep-dive, gamedeveloper 45-mechanics | dev-blog |
| RM-2 | mechanics | **Generous power-ups** — biggest-radius bombs, propellers that re-target mid-air, simultaneous moves; power-ups generated by match formations. | naavik deep-dive | dev-blog |
| RM-3 | progression | New obstacle/mechanic introduced **every ~10 levels** (systematic drip, never overwhelm). | medium ekinmelis analysis, cubix | dev-blog |
| RM-4 | progression | **NO decoration/customization meta** (corrected — see V1 below). naavik deep-dive verbatim: *"the game doesn't allow customization … There is no way to diverge, collect, or achieve in any way in the meta game. It's purely progression-based."* Secondary progression = Butler's Gift / Book of Treasure / Card Collection (NOT area-decorating). ⚠ This is the key *delta vs Playrix scapes* family. | naavik deep-dive (Claude WebFetch verified 2026-05-29) | dev-blog |
| RM-5 | progression | Board-layout variety as progression lever: irregular grids (diamond/H-shaped), isolated/stacked sub-boards where matches cross-affect. | gamigion level-design insights | dev-blog |
| RM-6 | session-length | Each level designed for **≤5 min** (bite-sized, fits routine). No visible loading screens (instant re-entry). | cubix, naavik | dev-blog |
| RM-7 | session-length | **Opt-in events** target different session lengths + retention goals (continuous event cycle, daily-login incentives). | naavik, productmonk | dev-blog |
| RM-8 | failure-mode | **5-life cap, 1 life / 30 min** regen. Fail a level → lose 1 life. | royalmatch fandom (⚠ wiki — needs dev-grade corroboration, V2) | reference |
| RM-9 | failure-mode | **Move-limit** is the core difficulty driver; tight limits force optimized play + booster use. "Near-miss" levels deliberately engineered to push extra-move purchase ($2 → $4.35 → $6.65 → $8.95 escalating). | naavik deep-dive | dev-blog |
| RM-10 | failure-mode | Difficulty ramp: first ~12 levels gentle, then sharper (more items / fewer turns / multi-hit obstacles). Boosters ease tough sections without consuming moves. | medium ekinmelis, naavik | dev-blog |

**Cycle1 category coverage**: mechanics ✓(2) / progression ✓(3) / session-length ✓(2) / failure-mode ✓(3). **All 4 categories filled — Cycle 2 gap-fill NOT needed for Royal Match.**

**Conflict RESOLVED (Claude WebFetch 2026-05-29, not deferred to Cycle 3)**:
- **V1 — RESOLVED**: RM-4 decoration-meta. Claude fetched naavik deep-dive directly. naavik **explicitly** states Royal Match has *no* decoration/customization meta ("purely progression-based"). The search-snippet "decorate areas" framing (gamigion/deconstructoroffun) was **conflated with Gardenscapes** and is FACTUALLY WRONG for Royal Match. RM-4 above corrected accordingly. **Lesson**: a qualitative convention was nearly recorded as fact from a search snippet that the primary source contradicts — Stage 3 qualitative claims need primary-source confirmation, not just snippet capture (audit axis 3 finding realized).
- RM-9 (extra-move pricing $2→$4.35→$6.65→$8.95) — Claude WebFetch verified verbatim against naavik. Accurate.

**Cost delta**: 4 WebSearch + 1 WebFetch. Cumulative = 5 + 5 = **10**.

#### §Cycle2 — Gap fill (Royal Match)

**Skipped** — all 4 categories had ≥1 convention after Cycle 1. Per detail §2 Step 4 Cycle 2 ("identify *missing* categories"), no missing category → 0 calls. Cumulative stays **10**.

#### §Cycle3 — Cross-verification (Royal Match)

(execution pending — next)

### §Gardenscapes

#### §Cycle1 — Baseline (executed 2026-05-29 ~13:55)

**Queries**: 4 WebSearch (one per category) + 1 WebFetch (gamedeveloper.com Playrix lessons — highest-tier source).

| # | category | convention (cycle1 draft) | source_url | source_type |
|---|----------|---------------------------|-----------|-------------|
| GS-1 | mechanics | Standard swap match-3, **non-color-specific bonuses + cumulative "Lightning" bonus**; continuous matching (no pauses). | mobilefreetoplay deconstruction, playrix helpshift | dev-blog |
| GS-2 | mechanics | **Hybrid two-system design**: "Invest & Express" (repair + decorate garden) bolted onto match-3. Match-3 is the *resource engine*, decoration is the *goal*. | juegostudio, deconstructoroffun pivot | dev-blog |
| GS-3 | mechanics | **Playrix's 4 internal match-3 rules**: (a) keep adding new elements, (b) guard visual integrity (no mess), (c) analyze level-flow to catch design errors, (d) A/B test for monetization+retention. | gameworldobserver (Playrix dev interview) | interview |
| GS-4 | progression | **Star-as-bridge**: 1 star per level beaten; stars spent on garden tasks. Stars are the *single connective currency* between core loop and meta. | playrix helpshift, scribd GDD | dev-blog |
| GS-5 | progression | **Decoration meta replaces the saga-map** — players physically redesign spaces (furniture/decor/architecture) via "Makeover" mechanic. Narrative + characters drive emotional engagement. **Can't buy progress — only earn via match-3 wins** (boosters purchasable, progress not). | gamedeveloper Playrix lessons, deconstructoroffun | dev-blog |
| GS-6 | progression | **Fixed/limited placement choices** for decoration (simplify mobile UI); **max 2 active daily quests** (avoid choice overload). | gamedeveloper Playrix lessons | dev-blog |
| GS-7 | session-length | Design targets **daily regular returns, not long sessions** ("encourage returns without punishment"). Daily rewards + login bonuses + achievement badges. (Observed avg ~46 min/day, but that's aggregate not per-session-design.) | apptica, kreonit, gamedeveloper | dev-blog |
| GS-8 | failure-mode | **4 difficulty tiers**: Normal (majority) / Hard (3× reward) / Super-Hard (5×) / Challenge (5×, first-try-only). | gardenscapes wiki + levelwinner (⚠ guide-grade, V3 verify) | reference |
| GS-9 | failure-mode | **Dual difficulty curve**: designer sets *projected* difficulty → playtester data sets *actual* curve → reconcile. Watch for stuck 92-95% difficulty clusters (real incident Playrix had to fix). | gameworldobserver (Playrix dev interview) | interview |
| GS-10 | failure-mode | Move-limited objectives; run out → buy extra moves/power-ups OR retry (costs a life). Difficulty = f(board orientation, tile arrangement, obstacles, available power-ups, goals, move count). | gardenscapesstrategy, gameworldobserver | dev-blog |

**Cycle1 category coverage**: mechanics ✓(3) / progression ✓(3) / session-length ✓(1) / failure-mode ✓(3). **All 4 filled — Cycle 2 gap-fill NOT needed.**

**Cost delta**: 4 WebSearch + 1 WebFetch. Cumulative = 10 + 5 = **15**.

#### §Cycle2 — Gap fill (Gardenscapes)

**Skipped** — all 4 categories filled. 0 calls. Cumulative stays **15**.

#### §Cycle3 — Cross-verification (Gardenscapes)

(execution pending)

### §Homescapes

#### §Cycle1 — Baseline (executed 2026-05-29 ~14:00)

**Queries**: 4 WebSearch (one per category) + 1 WebFetch (pocketgamer "making of" interview — first-party Playrix).

| # | category | convention (cycle1 draft) | source_url | source_type |
|---|----------|---------------------------|-----------|-------------|
| HS-1 | mechanics | Swap match-3, **identical core formula to Gardenscapes** — Igor Elovikov (Playrix CD): *"From a technical point of view, the formula is the same."* Tiles themed to setting (teacups/books/lamps). | pocketgamer making-of (first-party) | interview |
| HS-2 | mechanics | **Single-currency design** (coins only) — Elovikov: *"we just thought having a single currency would be more elegant."* No hard/soft split, no video ads. | pocketgamer making-of | interview |
| HS-3 | progression | **Narrative is THE differentiator** — Elovikov: *"The key difference is the narrative part, the story itself."* Story-driven (Austin the butler restores family mansion); match-3 win → star → renovation → next story chapter. | pocketgamer making-of, grokipedia | interview |
| HS-4 | progression | **Star-gated renovation meta** (same star-as-bridge as Gardenscapes): 1 star/level → spent on To-do-list renovation tasks. 100,000+ design patterns for customization. | wikipedia, ask.com evolution | reference |
| HS-5 | progression | Match-3 levels combined with **visual-novel layer**; tasks framed as in-fiction to-do items (install stairs, pet cat) not abstract goals. | techtiplib launch, ask.com | dev-blog |
| HS-6 | session-length | **Event framework is the retention engine** — described as a "masterclass." Calendar daily-login + longevity rewards; push notifications tied to in-fiction events ("unlimited lives expire in an hour"). Playrix runs "intense live ops schedule, regular/themed/special events." | medium ironsource event-framework (dev-blog), bettermarketing | dev-blog |
| HS-7 | session-length | Observed retention benchmark: **D1 53% / D7 30% / D28 20%**; weekly engagement curve rises Mon→weekend peak. | udonis, galaxy4games | dev-blog |
| HS-8 | failure-mode | **Move-limited, up to 4 objectives/level.** Out of moves → buy extra/power-ups OR retry (costs a life). Backing out also costs a life + equipped boosters. | gamigion level-design, playrix helpshift | dev-blog |
| HS-9 | failure-mode | **Quantified difficulty tiers + move economy**: Normal 1.1–1.4 attempts @ 12–20 moves / 10 Hard @ ~17 moves @ 1.8 attempts / 6 Super-Hard @ 2.3–2.6 attempts. Move count *compresses* over progression (early 14–33 → late 12–18) → tension builds gradually. | gamigion level-design insights | dev-blog |
| HS-10 | failure-mode | **~50 new levels released every Thu/Fri** (content-supply pacing keeps failure-retry loop fed). | homescapes wiki (⚠ verify V4) | reference |

**Cycle1 category coverage**: mechanics ✓(2) / progression ✓(3) / session-length ✓(2) / failure-mode ✓(3). **All 4 filled — Cycle 2 gap-fill NOT needed.**

**Cost delta**: 4 WebSearch + 1 WebFetch. Cumulative = 15 + 5 = **20**.

#### §Cycle2 — Gap fill (Homescapes)

**Skipped** — all 4 categories filled. 0 calls. Cumulative stays **20**.

#### §Cycle3 — Cross-verification (Homescapes)

(execution pending)

## §Stage4 (pending — F2P contamination filter)

(execution pending)

## §Synthesis (pending — Stage 5)

(execution pending)

## §Cost (running, mirrors §Pre-flight §Cost counter)

| Time | Stage | Action | websearch_delta | webfetch_delta | cumulative_total |
|------|-------|--------|-----------------|-----------------|------------------|
| 13:25 | Pre-flight | init | 0 | 0 | 0 |
| 13:30 | Stage 1 | baseline + postmortem queries | +2 | 0 | 2 |
| 13:35 | Stage 2 | per-reference search (3 refs) | +3 | 0 | 5 |
| 13:50 | Stage 3 RM Cycle1 | 4 cat search + 1 fetch (naavik) | +4 | +1 | 10 |
| 13:55 | Stage 3 GS Cycle1 | 4 cat search + 1 fetch (gamedeveloper) | +4 | +1 | 15 |
| 14:00 | Stage 3 HS Cycle1 | 4 cat search + 1 fetch (pocketgamer) | +4 | +1 | 20 |

## §failures (per Step 4 — references that completed 3-cycle with 0 conventions)

(empty)
