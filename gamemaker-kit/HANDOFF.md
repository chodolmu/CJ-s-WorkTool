# Handoff: gamemaker-kit — v0.8.0 release 완료, **ACCURATE 3연속 (process 확정)**

**Updated**: 2026-05-18 (00:35 KST)
**Branch**: main
**Latest commit**: `b0a59c0 feat(gamemaker-kit): v0.8.0 — Rule 17 pillars.kind + Check B promote + allowlist staleness convention`
**Tag**: `v0.8.0` (origin 동기화 완료, GitHub release 발행)
**Release URL**: https://github.com/chodolmu/CJ-s-WorkTool/releases/tag/v0.8.0
**Status**: v0.8.0 release 완료. **4 evaluator checkpoint 모두 ACCURATE** (Protocol 1 UNDERSTATED expected, Protocol 3 + Protocol 4 모두 ACCURATE). v0.6/v0.7/v0.8 3연속 ACCURATE — Protocol 1/3/4 cycle **process 확정**. 첫 0-warning pre-flight release (v0.7 Check E baseline WARN 해소).
**v0.8 보고서**: `_workspace/v0.8-protocol-1.md`, `_workspace/v0.8-protocol-3.md`, `_workspace/v0.8-protocol-4.md`

---

## v0.8 핵심 성과 (이번 사이클)

| 항목 | 결과 |
|---|---|
| Protocol 1 verdict | **UNDERSTATED** — HANDOFF 5 candidates → 실제 14 corrections + 3 missing (M-2/M-3 v0.9 이월). F21 3연속 (강도 약화). |
| Rule 17 (`pillars.kind` enum read contract) | 신설. 4-case table (Rule 16 form mirror). 마지막 declared-but-half-applied field 종결. |
| Check G (WARN-level) | 신규. pillars-example.json valid kind 검증. |
| Check B WARN → FAIL | 정밀화 (`\bendpoint\b` whole-word, `-i` drop) + 승격. |
| `.endpoint-allowlist.txt:37` stale entry | M-1이 잡아 제거. `marketplace.json:8` 매치 안 함. |
| Allowlist staleness convention | `verified-at: <SHA>` stamps on both allowlist files. v0.8 본 자체에서 1번째 real drift 잡음 (gmk-art-gen 140→144). |
| HANDOFF backlog template | `_workspace/handoff-backlog-template.md` — file:line targets + grep query + non-targets + classification. F21 closure 기준 정의 (ratio < 1.0 for 3 releases). |
| gmk-art-gen mock cleanup reminder | Step 6 Next: 블록에 conditional 1-liner. |
| `templates/prototype-shader.html` | 401 → 299 lines (under 300 soft cap). Bot hook API preserved. |
| Protocol 3 verdict | **ACCURATE** — 6/6 candidates PASS, 0 release-blocking defects, green-light Y. |
| Protocol 4 verdict | **ACCURATE** — 18 CHANGELOG claims 모두 git-diff 검증 통과, 0 critical/major defects. |
| Pre-flight final | 7/7 checks pass, 0 warnings (v0.6 이후 처음으로 zero-warning). |

## v0.8에서 확정된 정책

### F21 closure 기준 정식 채택

`_workspace/handoff-backlog-template.md`에 명시:
- 매 release CHANGELOG entry에 *Protocol 1 corrections count* retrospective 필드 필수
- F21 closure = correction ratio (corrections/candidate) < 1.0 for 3 consecutive releases
- 현재 추세: v0.7 = 1.75, v0.8 = 2.80. 상승했으나 candidate 수도 증가 + Protocol 1 깊이 강화 효과.
- v0.9부터 새 template으로 backlog 작성 시 ratio 하락 예상.

### Process 정착 (3연속 ACCURATE)

| Release | Protocol 1 | Protocol 3 | Protocol 4 | Pre-flight final |
|---|---|---|---|---|
| v0.6 | UNDERSTATED | ACCURATE | ACCURATE | 1 warning |
| v0.7 | UNDERSTATED | ACCURATE | ACCURATE | 1 warning (Check E shader) |
| v0.8 | UNDERSTATED | ACCURATE | ACCURATE | **0 warnings** |

Protocol 1 UNDERSTATED는 *expected* (HANDOFF anchoring). Protocol 3 ACCURATE = 작업 완료 + 새 결함 없음. Protocol 4 ACCURATE = git-based 검증 통과.

---

## v0.9 backlog candidates (Protocol 1로 보정 필요)

다음 release에서 검토 후보. v0.9부터는 새 HANDOFF backlog template (`_workspace/handoff-backlog-template.md`)으로 작성. 각 candidate에 (a) file:line targets + grep query, (b) explicit non-targets, (c) classification, (d) defect-class link 명시.

### Tier 1 (must-have, v0.9 코어)

