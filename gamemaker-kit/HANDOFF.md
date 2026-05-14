# Handoff: gamemaker-kit v0.4.0 — Quality-of-Life 릴리스 완료

**Generated**: 2026-05-15 (01:10 KST)
**Branch**: main (push 전)
**Latest commit (pre-v0.4)**: `6597cc9 docs(gamemaker-kit): post-push HANDOFF reflection — v0.3.0 origin synced`
**Status**: v0.4.0 모든 Wave (α/β/δ/γ/ε/ζ) 구현 완료. 미커밋 (다음 단계: 단일 commit + push + release).

---

## Goal (지속)

게임 개발 자동화 Claude Code 플러그인 `gamemaker-kit`. 4축 (시간·직군·검증·통합) × 개발 완료 끝점. 외부 사용자 0%, 외부 계정 0개.

v0.4의 한 줄 약속: **"v0.3 wiring 위의 *quality-of-life*. orphan flag · precondition 일관성 · trace data 정리 · schema versioning · agent routing 표준화."**

---

## v0.4 릴리스 (완료)

| Wave | 내용 |
|---|---|
| α | Orphan flag 정리 — 7 SKILL Sub-flags 섹션 + cross-skill orphan 0건 |
| β | Precondition 일관성 — Rule 13/14 신설 + 27 SKILL citation |
| δ | Agent routing 표준화 — Rule 15 신설 + 8 routing SKILL citation |
| γ | Schema 정리 (breaking) — 9 deprecated 필드 + `kit_version` + pillars-example.json 신규 + example.json 갱신 |
| ε | 운영/마이너 11결함 — lock 자동만료, dashboard archive, save-migrate 와이어링, accept-warnings persist, 등 |
| ζ | CHANGELOG v0.4 + plugin/marketplace 0.4.0 + 이 HANDOFF |

최종: **29 skills + 4 domain agents** (변경 없음 — v0.4는 새 SKILL/agent 0).
plugin.json + marketplace.json 모두 v0.4.0.

**Backward-compat**: v0.3 자산 무손실. 스키마 변경은 *추가*만 (`kit_version`) + *write 중단*만 (9 deprecated 필드). 데이터 손실 0.

---

## v0.4가 *안* 한 것

