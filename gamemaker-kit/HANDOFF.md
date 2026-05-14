# Handoff: gamemaker-kit v0.5.0 — Post-v0.4 Hotfix 완료

**Generated**: 2026-05-15 (01:35 KST)
**Branch**: main (push 전)
**Latest commit (pre-v0.5)**: `e98b72b feat(gamemaker-kit): v0.4.0 quality-of-life`
**Status**: v0.5.0 모든 G-A~G-G 구현 완료. 미커밋 (다음 단계: 단일 commit + push + tag v0.5.0).

---

## Goal (지속)

게임 개발 자동화 Claude Code 플러그인 `gamemaker-kit`. 4축 (시간·직군·검증·통합) × 개발 완료 체크포인트. 외부 사용자 0%, 외부 계정 0개.

v0.5의 한 줄 약속: **"v0.4가 *주장한* 'no data loss / 9 fields safe to drop'이 실제로 그렇게 되도록 한다. 외부 evaluator가 잡은 7 regression을 닫는다."**

---

## v0.5 — 왜 즉시 release 됐나

v0.4 release 직후 사용자가 두 외부 evaluator를 돌림:
1. **general-purpose**: 외부 비교 — gamemaker-kit이 *진짜* 차별점 있는지. **결과: YES**, 5-stage 통합 계약이 unoccupied niche.
2. **evaluator agent**: 내부 일관성 — v0.4 audit이 *놓친* 결함 있는지. **결과: 7 regressions found**.

이 7개는 *v0.4가 자신의 deprecation을 반만 적용한 채로* release한 결과. evaluator의 OVERSTATED 판정 받아들이고 즉시 hotfix.

---

## v0.5 fixes (완료)

| 코드 | 위치 | v0.5 처리 |
|---|---|---|
| **G-A** | prototype-rules Rule 14 | "in model's reasoning" → grep 가능한 `[Rule 14]` / `[Rule 14 — CYCLE]` 토큰 mandatory. self-test §2에 shader INCONCLUSIVE + `--skip` 명시적 acceptance 추가. |
| **G-B** | gmk-kill-milestone (4곳) | line 68/182/193/238의 "preserved in kill_history" 모두 git history 기반 표현으로 교체 |
| **G-C** | gmk-self-test (3곳) | Sub-flags `--record` + `--thin-ok` + line 351 edge case에서 sessions[]/coded_themes write 제거 |
| **G-D** | gmk-validate line 478 | "appends to validation_history" → "overwrites top-level validation directly" |
| **G-E** | prototype-rules Rule 10 | self-test 데이터 landing site를 sessions[] → latest_verdict 등 + 디스크 파일로 정정. **룰북이 ground truth**이므로 가장 load-bearing 수정 |
| **G-F** | structure.md merge_gate + port-checklist template | `warnings_acknowledged_at` 필드 명시 + 무효화 규칙 |
| **G-G** | gmk-dev-complete C5 | double-force (validation+self-test 둘 다 forced) → FAIL (acknowledge 불가). 단일 force는 WARN 유지 |
| endpoint 카피 | CONCEPT.md, gmk-dev-complete | "endpoint" → "release-readiness checkpoint". checkpoint는 recomputable임을 명시 |

---

## v0.5가 *안* 한 것

| 항목 | 이유 |
|---|---|
| 새 audit wave | v0.4 audit framework 유지. v0.5는 *적용*만 수정 |
| 새 SKILL / agent | 0개 — v0.4 원칙 유지 |
| dogfood | 영영 차단 (W24) |
| `kit_version` read-enforcement | v0.6 이후 (v0.4 결정 4 유지) |
| CR-5 / AD-7 재분류 | grade 조정만 *문서상*, 작업 변경 없음 |

---

## Failed Approaches (이번 세션 신규)

이전 세션의 F1-F17 그대로 유효. v0.5 신규:

### F18 — "audit이 끝났다"고 *자기 self-audit*으로 결론내지 말 것

v0.4가 3-view audit (cold-read / adversarial / schema) 후 "28 → 0 ★★★ → all fixed"로 self-publish했음. 외부 evaluator가 같은 SKILL을 보고 **7 regression**을 즉시 발견. 