**1. M-2: declared-but-never-exercised behaviors audit**
- *Targets* (grep query: `grep -rn 'CYCLE\|kit_version >\|early_fail\|Math.random' skills/`):
  - Rule 14 CYCLE form — 0 SKILLs emit; live use-case 없음 (v0.7에서 "fallback safety valve"로 reframe)
  - `kit_version > current` 분기 (Rule 16 row 3) — downgrade scenario 없음
  - `early_fail` field in `measured_by[]` (milestones-example.json:21) — gmk-validate actual read 검증 필요
  - `Math.random()` 경고 (prototype-rules:496) — 현재 trip하는 prototype 0
- *Non-targets*: Rule 13/15/16의 main path는 daily 사용 중이라 제외.
- *Classification*: structural-guard (각 dead branch에 synthetic test invocation 추가 OR "safety valve, last-exercised: never" 명시)
- *Defect class*: declared-but-never-exercised (Rule 14 CYCLE pattern)

**2. M-3: README skill count "~28 skills" → "29 skills"**
- *Targets*: `README.md:6` (grep query: `grep -n 'skills' README.md`)
- *Non-targets*: plugin.json/marketplace.json description (Check 3가 plugin.json만 검증 — README 추가 검증 여부 결정)
- *Classification*: single-fix (trivial)

### Tier 2 (should-have)

**3. Protocol 1 corrections ratio 트래킹 정식화**
- *Targets*: `_workspace/handoff-backlog-template.md` 추적 표 + CHANGELOG `Process` 섹션 conventionalize
- *Non-targets*: CHANGELOG history (Keep-a-Changelog 동결)
- *Classification*: process

**4. gmk-port 684줄 split candidate 평가**
- *Targets*: `grep -n '^### ' skills/gmk-port/SKILL.md` — section boundary 식별
- *Non-targets*: prototype-rules 519, gmk-validate 503 — 600 이하라 v0.9 미작업
- *Classification*: single-fix (혹은 split 결정)
- *Note*: Rule 2 scope 미적용 (SKILL 문서). 운영자 readability 개선 결정 시.

### Tier 3 (defer 또는 brainstorm)

- Check G WARN → FAIL 승격 검토 (baseline 정착 후)
- `_save_breaking: false` field convention (gmk-merge-gate L156 warning row에서 언급된 field — 실제 wire 없음. half-applied class 후보?)

---

## Process 정착 (v0.7+ 영구 적용 결정, v0.8에서 재확인)

매 release마다 다음 4 checkpoint:

| Protocol | When | Cost | Purpose |
|---|---|---|---|
| 1 — Work-start | 작업 시작 전 | ~1 evaluator call | backlog scope 보정 (anti-anchoring) |
| 2 — Mid-work (optional) | 작업 중간 (해당 시) | ~1 call | 진행 방식 sanity check |
| 3 — Pre-release | release 직전 | ~1 call | 작업 완료 여부 + 새 결함 검증 |
| 4 — Post-release | tag/push 직후 | ~1 call | git-based 최종 검증 |

총 3-4 calls per release. 비용 < OVERSTATED hotfix cycle. **3연속 ACCURATE으로 process 비용-효율 검증됨.**

---

## v0.7 핵심 성과 (이번 사이클)

| 항목 | 결과 |
|---|---|
| Protocol 1 verdict | **UNDERSTATED** — HANDOFF 4 candidates → 실제 7 items (3개 missed: line-level allowlist, pre-push hook, 3 new checks D/E/F). F21 anchoring 재발 → Protocol 1이 또 잡음 |
| Rule 16 (kit_version read contract) | 신설, 4-case table, shape (d) warn-only. 27 SKILLs footer "Rule 13-14, 16"으로 amend |
| Check A + C: WARN → FAIL 승격 | 완료. drift accumulator로 wire. Check B는 WARN 유지 (regex 정밀화 v0.8 이월) |
| Check D/E/F 신규 (WARN-level) | kit_version 일관성 / 템플릿 line cap / hook API version anchor |
| .rule14-allowlist.txt 라인 레벨 | 9 entries (7 SKILLs, gmk-loop/merge-gate 각 2 사이트) |
| Rule 14 CYCLE rewrite | "fallback / currently unused safety valve"로 재프레이밍. 삭제 안 함 |
| gmk-mock-inject | NO IMPLEMENTATION (Protocol 1에서 audit 완료, 변경 없음) |
| scripts/hooks/pre-push | opt-in template (core.hooksPath 통해 활성화) |
| Protocol 3 (pre-release) verdict | **ACCURATE** with 1 minor stylistic tightening (placeholder MAJOR.MINOR.PATCH 명시) |
| Protocol 4 (post-release git) verdict | **ACCURATE** — 모든 38 file claim 검증 통과 |

## v0.8 backlog — Protocol 1 보정 완료 (2026-05-17 23:48)

**Protocol 1 verdict**: **UNDERSTATED** (F21 3연속, 강도 약화 추세). 원본 HANDOFF 5 candidates → 보정 후 5 + 추가 3 (M-1/M-2/M-3). 보고서: `_workspace/v0.8-protocol-1.md`.

