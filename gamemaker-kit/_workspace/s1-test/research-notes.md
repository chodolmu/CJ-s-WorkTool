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

## §Stage3 (pending — per-reference 3-cycle convention extraction, 4 categories)

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

## §failures (per Step 4 — references that completed 3-cycle with 0 conventions)

(empty)