교훈: *자신의 작업을 자신의 audit이 grade하면 OVERSTATED 위험 영구 존재*. 큰 결정 후엔 외부 evaluator agent를 *습관적으로* 부르는 게 안전.

### F19 — Deprecation은 "전부 다" 아니면 안 한 것

v0.4 Wave γ가 9 필드 deprecate하면서 *Step 7만* 정정하고 *Sub-flags 표 / Edge cases / 룰북 anchor*는 안 만짐. 같은 파일에서 ground truth가 *모순*되면 어느 라인을 모델이 따를지 비결정적.

교훈: deprecation은 grep으로 *모든* mention을 한 번에 정정해야 함. *일부분만* 정정한 deprecation은 결함을 *도입*하는 행위.

---

## Key Decisions (이번 세션)

| 결정 | 근거 |
|---|---|
| **v0.5 = external-evaluator-driven hotfix** | evaluator가 7 regression을 cite한 file:line으로 적시. 모두 v0.4가 *주장한* 약속을 *실행*만 안 한 것 — 결정 사항 변경 없이 *적용 완료*가 목적 |
| **endpoint → checkpoint 용어 변경** | evaluator가 정확히 적시. 3개 SKILL (roadmap / kill --revive / accept-regression)이 project 재오픈 가능 — "endpoint"는 오버셀링 |
| **double-force = FAIL (acknowledge 불가)** | evaluator G-G — validation도 self-test도 forced면 *zero evidence*. C5를 WARN으로 두는 건 안 됨 |
| **Rule 14 token mandatory** | evaluator G-A — falsifiable 안 되는 룰은 v0.5+ 룰북 표준 못 됨. `[Rule 14]` 토큰 grep으로 검증 가능 |
| **dogfood 영구 차단 (W24 확인)** | F18이 다시 발생해도 dogfood로 검증하지 않음. 외부 evaluator agent로 *audit*. |

---

## Current State

**Working** (v0.5.0 모든 구현 완료, 미커밋):
- 29 skills + 4 agents — 변경 없음 (v0.4 인벤토리 유지)
- 7 G-A~G-G regression 모두 fix
- "endpoint" 카피 5개 위치 정정
- CHANGELOG v0.5 섹션
- plugin.json + marketplace.json v0.5.0
- 이 HANDOFF

**Uncommitted Changes** (gamemaker-kit/): 8 파일. 단일 commit + push 권장.

**dino-run 상태**: **readonly** — 손 안 댐.

---

## Files Touched in v0.5

| 파일 | 변경 |
|---|---|
| `skills/gmk-kill-milestone/SKILL.md` | G-B: 4곳 kill_history 표현 정정 |
| `skills/gmk-self-test/SKILL.md` | G-C: 3곳 sessions[]/coded_themes write 제거 + G-A: §2 shader/skip acceptance 추가 |
| `skills/gmk-validate/SKILL.md` | G-D: line 478 validation_history append 제거 |
| `skills/gmk-prototype-rules/SKILL.md` | G-E: Rule 10 self-test landing site 정정 + G-A: Rule 14 grep 가능 토큰 |
| `_workspace/structure.md` | G-F: merge_gate / port-checklist template에 warnings_acknowledged_at 추가 |
| `skills/gmk-dev-complete/SKILL.md` | G-G: C5 double-force FAIL 분기 + endpoint 카피 정정 |
| `CONCEPT.md` | endpoint → checkpoint 카피 정정 |
| `CHANGELOG.md` | v0.5 섹션 |
| `.claude-plugin/plugin.json` + `marketplace.json` | 0.5.0 |
| `HANDOFF.md` | 이 파일 |

---

## Resume Instructions (다음 세션)

### Step 0 — Single commit + push + tag

```bash
git add -A
git commit -m "fix(gamemaker-kit): v0.5.0 hotfix — 7 regressions from v0.4 half-applied deprecations"
git push origin main
git tag v0.5.0
git push origin v0.5.0
```

### Step A — v0.5 sanity verification