**v0.8 한 줄 약속**: *"Close the last declared-but-half-applied field (`pillars.kind`), harden allowlists against silent rot, and formalize the HANDOFF backlog template so F21 doesn't keep needing Protocol 1 to catch it."*

**Backlog shape**: v0.8+부터 각 candidate는 `_workspace/handoff-backlog-template.md`의 shape를 따른다 — file:line targets + grep query, explicit non-targets, classification, defect-class link. 본 v0.8 backlog는 *부분 적용* (template 자체가 v0.8 deliverable라 retro-fit 불가) — v0.9부터 full apply.

### Tier 1 — must-have

**T1-A. M-1 + Candidate #1 통합: allowlist staleness audit + endpoint Check B 정밀화/승격**
- M-1 (선행): 두 allowlist file 전체 entry 재검증. 확인된 stale: `.endpoint-allowlist.txt:37` → `marketplace.json:8` (해당 라인에 "endpoint" 토큰 없음 — 실제로는 `marketplace.json:15`만). `.rule14-allowlist.txt` 9 entries (gmk-art-gen:140, brainstorm:24, kill-milestone:145, loop:128, loop:243, merge-gate:156, merge-gate:297, mock-inject:26, save-migrate:196) 각각 line 이동 여부 점검.
- 각 entry에 `verified-at-SHA: xxxx` stamp 컨벤션 신설 (allowlist file header에 명시).
- 그 다음 Candidate #1: Check B regex를 `\bendpoint\b` whole-word로 정밀화, `-i` 케이스 결정 명시 (현재 6 occurrence 전부 allowlisted: gmk-dev-complete:59, gmk-self-test:107, CONCEPT.md:11/40, marketplace.json:15, plugin.json:4). Check B WARN → FAIL 승격.
- 값: 현재 drift 잡는 게 아니라 *future contributor가 "endpoint" 재도입 못 하게 차단*.

**T1-B. Candidate #3 reframed: Rule 17 (`pillars.kind` enum read contract) + Check G + read-site migration**
- 원본 HANDOFF는 "Rule 17 후보? 또는 기존 SKILL에 read-check 추가?" — **둘 다, 양자택일 아님**.
- Rule 17 신설: `pillars[].kind` ∈ {sensory, behavioral, decision-shape, emotional}, 4-case table (Rule 16과 동일 form): absent / valid enum / unknown enum / wrong-casing 각각 SKILL 행동 정의.
- `check-plugin-meta.sh`에 Check G 추가: 모든 pillar가 valid `kind` 선언.
- Read-site migration (concrete consumer 이미 존재 — concept 기반 free-text 분기 중):
  - `skills/gmk-prototype/SKILL.md:78-82` — Behavioral pillar → behavioral metric 분기 table
  - `skills/gmk-self-test/SKILL.md:305` — "Pillar is sensory" free-text
  - `skills/gmk-init/SKILL.md:41/65` — 4 shapes 안내
- 27 SKILL footer 일괄 amend: `Rule 13-14, 16` → `Rule 13-14, 16, 17`.
- sister fields (`anti_examples` / `supported_genres_check.*` / `skipped`) 모두 read 되므로 `kind`가 *유일한* write-only — declared-but-half-applied 마지막 case 종결.

**T1-C. Candidate #5 reclassified: HANDOFF backlog template + Protocol-1 retro field (process, not check)**
- 원본 "structural guard"는 부정확 — F21 fix는 `scripts/check-plugin-meta.sh`가 아니라 *HANDOFF.md template + Protocol cycle docs*에 속함.
- HANDOFF backlog candidate template 신설 — 각 candidate에 필수 필드: (a) affected file:line 사이트 + 사용한 grep query, (b) 명시적 non-target ("would NOT touch X because Y"), (c) classification (sweep / single-fix / structural-guard / process).
- CHANGELOG entry에 "Protocol 1 corrections count" retrospective 필드 추가 — success metric = 0 수렴.
- F21 closure 기준 신설: Protocol 1 correction count < 1 for 3 consecutive releases.

### Tier 2 — should-have

**T2-A. Candidate #4 reframed: mock-asset lifecycle reminder — gmk-art-gen에서 trigger (NOT gmk-mock-inject Step 8)**
- 원본 misframed: `gmk-mock-inject`은 Steps 1-7만 있고 (재invoke 안 됨), "Step 8" 위치 부정확.
- 실제 trigger: `gmk-art-gen` 완료 path에 reminder hook 추가 — milestone X art-gen 완료 후 `prototypes/X-mocked.html` 존재 시 surface: *"Real assets landed. The mocked file at <path> is now stale — delete it and re-run /gmk-validate on the original."*
- secondary trigger 후보: `gmk-validate`가 `-mocked.html`에 호출되고 non-mocked sibling 존재 시.
- `gmk-mock-inject` SKILL 라인 19/172/203/220/237/281/282/284에 lifecycle 언급은 있으나 actionable step 없음 — 새 reminder 위치 cross-ref.