| 항목 | 이유 |
|---|---|
| 새 SKILL | 모든 결함을 *연결*/*정합성*으로 풀음 (v0.3 원칙 유지) |
| 새 agent | 4 specialists 충분 |
| dogfood | 사용자 방침 (2026-05-14 확정) — audit-only |
| 4축 모델 변경 | finding 없음 |
| `--autocode` HTML 자동 생성 | v0.3 scaffold-only 결정 유지 |
| shader full WebGL2 template | minimal stub이 *의도된 디자인* |
| dino-run 재방문 | readonly 유지 (F10/W17) |
| `kit_version` read-enforcement | v0.4는 write만, v0.5 검토 |
| trace data mining SKILL | 결정 1로 deprecate 채택 — git history가 trace |

---

## v0.4 audit이 잡은 28 defects 처리 상태

3-view audit 결과 (cold-read 10 + adversarial 10 + schema 8) → 8 통합 그룹 (G1-G8) → 6 Wave로 분해.

| 코드 | 항목 | 상태 |
|---|---|---|
| **G1** | gmk-validate orphan flag (rebaseline/accept-regression/skip) | ✅ Wave α |
| **G2** | gmk-port `--force-rebuild` alias | ✅ Wave α |
| **G3** | milestone-id resolve + empty state | ✅ Wave β Rule 13 |
| **G4** | Trace data (9 write-only 필드) | ✅ Wave γ deprecate |
| **G5** | Schema 정합성 (example.json, structure.md, pillars-example.json) | ✅ Wave γ |
| **G6** | Agent routing 표준화 | ✅ Wave δ Rule 15 |
| **G7** | Lock 자동 만료 + race 보호 | ✅ Wave ε |
| **G8** | Plugin meta / dashboard archive | ✅ Wave ε |
| **AD-5** | Refuse-chain cycle guard | ✅ Wave β Rule 14 |
| **CR-2** | Portability-check JSON persist | ✅ Wave ε |
| **CR-3** | Shader template "Wave D" 카피 | ✅ Wave ε |
| **CR-4** | "Future skill" dangling | ✅ Wave ε |
| **CR-5** | Hand-edit 정책 명문화 | ✅ Wave β Rule 13 |
| **CR-6** | `--bot-only` 의미 모호 | ✅ Wave α (gmk-prototype Sub-flags) |
| **AD-4** | `--force` semantics SKILL별 | ✅ Wave α (각 Sub-flags 표) |
| **AD-7** | Refuse 메시지 다국어 일관성 | ✅ Wave β Rule 13 (영어 통일) |
| **AD-8** | `--accept-warnings` 비-persist (W20) | ✅ Wave ε persist 도입 |
| **SC-9** | schema_version 부재 | ✅ Wave γ `kit_version` |
| **J** (v0.3 carry-over) | save-migrate → merge-gate | ✅ Wave ε Step 5.5 warning |

★★ 12개 + ★ 16개 — **모두 처리**. v0.4 audit이 발견한 정상 결함 0 (SC-3는 audit 중 자체 정정).

---

## v0.5 후보 (자연 발생, 비포커스)

audit 작업 중 *명시적으로 v0.5+에 미룬* 항목:
- `kit_version` read-enforcement (v0.4는 write만)
- `gmk-init --migrate` 자동 마이그레이션 플래그
- 단일 세션에서 hand-edit 추천이 ≥3회 발생하면 새 SKILL 후보 (Rule 13의 정책)
- v0.4 자체가 발견하지 못한 결함 (실 사용 후 자연 발생)

이건 *backlog*가 아니라 *발견 후보*. v0.5 시작 시 새 audit으로 확정.

---

## Failed Approaches (Don't Repeat These)

v0.2/v0.3 누적 + 이번 세션 신규.

### F1-F15 — 이전 세션들 (전부 유효)
이전 HANDOFF.md git history 참조 (dogfood-findings 파일은 v0.3 종료 시 폐기됨).

### F16 — 이번 세션 신규 (May 15)

**dogfood-findings를 다른 이름으로 보존하지 말 것.**

Path B 진행 중 처음에 v0.4-backlog-candidates.md에 dino-run findings + Wave 분해를 추가했음. 사용자 피드백: *"dogfood내용 다 삭제해줘 이게 도대체 왜들어가있는거야"* — 정당한 지적. 폐기 결정이 *파일 보존*까지 인정한 게 아니었음. 정책상 dogfood-driven backlog는 *완전 폐기*이며, 발견을 *어떤 형태로든* backlog에 끌고 가는 시도 자체가 정책 위반.

교훈: dogfood가 정책상 차단됐다면 그 *findings*도 동일하게 차단. *경로*만 차단하고 *데이터*는 우회로 끌고 오지 말 것.

### F17 — 이번 세션 신규

**`v0.3 자동해결 여부 매트릭스`처럼 dogfood findings를 *비교 도구*로 살리려 하지 말 것.**

F16과 같은 뿌리. 11 findings의 v0.3 자동해결 매트릭스를 만든 작업도 사용자가 폐기 결정으로 미루어 봤을 때 *결국 dogfood findings를 비교 데이터로 사용한 것*. 이것도 정책 위반.

---

## Key Decisions (이번 세션)

| 결정 | 어디에 명시했나 |
|---|---|
| **v0.4 = audit-driven (정책 확정 재확인)** | v0.4-skeleton-audit.md §0 |
| **3-view audit (cold-read / adversarial / schema-first)** | v0.4-skeleton-audit.md §0 |
| **dogfood-findings 폐기 + 파일 삭제** | HANDOFF.md (이전 섹션) + CHANGELOG v0.3 정정 |
| **결정 1: trace data 9 필드 deprecate** | Wave γ |
| **결정 2: precondition은 gmk-prototype-rules Rule 13/14 확장** | Wave β |
| **결정 3: agent routing은 prototype-rules Rule 15 공통 block** | Wave δ |
| **결정 4: `kit_version` v0.4 도입 + read는 v0.5** | Wave γ |
| **결정 5: `--force-rebuild` = `--stage 1` alias** | Wave α (gmk-port Sub-flags) |

---

## Current State

**Working** (v0.4.0 모든 구현 완료, 미커밋):
- 29 skills + 4 agents — 변경 없음
- 7 SKILL에 Sub-flags 정식 섹션
- 27 SKILL에 Rule 13-14 citation
- 8 routing SKILL에 Rule 15 citation
- prototype-rules에 Rule 13/14/15 추가
- structure.md 보강 (path/policy/touched_files/custom/deprecated)
- example.json v0.4 형태
- pillars-example.json NEW
- scripts/check-plugin-meta.sh NEW
- CHANGELOG v0.4 섹션
- plugin.json + marketplace.json v0.4.0
- 이 HANDOFF

**Uncommitted Changes** (gamemaker-kit/): 전부. 단일 commit + push 권장.

**dino-run 상태**: **readonly** — 손 안 댐 (F10/W17 함정 차단). 변화 없음.

---

## Files to Know (다음 세션 권장 정독)

| 파일 | 왜 중요한가 |
|---|---|
| `_workspace/v0.4-skeleton-audit.md` | **v0.4의 *왜*. 3-view audit, 28 defects, 8 그룹, 6 Wave.** |
| `_workspace/v0.4-backlog.md` | Wave α-ζ plan + 5 결정 |
| `_workspace/v0.4-audit-coldread.md` | Cold-read 시각의 10 결함 |
| `_workspace/v0.4-audit-adversarial.md` | Adversarial 시각의 10 결함 |
| `_workspace/v0.4-audit-schema.md` | Schema 시각의 9 결함 |
| `_workspace/structure.md` | **v0.4 보강 — path/policy/custom/deprecated 명시** |
| `_workspace/examples/pillars-example.json` | NEW — pillars schema reference |
| `_workspace/examples/milestones-example.json` | v0.4 정정 (kit_version, kill_reason, deprecated 필드 제거) |
| `skills/gmk-prototype-rules/SKILL.md` | **Rule 13/14/15 추가 — 27 SKILL의 공통 규약** |
| `CHANGELOG.md` v0.4.0 섹션 | 전체 변경 + migration notes |
| `scripts/check-plugin-meta.sh` | NEW — 릴리스 sanity script |

---

## Resume Instructions (다음 세션)

### Step 0 — Single commit + push

```bash
git add -A
git commit -m "feat(gamemaker-kit): v0.4.0 quality-of-life release — orphan flag resolution, precondition standardization, schema cleanup"
git push origin main
git tag v0.4.0
git push origin v0.4.0
```

(또는 `/release` 스킬 사용.)

### Step A — v0.4 sanity verification (15 min)

1. `bash scripts/check-plugin-meta.sh` 실행 → PASS 기대
2. grep 검증:
   - `Rule 13-14` in skills/ → 27 hit
   - `Rule 15` in skills/ → 9 hit (8 SKILL + prototype-rules 3 self-ref)
   - deprecated fields in SKILL write code → 0 (모두 "v0.4 deprecation:" 노트로 교체됨)
3. example.json + pillars-example.json JSON 유효성

### Step B — v0.5 audit 또는 정지

v0.4 audit은 *3 시각*으로 매우 철저했음. v0.5는 *실 사용*에서 발견되는 결함 외엔 잡을 게 없을 가능성. dogfood 정책상 제외이므로 *시간이 흐른 후* 자연 발견을 대기하는 게 합리.

대안: **Path D (다른 프로젝트)** — TaskForge Pro / ZooMerge / 다른 게임으로 이동. v0.4가 *진짜 quality-of-life 끝점*에 가깝다면 v0.5는 *자연 누적*이 필요.

### Step C — `kit_version` v0.5 enforcement plan

v0.4가 *write만* 했음. v0.5는 *read 시 검증*. 즉:
- old file (`kit_version` 부재 or `< 0.5.0`)을 v0.5 SKILL이 만나면 어떻게 할지: 자동 마이그레이션? 거부? warn-and-continue?
- 이건 v0.5 결정의 첫 번째 항목.

---

## Setup Required

v0.3과 동일:
- Node + npm + Playwright (이미 설치됨)
- gamemaker-kit plugin reinstall 권장 (v0.4.0 Rule 13-15 + Sub-flags 본문 자동완성에 반영됨)

**선택**:
- Godot CLI (gmk-port)
- gitleaks (gmk-merge-gate)
- ComfyUI on :8000 (gmk-art-gen)

**환경 변수**: 없음.

---

## Warnings

### W1-W22 — 이전 세션들에서 누적
이전 HANDOFF.md / git history 참조. 전부 유효.

### W23 — 이번 세션 신규

**v0.4는 dogfood 없이 머지됐음 (정책 확정) — 실 게임 회귀 검증이 영구 부재.**

v0.3 W19와 같은 종류이지만 v0.4에서 *정책 확정* — 회귀 검증이 *영영 없음*. v0.4 audit이 3 시각으로 매우 철저하지만, *audit이 놓친 영역*은 실 사용 누적으로만 발견 가능. v0.5 이후 결함은 자연 누적 시간이 필요.

### W24 — 이번 세션 신규 (F16/F17의 정책화)

**dogfood-findings를 *어떤 형태로든* backlog에 반영하지 말 것.**

폐기 결정은 *파일 보존*도 *비교 도구로 살리기*도 *findings를 다시 이름붙여 재활용하기*도 인정하지 않음. 다음 세션에서 *유사한 충동*이 들어도 차단. dogfood-driven 자체를 *영영* 차단.

### W25 — 이번 세션 신규

**v0.4 deprecated 9 필드는 *읽기는* 정상 — 사용자 데이터를 자동 삭제하지 않음.**

v0.4 SKILL이 *쓰기*는 안 하지만 v0.3 파일에 남아있는 데이터는 *그대로 남음*. 사용자가 *명시적으로* `gmk-init --migrate` (v0.5 후보) 또는 hand-edit으로 정리. 자동 삭제는 안 함 — 데이터 손실 위험.

### W26 — 이번 세션 신규

**`kit_version`은 v0.4에서 *write만*. read 검증은 v0.5.**

v0.4 SKILL이 *기록*하지만 *읽고 가드*하지 않음. 즉 사용자가 `kit_version: "0.1.0"`으로 손으로 적어도 v0.4 SKILL은 정상 진행. read enforcement는 v0.5에서 결정 (자동 마이그레이션 vs 거부 vs warn).

---

## Task List 상태 (이번 세션 종료 시점)

이번 세션 완료:
- #1-7: Path A 4 fixture 검증 PASS
- #6-7: v0.4-backlog-candidates.md 갱신 → 폐기 결정 → 파일 삭제 + 참조 정리
- #8-11: 3-view audit (cold/adv/schema) + v0.4-skeleton-audit.md 통합
- 5 결정 확정 (trace data deprecate / precondition Rule 13 / agent routing Rule 15 / kit_version write-only / force-rebuild alias)
- #12-15: Wave α (Sub-flags 7 SKILL + orphan 0건)
- #16-17: Wave β (Rule 13/14 + 27 SKILL citation)
- #18: Wave δ (Rule 15 + 8 SKILL citation)
- #19: Wave γ (schema deprecate + kit_version + pillars-example + structure.md)
- #20: Wave ε (lock 자동만료 + portability-check JSON + dashboard archive + shader 카피 + save-migrate 와이어링 + accept-warnings persist + future skill 정리 + plugin meta script + hand-edit/refuse 정책)
- #21: Wave ζ (CHANGELOG + plugin/marketplace + 이 HANDOFF)

다음 세션:
- Step 0 commit + push + release
- Step A sanity verification
- 또는 Step B (Path D 다른 프로젝트로 이동)

---

*이 HANDOFF는 v0.4.0 *구현 완료* 시점 기록. commit 후 reflection HANDOFF 추가 권장.*