1. `grep -rn "appends to.*kill_history\|preserved in kill_history\[\]" skills/gmk-kill-milestone/SKILL.md` → 0 (deprecation 명시문 제외)
2. `grep -n "sessions\[\]\|coded_themes" skills/gmk-self-test/SKILL.md` → write 명령 0
3. `grep -n "validation_history" skills/gmk-validate/SKILL.md` → write 명령 0
4. `grep -n "\[Rule 14\]" skills/` → ≥2 hit (gmk-self-test §2 등)
5. dev-complete C5 분기 + double_forced_gates 도출 확인

### Step B — 또 외부 evaluator 부를지 결정

v0.4가 self-audit OVERSTATED였음. v0.5도 self-audit이면 *같은 함정* 가능. 두 옵션:
- (a) v0.5도 외부 evaluator로 검증 — **권장** (F18 교훈)
- (b) v0.5는 v0.4 evaluator의 *cite를 그대로 따라간* 작업이므로 self-verify로 충분

**현재 시점 권고**: Step 0 commit + push 먼저. 그 다음 (a) 외부 evaluator를 한 번 더 부르거나, (b) 다른 작업으로 이동.

### Step C — `kit_version` read enforcement는 v0.6

여전히 v0.5에서 미도입. v0.4 결정 4 유지.

### Path D — 다른 프로젝트

TaskForge Pro / ZooMerge / 다른 게임으로 이동. v0.4 + v0.5로 gamemaker-kit은 *외부 evaluator도 PASS한* 상태가 됨 (Step B-a 실행 시 확정).

---

## Setup Required

v0.4와 동일. plugin reinstall 권장 (v0.5.0 Rule 14 토큰 + C5 double-force 동작 반영).

---

## Warnings

### W1-W22 — 이전 세션들에서 누적
이전 HANDOFF.md / git history 참조. 전부 유효.

### W23 (v0.4) — 영구 부재 회귀 검증
v0.3 W19와 같은 종류. dogfood 정책상 영구 미검증. v0.4 → v0.5는 *외부 evaluator agent*로 부분 보완 — but 실 게임 회귀는 여전히 0.

### W24 — dogfood-findings 영영 차단
F18/F19와 별개로 정책 유지.

### W25 — v0.4 deprecated 9 필드 데이터는 *읽기* 정상
v0.5도 동일. 사용자 데이터 자동 삭제 안 함.

### W26 — `kit_version`은 *write만*
v0.5도 동일. read enforcement는 v0.6+.

### W27 — v0.5 신규: self-audit은 OVERSTATED 위험 영구
v0.5가 외부 evaluator의 cite를 따라가서 작업했지만, *v0.5 자체*도 self-audit으로 PASS 판정 내릴 수 없음. 외부 evaluator를 v0.5에 한 번 더 부를지가 다음 결정 (Resume Step B).

### W28 — Rule 14 token은 v0.5+에서만 mandatory
v0.4 또는 이전 세션이 만든 refuse-message는 `[Rule 14]` 토큰 부재해도 호환. v0.5 SKILL이 *새로* 만드는 출력만 토큰 필수. grep audit는 v0.5 이후 출력에만 적용.

---

## Task List 상태 (이번 세션 종료 시점)

이번 세션 완료:
- #22 G-B kill_history 4곳 정리
- #23 G-C self-test 3곳 정리
- #24 G-D validate line 478
- #25 G-E rulebook Rule 10
- #26 G-F warnings_acknowledged_at schema
- #27 G-G double-force FAIL
- #28 G-A Rule 14 falsifiable + self-test §2 shader 예외
- #29 endpoint 카피 정정
- #30 CHANGELOG + plugin meta + HANDOFF — **진행 중 (이 commit이 끝)**

다음 세션:
- Step 0 commit/push/tag
- Step A sanity verify
- Step B 외부 evaluator 한 번 더 (or 다른 작업)

---

*이 HANDOFF는 v0.5.0 *구현 완료* 시점 기록. commit 후 reflection HANDOFF는 추가 안 함 (v0.4 reflection commit이 sufficient pattern).*