**T2-B. Candidate #2: shader template 401 → ≤300 + scope justification**
- `templates/prototype-shader.html` 401줄 → ≤300줄. Check E baseline WARN 해소.
- one-liner justification (commit/CHANGELOG): *"Check E intentionally not extended to skills/ — SKILL files are reference docs not prototypes; the 300/600 numbers were calibrated for mechanic-prototype mental-model load (Rule 2 rationale at gmk-prototype-rules:58), not doc length."*
- 참고: gmk-port 684줄, prototype-rules 515줄, gmk-validate 503줄 — Rule 2 scope 외, v0.8 미작업 (별도 release candidate).

### Tier 3 — v0.9 이월

- **M-2** declared-but-never-exercised behaviors audit (Rule 14 CYCLE, `kit_version > current` 분기, `early_fail` 필드, `Math.random()` 워닝). 범위 큼 — v0.8 포함 시 다른 작업 압박.
- **M-3** `README.md:6` "~28 skills + 4 domain agents" → 29 정정. 사소.

### v0.8에서 *안* 할 것

| 항목 | 이유 |
|---|---|
| 새 SKILL / 새 agent | 0개 유지 (v0.4 이후 정책) |
| dogfood | 영영 차단 (W24) |
| Check E를 skills/로 확장 | Rule 2 scope 위반 (mechanic-prototype용) |
| HANDOFF/CHANGELOG history 정정 | Keep-a-Changelog 규약 동결 |

### Protocol 1 corrections count

**v0.8 Protocol 1 corrections: 14** (6 ADD + 1 REMOVE + 4 VERIFY + 3 RECLASSIFY) + **3 missing candidates** (M-1/M-2/M-3).
- v0.6 Protocol 1 corrections: 미집계 (process 신설)
- v0.7 Protocol 1 corrections: 7 (HANDOFF 4 → 실제 7)
- v0.8 Protocol 1 corrections: 14 (HANDOFF 5 → 실제 5 보정 + 3 신규)

F21 *추세*: count가 증가했으나 candidate 수도 증가. ratio (corrections/candidates)로 보면 v0.7=1.75, v0.8=2.8 — 일관 추적은 v0.9부터.

## v0.6 핵심 성과 (이전 사이클)

| 항목 | 결과 |
|---|---|
| MAJOR-1 Rule 14 sweep | 11 SKILLs / 13 토큰 사이트 (HANDOFF 원본 15 → Protocol 1 보정 11) |
| MAJOR-2 endpoint → checkpoint | 17 위치 (HANDOFF 원본 13 → Protocol 1 +4 보정) |
| MINOR-3 dev-complete read-only 정정 | 2 줄 (HANDOFF 1 → Protocol 1 +1) |
| MINOR-4 CHANGELOG cross-ref | 2 줄 |
| STRUCTURAL GUARD | scripts/check-plugin-meta.sh + 2 allowlist 파일 |
| Protocol 1 (work-start) verdict | UNDERSTATED — HANDOFF backlog 자체가 anchoring |
| Protocol 3 (pre-release) verdict | **ACCURATE** |
| Protocol 4 (post-release git-based) verdict | **ACCURATE** |

## v0.6에서 학습된 패턴 (다음 release에 적용)

### F21 — HANDOFF 작성자도 anchoring한다

v0.5 evaluator가 v0.6 backlog를 작성. 본인이 직접 확인한 위치만 나열했고, *놓친 사이트*는 HANDOFF에도 그대로 누락. Protocol 1이 그것을 잡아냄 (15→11, 13→17).

**교훈**: HANDOFF backlog는 *작업 지시*가 아니라 *작업 후보 가설*. 실제 작업 시작 *전*에 fresh evaluator가 한 번 더 보는 게 정책.

### 3-checkpoint process가 비용 대비 효과 큼

evaluator 3번 호출 비용 < OVERSTATED 사이클 1번 비용 (다음 release에서 또 hotfix). v0.7+에서도 같은 process 유지.

### 결함 class별로 structural guard 추가하면 사람 audit 부담 감소

`check-plugin-meta.sh`가 Rule 14 토큰 / endpoint terminology / Rule 13-14 footer 자동 검출. 다음 sweep도 같은 형태로 추가하면 됨.

---

## v0.7 backlog candidate (확정 아님 — Protocol 1로 보정 필요)

다음 release에서 검토 후보:

1. **`kit_version` read-enforcement** (v0.4 decision 4 / v0.6 honesty note에서 이월). v0.4 이후 모든 파일이 `kit_version` 쓰지만 *읽고 행동하는 SKILL은 0개*. 이도 declared-but-half-applied 패턴. structural guard에 4번째 check 후보.
2. **Structural guard WARN → FAIL 승격**. v0.6은 baseline 정착용으로 WARN. v0.7에서 release-blocking으로 승격 검토.
3. **gmk-mock-inject 검증 통합 audit**. v0.5/v0.6 모두 gmk-mock-inject를 refuse-with-rec allowlist에 두었음. 실제로 refuse 패턴 없는지 한 번 cold-read 권장.
4. **Rule 14 토큰의 cycle form 사용 확인**. 현재 모든 토큰이 single-target form. `[Rule 14 — CYCLE]` 사용 사례가 0개인데, 룰북에 정의된 cycle 상황 (shader INCONCLUSIVE, validate --skip) 모두 *self-test가 accept*하는 형태로 처리. CYCLE form이 dead code인지 검토.

이 4개를 v0.7 작업 시작 전 Protocol 1로 보강 후 확정.

---

## Process 정착 (v0.7+ 영구 적용 결정)

매 release마다 다음 4 checkpoint:

| Protocol | When | Cost | Purpose |
|---|---|---|---|
| 1 — Work-start | 작업 시작 전 | ~1 evaluator call | backlog scope 보정 (anti-anchoring) |
| 2 — Mid-work (optional) | 작업 중간 (해당 시) | ~1 call | 진행 방식 sanity check |
| 3 — Pre-release | release 직전 | ~1 call | 작업 완료 여부 + 새 결함 검증 |
| 4 — Post-release | tag/push 직후 | ~1 call | git-based 최종 검증 |

총 3-4 calls per release. 비용 < OVERSTATED hotfix cycle.

---

## v0.5 → v0.6 변경 누적 (이전 섹션 참고 유지)

---

## Goal (지속)

게임 개발 자동화 Claude Code 플러그인. 4축 × release-readiness checkpoint. v0.6의 한 줄 약속: **"v0.5가 *선언*만 한 두 standardization을 *전 SKILL에 실제 적용*한다. 그리고 같은 함정이 또 반복되지 않도록 structural guard를 추가한다."**

---

## v0.5 evaluator 결과 (재검증, 2026-05-15)

외부 evaluator가 v0.5 직후 재audit:

| Part | 결과 |
|---|---|
| **Part 1: 7 fix (G-A~G-G)** | 모두 **CLOSED** — cite된 file:line 위치 정확 |
| **Part 2: v0.5 신규 결함 2 MAJOR + 2 MINOR** | half-applied 패턴 재발 |
| **Part 3: v0.5 self-audit 등급** | **OVERSTATED (mildly)** — F18 교훈 또 재발 |

핵심 인사이트: *v0.4가 deprecation을 반만 적용했고, v0.5는 그것을 cite-by-cite 닫았지만, v0.5 자신이 만든 새 규약 두 개를 다시 반만 적용함*. 같은 defect class.

---

## v0.6 backlog (확정)

### MAJOR-1: Rule 14 토큰 15 SKILL sweep ★★

**문제**: v0.5가 `[Rule 14]` / `[Rule 14 — CYCLE]`를 *mandatory*로 prototype-rules:398에 선언. 실제 적용은 `gmk-prototype-rules` + `gmk-self-test` 2곳만. 나머지 15 SKILL이 "Run /gmk-X first" refuse 출력하면서 토큰 부재.

**영향 SKILL** (evaluator 적시):
- gmk-port, gmk-merge-gate, gmk-roadmap, gmk-save-migrate, gmk-validate, gmk-regression, gmk-dev-complete, gmk-status, gmk-loop, gmk-design-system, gmk-shape-advisor, gmk-mock-inject, gmk-brainstorm, gmk-art-gen, gmk-prototype

**작업**:
- 각 SKILL의 refuse-with-recommendation 라인 식별 — grep `"Run /gmk-"` 또는 `"run \`/gmk-"`
- 매 라인 끝에 `[Rule 14] /gmk-<this> → /gmk-<target> — verified target's preconditions can be satisfied from current state.` 토큰 추가
- 또는 cycle 경우: `[Rule 14 — CYCLE]` 형태로 두 exit 명시
- 검증: `grep -L "\[Rule 14" skills/*/SKILL.md` → 토큰 없는 SKILL 0 (refuse-with-recommendation 가진 한)

**중요**: 이 작업을 *모든 SKILL에 일괄* 적용. 일부만 적용하면 v0.5와 같은 함정 재발.

### MAJOR-2: endpoint → checkpoint 8+ 위치 정정 ★★

**문제**: v0.5 CHANGELOG가 3곳 정정 청구. 실제 8+ 위치에 "endpoint" 잔존.

**위치** (evaluator 적시):
- `README.md:4` — "Endpoint: 'development complete'"
- `CONCEPT.md:67` — ASCII 다이어그램의 "🏁 development complete (gmk endpoint — user-declared)"
- `skills/gmk-dev-complete/SKILL.md:3` — frontmatter description
- `skills/gmk-dev-complete/SKILL.md:59` — "The endpoint is reached"
- `skills/gmk-dev-complete/SKILL.md:228` — "not at the endpoint"
- `skills/gmk-dev-complete/SKILL.md:248` — "stops at the endpoint"
- `skills/gmk-loop/SKILL.md:128`
- `skills/gmk-status/SKILL.md:68, 117, 132`
- `skills/gmk-port/SKILL.md:493`
- `_workspace/structure.md:48, 532`

**작업**: 각 위치를 *맥락별로* 판단해 "checkpoint" 또는 "release-readiness checkpoint"로. CHANGELOG의 v0.4 / v0.3 섹션은 *역사 기록*이라 정정 안 함 (Keep-a-Changelog 규약).

### MINOR-3: gmk-dev-complete "doesn't write canonical state" 라인 정정 ★

**문제**: `skills/gmk-dev-complete/SKILL.md:249`이 *"Doesn't write to milestones.json or pillars.json. Read-only on canonical state."* 라고 함. 그런데 같은 SKILL의 `--accept-warnings` (line 216/222)가 `warnings_acknowledged_at`을 *merge_gate/port-checklist 파일*에 씀. 모순 아닌 의도된 것이지만 모델이 line 249만 읽으면 write를 안 할 가능성.

**작업**: line 249를 *"Read-only on milestones.json / pillars.json; writes only the dev-complete report and `warnings_acknowledged_at` into merge_gate / port-checklist files."*로 정정.

### MINOR-4: v0.4 CHANGELOG inline footnote ★

**문제**: v0.4 CHANGELOG 섹션이 *"v0.4 skills no longer write these"* + *"No data loss"* 그대로. v0.5 honesty note는 같은 파일에 있지만 cross-reference 없음.

**작업**: v0.4 섹션의 해당 라인에 `(see v0.5 honesty note — applied half-way until v0.5)` 인라인 각주. Keep-a-Changelog 규약상 *과거 entry는 안 고친다*가 원칙이지만 *작은 cross-ref*은 허용 범위.

### STRUCTURAL GUARD: `check-plugin-meta.sh` 확장 ★★

**문제**: v0.4와 v0.5가 *같은 실수*를 했음 — declared standard를 partial하게 적용. structural audit script가 *자동으로* 잡아야 다음 release에서 같은 함정 차단.

**작업**: `scripts/check-plugin-meta.sh`에 두 체크 추가:
1. **Rule 14 token check**: `grep -l "Run /gmk-\|run \`/gmk-" skills/*/SKILL.md`에 매치하는 SKILL은 *반드시* `[Rule 14` 토큰을 ≥1 가짐. 위반 시 release block.
2. **Endpoint terminology check**: `skills/`, `CONCEPT.md`, `README.md`, `structure.md`에서 dev-complete state를 가리키는 "endpoint" 출현 시 warning (false positive 가능 — API endpoint 등은 별개).

스크립트 실행이 v0.6+의 *release pre-flight*가 되도록 README 또는 CHANGELOG에 명시.

---

## Protocol 1 amendment (2026-05-17, work-start evaluator) — SCOPE CORRECTED

작업 시작 전 evaluator 호출(F20/W29 정책) 결과: HANDOFF 원본 backlog **UNDERSTATED**. 같은 anchoring 패턴이 HANDOFF 작성에도 재발. 아래가 실제 시행 scope.

### MAJOR-1 corrections — 15 SKILL → 실제 10-12 SKILL (composition도 다름)

**ADD (HANDOFF가 누락)**:
- `gmk-prototype` L20+L21 — refuse-with-rec 두 줄 (Missing pillars / skipped pillars → /gmk-init)
- `gmk-ux-flow` L19 — "come back after /gmk-validate?" 사전조건 워닝
- `gmk-kill-milestone` L145 — post-action 후속 안내. 엄밀히는 refuse 아니지만 사용자 시야 구분 안 됨 → 방어적 ADD

**REMOVE (HANDOFF가 잘못 포함)**:
- `gmk-validate` — L401은 routing-table advisory, refuse 아님
- `gmk-loop` — L128은 dispatch-table advisory, L243은 confirm prompt
- `gmk-mock-inject` — L26은 usage trigger 문장
- `gmk-brainstorm` — L24는 "when not to run" 조건
- `gmk-art-gen` — L140은 recovery instruction

**VERIFY**:
- `gmk-save-migrate` L196 — multi-milestone advisory 문장으로 보임. 확인 후 REMOVE 가능성 높음
- `gmk-roadmap` — L21 + L203 **2 tokens 필요** (HANDOFF는 1개로 셈)
- `gmk-merge-gate` L156 — warning-row borderline. 토큰 부착 권고

### MAJOR-2 corrections — 13 위치 → 실제 17 위치

**ADD**:
- `CONCEPT.md:11` — §0 본문 한 단락 요약의 핵심 문장 ("kit's endpoint is 'development complete'")
- `CONCEPT.md:408` — 비교 테이블 row ("Development-completion endpoint (release out of scope)")
- `skills/gmk-prototype-rules/SKILL.md:279` — shader-shape 테이블 cell ("dev-complete endpoint accepts a shader milestone…")
- `.claude-plugin/marketplace.json:15` — 마켓플레이스 description ("project-level dev-complete endpoint (v0.3)")

**DO NOT TOUCH (명시적 제외)**:
- `skills/gmk-self-test/SKILL.md:107` — "before a clear endpoint" = 게임 세션 종료 의미, dev-complete state 아님
- `CONCEPT.md:40` — 이름 변경 자체를 설명하는 메타-discussion, "endpoint" 의도적 등장
- `.claude-plugin/plugin.json:4` — "checkpoint, not an endpoint" — v0.5에서 의도적 대조
- CHANGELOG history, HANDOFF.md 자신, `_workspace/v0.X-*.md` 역사 audit — 동결

### MINOR-3 corrections — 1 줄 → 실제 2 줄

추가 발견: **`skills/gmk-dev-complete/SKILL.md:208`** 도 동일 결함.

> L208: "This skill is **read-only on canonical state**. It writes `_workspace/dev-complete-report.md` and nothing else."

"nothing else"가 `--accept-warnings`의 `warnings_acknowledged_at` write를 부정. L249와 같은 패스에서 함께 정정.

### MINOR-4 corrections — 정확한 위치 확정

- CHANGELOG.md **L53** (헤드라인: "v0.4 skills no longer emit the 9 deprecated fields")
- CHANGELOG.md **L94** ("No data loss…")
- L92는 섹션 헤더 → 건드리지 말 것

각주 텍스트 권고: ` (see v0.5 Honesty note above — half-way applied until v0.5)` — "above"가 Keep-a-Changelog의 역연대 순서에서 cross-ref 방향 강화.

### STRUCTURAL GUARD — 2 check → 3 check (defect-class 확장)

세 번째 check 추가 권고: **Rule 13-14 citation footer 검증**.

- v0.4 CHANGELOG L133이 "27 skills got a 1-line Rule 13-14 citation" 청구. *같은 결함 형태* — 일괄 적용 청구 후 selective 가능성.
- 패턴: `## Preconditions` 섹션 있는 SKILL 각각이 `_Standard preconditions.*Rule 13-14._` footer 가져야.
- WARN level, FAIL 아님. v0.7+에서 baseline 정착 후 FAIL 승격.

기타 결정:
- 모든 3 check는 v0.6에서 **WARN level만** — false positive 가능성, baseline 미정착.
- endpoint check는 `.endpoint-allowlist.txt` 파일 별도 유지 (위 3 제외 위치 명시).

### Final verdict (evaluator)

HANDOFF v0.6 원본 그대로 시행 시 Protocol 4가 **OVERSTATED (mildly)** 3연속 판정 예상. 위 amendment 적용이 *필수*.

---

### v0.6에서 *안* 할 것

| 항목 | 이유 |
|---|---|
| 새 SKILL / 새 agent | 0개 — v0.4/v0.5 유지 |
| dogfood | 영영 차단 (W24) |
| `kit_version` read-enforcement | v0.7+ 이월 (v0.4 결정 4 유지) |
| 추가 audit (cold-read 등 새로 돌리기) | v0.5 evaluator가 적시한 작업만 완수가 목표 |

---

## v0.6 실행 protocol (F18 함정 방지)

v0.4 → v0.5 → v0.6 패턴에서 **self-audit이 매번 OVERSTATED 판정**. v0.6은 다른 protocol로:

### Protocol 1 — Work-start checkpoint

작업 시작 *전*에 evaluator 한 번 호출:
- 입력: "v0.6 backlog (이 HANDOFF의 MAJOR-1, MAJOR-2 등) 그대로 작업할 건데 *놓친 위치*나 *부수 영향*이 있는지 보라"
- 결과 받아 backlog 보강 후 작업 시작

### Protocol 2 — Mid-work checkpoint

MAJOR-1 (Rule 14 sweep) 작업 *중간* (예: 8/15 SKILL 처리 후) evaluator 한 번:
- "지금까지 8 SKILL 처리. 나머지 7개에 부수 영향 있을까? 토큰 형식 일관성 깨졌나?"
- *현재 작업 방식*이 옳은지 검증

### Protocol 3 — Pre-release checkpoint

전체 작업 끝난 후 release *전* evaluator 한 번:
- "v0.6이 backlog의 모든 항목을 닫았고 새 결함 도입 안 했나?"
- ACCURATE 판정 받기 전엔 release 안 함

### Protocol 4 — Post-release verification

release 후 마지막 evaluator (v0.5에서 한 것과 같음):
- 진짜 닫혔는지 git-based 검증

**3-4번 호출. 비용 들지만 OVERSTATED 패턴 차단 가치 > 비용.**

---

## Failed Approaches 누적

F1-F19 (이전 세션들) 전부 유효. F20 신규:

### F20 — Self-audit은 ANCHORING bias에 영원히 취약

v0.4 audit → "all 28 fixed" → OVERSTATED.  
v0.5 audit → cite-driven self-verify → 7 fix 닫혔다고 self-publish → 여전히 OVERSTATED.  

같은 *작업자*가 *작업한 범위만* 보기 때문에 *놓친 위치*는 매번 누락. v0.6은 **작업 시작 *전*에 evaluator로 scope 보강**해야 함. Protocol 1.

교훈: self-audit은 *작업이 끝났는지* 묻지 *작업 범위가 옳았는지* 묻지 않음. evaluator는 두 질문 모두 가능.

---

## Resume Instructions (v0.9 작업 시작점)

v0.8 사이클 완료. v0.9는 새 HANDOFF backlog template (`_workspace/handoff-backlog-template.md`)으로 full-apply.

### Step 0 — v0.9 작업 시작 *전* Protocol 1 (필수)

W29 정책. 작업 안 하고 evaluator 먼저 호출. 입력: "v0.9 backlog의 M-2 + M-3 + Tier 2 candidates가 *놓친 위치*나 *부수 영향* 있는지 보라. 새 HANDOFF template 적용 후 첫 Protocol 1이므로 correction ratio 추적 시작 — v0.7/v0.8과 비교."

새 template 적용 효과 측정 시작점이라 *특히 중요*.

### Step 1 — M-2 (declared-but-never-exercised audit)

각 dead branch에 synthetic test invocation OR "safety valve, last-exercised: never" notation. Rule 14 CYCLE / kit_version > current / early_fail / Math.random() 경고 4 사이트.

### Step 2 — M-3 (README skill count bump)

trivial. M-2와 함께 same commit.

### Step 3 — Protocol 3 + release

CHANGELOG v0.9 (Protocol 1 corrections count retro 필드 *반드시*) / plugin meta 0.9.0 / pre-flight / commit / push / tag / GitHub release.

### Step 4 — Protocol 4

git-based 검증. v0.6/v0.7/v0.8 3연속 ACCURATE — v0.9 4연속 목표.

### Step 5 — Post-release HANDOFF + v1.0 brainstorm

v1.0 MAJOR bump 시점 결정. backward-compat break 가능 (Rule 16 보장 종료) — v1.0 candidate audit 필요.

---

## Files to Know (v0.6 시작 시 권장 정독)

| 파일 | 왜 |
|---|---|
| `CHANGELOG.md` v0.5.0 섹션 | v0.5의 honest note 포함. v0.4 → v0.5 사이 *무엇이 missed였는지* 본문 |
| `skills/gmk-prototype-rules/SKILL.md` Rule 14 (lines 385-398) | mandatory 토큰 정의. v0.6은 이 정의를 *적용*만 함 |
| `skills/gmk-self-test/SKILL.md` Preconditions §2 (lines 29-38) | Rule 14 토큰 *모범 적용* 사례. 다른 15 SKILL이 따라야 할 형식 |
| evaluator 결과 (이 HANDOFF의 "v0.5 evaluator 결과" 섹션) | 어떤 작업이 *왜* 필요한지 근거 |

---

## Current State

**Working (v0.5.0 release 완료, origin 동기화)**:
- 29 skills + 4 agents
- 7 v0.5 fix 모두 cite 위치에서 PASS
- CHANGELOG v0.5 entry
- plugin.json + marketplace.json v0.5.0
- tag v0.5.0 origin 동기화
- 이 HANDOFF (v0.6 backlog 대기)

**Uncommitted Changes** (gamemaker-kit/): 이 HANDOFF 갱신 하나만. 다음 세션 시작 시 *작은 commit* 또는 v0.6 작업과 함께.

**dino-run**: readonly 유지.

---

## Setup Required

v0.5와 동일. plugin reinstall 권장.

---

## Warnings (누적)

### W1-W28
이전 HANDOFF.md / git history 참조. 전부 유효.

### W29 (v0.6 신규) — Self-audit ANCHORING은 매번 OVERSTATED

F20 정책화. v0.6 시작 전 *반드시* Protocol 1 (work-start evaluator)부터.

### W30 (v0.6 신규) — Rule 14 토큰 일괄 적용 안 하면 v0.6도 OVERSTATED

mandatory 선언만 하고 부분 적용은 *defect 도입* 행위. 15 SKILL 모두 토큰 부착할 의지 있을 때만 v0.6 시작. 일부만 할 거면 *mandatory* 선언부터 풀어야 함 (룰북 정정 + CHANGELOG honest note).

---

## Task List (이번 세션 종료 시점)

이번 세션 완료:
- v0.5 G-A~G-G 7 fix + endpoint 카피 + CHANGELOG/plugin meta/HANDOFF
- commit `87595bc` + tag v0.5.0 + push 완료
- evaluator 재검증 (Part 1 CLOSED + Part 2 MAJOR 2개 발견 + Part 3 OVERSTATED)
- 이 HANDOFF에 v0.6 backlog 정리 완료

다음 세션:
- Step 0 Protocol 1 (work-start evaluator) — *작업 전*
- Step 1 STRUCTURAL GUARD 먼저
- Step 2-4 MAJOR/MINOR sweep
- Step 5 Protocol 3 (pre-release)
- Step 6 release + Protocol 4

---

*v0.5.0 origin 동기화 완료. v0.6 작업 시작 전 evaluator 호출이 첫 단계.*
