# Handoff: gamemaker-kit v0.3 — 스켈레톤 완성 릴리스 완료

**Generated**: 2026-05-14 (23:30 KST)
**Branch**: main
**Latest commits**: Wave A `41aa658` → Wave B `821d12d` → Wave C `e650d68` → Wave D `1629555` → Wave E (about to commit)
**Status**: v0.3.0 모든 Wave (A/B/C/D) 완료. Wave E (CHANGELOG + version bump + 이 HANDOFF) 마무리 중. dogfood 안 함 (v0.3 audit-driven).

---

## Goal (지속)

게임 개발 자동화 Claude Code 플러그인 `gamemaker-kit`. 4축 (시간·직군·검증·통합) × 개발 완료 끝점. 외부 사용자 0%, 외부 계정 0개.

v0.3의 한 줄 약속: **"v0.2 뼈대를 *작동 가능*하게 만든다. v0.2가 약속한 4축·6직군·4 specialists·dev-complete endpoint가 *형태로만* 존재하는 부분을 *연결*한다."**

---

## v0.3 릴리스 (완료)

| Wave | 커밋 | 내용 |
|---|---|---|
| A | `41aa658` | Agent wiring — 8 SKILL이 4 agents reference (v0.2는 2개만) |
| B | `821d12d` | `gmk-dev-complete` NEW + endpoint 호출 경로 wiring |
| C | `e650d68` | structure.md drift — 15+ file kinds 추가 + CONCEPT endpoint 동기화 |
| D | `1629555` | 호출 그래프 보강 (ux-flow→self-test, kill→roadmap, shader path, HTML 정책) |
| E | (this commit) | CHANGELOG v0.3 + plugin/marketplace 0.3.0 + HANDOFF |

최종: **29 skills (28 + dev-complete) + 4 domain agents**. plugin.json + marketplace.json 모두 v0.3.0.

**Backward-compat**: v0.2 자산 무손실. 스키마 변경 0개. v0.2 사용자는 SKILL 업데이트만 받으면 새 wiring 사용 가능.

---

## v0.3가 *안* 한 것

| 항목 | 이유 |
|---|---|
| Dogfood 2차 | audit-driven 접근 — 새 게임을 만들지 않고 fixture / 정적 검증으로 끝냄. dogfood findings는 *낮은 우선순위*로 v0.4 backlog |
| 새 agent | 4 agents 자체는 충분, *wiring*이 v0.2의 진짜 defect |
| 새 SKILL (dev-complete 제외) | finding은 *연결*로 풀림, *추가*가 아님 |
| 스키마 변경 | 끝점 추가는 read-only 검사로 충분 |
| 4축 모델 변경 | audit가 4축 자체엔 finding 없음 |
| dino-run 재방문 | F10/W17 함정 차단 — readonly evidence |

---

## v0.3 audit이 잡은 18 defects 처리 상태

| 코드 | 항목 | 상태 |
|---|---|---|
| K | SKILL이 agents 미호출 | ✅ Wave A로 해결 (8 SKILLs reference) |
| S | 프로젝트 dev-complete endpoint 없음 | ✅ Wave B `gmk-dev-complete` SKILL 신규 |
| L | agent 산출물 structure.md 누락 | ✅ Wave C 추가 |
| M | 11+ file kinds structure.md 누락 | ✅ Wave C 추가 |
| F | port → endpoint 미연결 | ✅ Wave B port stage 6 → dev-complete |
| A | HTML 생성 정책 모호 | ✅ Wave D Rule 12 명시 |
| Q | "끝점" 정의 문서 모호 | ✅ Wave C CONCEPT § 1.3 |
| C | FTUE 검증 위치 빈칸 | ✅ Wave D self-test ↔ ux-flow |
| I | kill → roadmap 미연결 | ✅ Wave D Step 6 추가 |
| U | shader 검증 경로 불명 | ✅ Wave D Rule 11 추가 |
| D/E | port stage 5 audio/art check | ✅ 이미 v0.2에 있음 (확인) |
| G | art-gen → prototype 연결 | ✅ 이미 v0.2에 있음 (확인) |
| H | sound 생성 SKILL | ✅ mock-inject 이미 SFX 다룸 (확인) |
| N | engine save-schema.json 위치 | ✅ Wave C structure.md 추가 |
| R | "외부 의존 0개" 카피 | ✅ CONCEPT § 6.3 line 324 정직 (확인) |
| T | gmk-art-gen `/art` 의존 | ✅ CONCEPT § 6.3 line 323 명시 (확인) |
| J | save-migrate → merge-gate | (Wave D 후 검토 — 영향 작음, v0.4) |
| O/P | trials[]/validation_history write-only? | (Wave C에서 부분 명시; v0.4 추가 검토) |

★★★ 2개 (K, S) + ★★ 5개 모두 처리됨. ★ 14개 중 대부분 처리, 2개 (J, O/P) v0.4로 deferred.

---

## v0.4 후보 backlog (보존)

`_workspace/v0.4-backlog-candidates.md` (구 `dogfood-findings-v0.2.md`):
- dino-run dogfood 11 findings (C1-C3 / M4-M7 / N8-N11)
- v0.3 audit에서 *낮은 우선순위*로 분류됐던 것

v0.3 audit 산출물:
- `_workspace/v0.3-skeleton-audit.md` — 7-axis audit, 18 defects 분류
- `_workspace/v0.3-backlog.md` — Wave 분해 + 결정 사항
- `_workspace/extension-design-v0.3.DOGFOOD-DRIVEN.discarded.md` — 폐기된 dogfood-driven plan (history)

---

## Failed Approaches (Don't Repeat These)

v0.2 누적 + 이번 세션 신규.

### F1-F12 — 이전 세션들 (전부 유효)
이전 HANDOFF / dogfood-findings 참조.

### F13 — 이번 세션 신규 (May 14)

**"Dogfood findings"를 v0.3 backlog의 *전부*로 받지 말 것.**

처음에 `extension-design-v0.3.md`를 dogfood findings 11개로 분해해서 Wave A/B/C로 짰음. 사용자 피드백: *"dogfood방식 자체에 굉장히 비판적이야 여기에 너무 매몰되어서 플러그인 전체가 dogfood를 위한 플러그인이 되어버려"* — 정확한 지적. dogfood findings는 *한 게임의 fit 문제*이지 *플러그인 뼈대 미완 항목*과 다른 것. 폐기하고 **structural audit**으로 갈아엎음. audit이 잡은 ★★★ K (agent wiring) + S (dev-complete endpoint)가 진짜 backlog였고, dogfood findings 11개 중 어느 것도 audit ★★★/★★ 항목에 매핑 안 됨.

교훈: dogfood는 *evidence 후보 1개*이지 backlog 그 자체가 아님. 뼈대 점검은 audit으로.

### F14 — 이번 세션 신규

**`gmk-design-system`은 user-facing 워킹 스펙이고 `systems-designer` agent는 strict 컨트랙트 스펙이라는 *역할 분리*는 명시 안 돼 있었음 — Wave A에서 보충.**

audit 중 발견: 두 산출물 모두 milestone의 system을 다루는데, 어떤 게 *user 읽기용*이고 어떤 게 *downstream 코드 생성용*인지 v0.2 어디에도 없었음. v0.3 Wave A에서 `gmk-design-system` Step 9 (역할 분리 명시) + `gmk-port` Stage 1a.5 (system-spec 있으면 그것 사용, 없고 non-trivial이면 agent 호출 후 대기) 추가로 해결.

### F15 — 이번 세션 신규

**HANDOFF.md가 외부 도구에 의해 May 12 버전으로 두 번 reverted됨 (10:42 + 11:24).**

이번 세션에서 HANDOFF.md 두 번 모두 수정 시도, 두 번 모두 old 버전으로 덮어써짐. 원인 불명 (외부 자동 도구 또는 syncing 충돌). 해결: 매 Wave 후 HANDOFF가 *commit된* 버전인지 git status로 확인. working tree가 stale하면 `git checkout HANDOFF.md`로 복구 후 새 내용 Write.

---

## Key Decisions (이번 세션)

| 결정 | 어디에 명시했나 |
|---|---|
| **v0.3 = audit-driven, not dogfood-driven** | `v0.3-skeleton-audit.md` §0 + `v0.3-backlog.md` §0 |
| **신규 SKILL 0개 원칙 (B1 dev-complete 제외)** | `v0.3-backlog.md` §3 P4 |
| **dino-run readonly evidence** | `v0.3-backlog.md` §2 P2 (F10 함정 차단) |
| **`gmk-dev-complete` 이름 선택** | "ship-readiness" / "graduate" 후보 중 v0.2 카피와 일치하는 "dev-complete" 채택 |
| **HTML 코드 생성 = scaffold-only** | `gmk-prototype-rules` Rule 12 명시 (v0.2 의도 보존, 결정 2 = a) |
| **sound integration = mock-inject 경로** | structure.md 명시 + mock-inject가 이미 SFX 다룸 (결정 3 = c) |
| **dogfood 2차 = 안 함** | audit + 정적 검증 + fixture로 충분 (결정 4 = c) |
| **dogfood-findings-v0.2.md → v0.4-backlog-candidates.md** | 파일 이름 변경 (결정 5 = a) |
| **Agent 호출은 *추천*이지 auto-invoke 아님** | gmk-loop "NOT do" 섹션에 명시. `max-iteration=1` 보존 |

---

## Current State

**Working** (v0.3 완전):
- 29 skills + 4 agents 전부 install 가능
- CHANGELOG.md / CONCEPT.md v0.3 기준
- plugin.json + marketplace.json v0.3.0
- 모든 wave (A/B/C/D) committed; Wave E (이 커밋) 진행 중

**Uncommitted Changes** (gamemaker-kit/): Wave E (CHANGELOG + version bump + 이 HANDOFF) 만.

**dino-run 상태**: **readonly** — 손 안 댐 (F10 함정 차단). m1-m4 그대로, m5 미진행.

---

## Files to Know (다음 세션 권장 정독)

| 파일 | 왜 중요한가 |
|---|---|
| `_workspace/v0.3-skeleton-audit.md` | **v0.3의 *왜*. 7-axis audit, 18 defects 분류.** |
| `_workspace/v0.3-backlog.md` | Wave A-E plan + 결정 사항 + 비목표 |
| `_workspace/v0.4-backlog-candidates.md` | dogfood 1차 findings — v0.4 후보 (자동 채택 안 함) |
| `CHANGELOG.md` v0.3.0 섹션 | Wave별 변경 + migration notes |
| `_workspace/structure.md` | **모든 file kind의 ground truth (v0.3에서 drift 해소)** |
| `skills/gmk-dev-complete/SKILL.md` | 프로젝트 endpoint SKILL 본문 — read-only 검사 6개 |
| `CONCEPT.md` §1.3 endpoint | "끝점" 정의와 `/gmk-dev-complete` 연결 |

---

## Resume Instructions (다음 세션)

### Path A — v0.3 검증 (Wave A·B 실제 작동 확인)
1. `Read _workspace/v0.3-backlog.md` § 5 검증 체크리스트
2. 합성 fixture로 verify (실제 게임 dogfood 없이):
   - design-system 호출 시 systems-designer 라우팅 제안이 본문에 출력되는지
   - validate FAIL 시 playtest-analyst 라우팅 제안 출력되는지
   - 모든 milestone shipped 상태 simulated → `/gmk-dev-complete` DEV_COMPLETE 출력되는지
3. (선택) Plugin reinstall로 `gmk-dev-complete` 자동완성 확인

### Path B — v0.4 backlog 정리
1. `Read _workspace/v0.4-backlog-candidates.md` (dogfood findings)
2. v0.3 작업 후 *어떤 finding이 자동 해결됐는지* 다시 검토 — 일부는 wiring이 완성된 결과 자연 해결
3. 남은 finding을 v0.4 Wave 분해

### Path C — 새 dogfood (조심해서)
v0.3 작동 확인용으로 *작은* 새 게임 한 evening. dino-run은 readonly. F10/W17 함정 ("이 게임 통과시키려 플러그인 고침") 가드 유지.

### Path D — 다른 작업
TaskForge Pro / ZooMerge / 다른 프로젝트로 이동.

**현재 시점 권고**: **Path A** (합성 fixture로 v0.3 wiring 검증). 그 다음 Path B. Path C는 v0.4 작업 시작할 때.

---

## Setup Required

v0.2와 동일:
- Node + npm + Playwright (이미 설치됨)
- gamemaker-kit plugin reinstall 권장 (v0.3.0 새 SKILL `gmk-dev-complete` 자동완성)

**선택**:
- Godot CLI (gmk-port 실험 시)
- gitleaks (gmk-merge-gate)
- ComfyUI on :8000 (gmk-art-gen)

**환경 변수**: 없음.

---

## Warnings

### W1-W18 — 이전 세션들에서 누적
이전 HANDOFF.md 참조. 전부 유효.

### W19 — 이번 세션 신규

**v0.3는 dogfood 없이 머지됐음 — 실 게임 회귀 검증이 부재.**

audit-driven으로 작업했고 합성 fixture 검증만 함 (v0.3 backlog § 5). 만약 실 게임에서 새 wiring이 unexpected behavior 보이면, 그건 *audit이 놓친 영역*. Path A (검증) 수행하고, 새 finding 나오면 즉시 v0.4 backlog에 추가.

### W20 — 이번 세션 신규

**`gmk-dev-complete`는 read-only지만 `--accept-warnings` flag는 *세션-로컬*이지 milestones.json에 안 박힘.**

DEV_COMPLETE 도달 후 매번 같은 warnings 재출력. 사용자가 한 번 acknowledge 한 것이 *persisted*되길 원하면 v0.4 후보 (warnings_acknowledged_at 같은 필드를 milestones.json에 추가). 지금은 의도된 비-persist.

### W21 — 이번 세션 신규 (F13/F14의 명시화)

**v0.3 backlog는 *audit*에서 도출됐지 dogfood에서 도출되지 않음.** 다음 backlog 결정 시 같은 가드 유지. dogfood findings는 *evidence 후보 1개*이지 backlog의 전부가 아님 — `feedback_dogfood_not_backlog` 류 메모리 룰로 보존 검토.

### W22 — 이번 세션 신규 (F15의 명시화)

**HANDOFF.md는 working tree에서 외부 도구에 의해 reverted될 수 있음.** Wave 후 항상 `git status -- HANDOFF.md` 확인 + 필요 시 `git checkout HANDOFF.md`로 복구 후 새 내용 Write.

---

## Task List 상태 (이번 세션 종료 시점)

이번 세션 완료:
- #1-7: HANDOFF / audit 자료 정독 + 기존 plan 폐기
- #8-17: 7-axis audit 7개 차원 점검 + v0.3-skeleton-audit.md / v0.3-backlog.md 작성 + 결정 5개
- #18: dogfood-findings → v0.4-backlog-candidates 이름 변경
- #19-25: Wave A (agent wiring 7 SKILLs) + 검증 + 커밋
- #26: Wave B (gmk-dev-complete SKILL + endpoint wiring) + 커밋
- #27: Wave C (structure.md drift + CONCEPT endpoint sync) + 커밋
- #28: Wave D (call-graph reinforcement) + 커밋
- #29: Wave E (CHANGELOG + version bump + 이 HANDOFF) — **진행 중 (이 커밋이 끝)**

다음 세션:
- Path A (v0.3 검증) — TaskList 새로 생성
- 또는 Path B (v0.4 backlog 정리)
- 또는 Path C (작은 새 dogfood)
- 또는 Path D (다른 프로젝트)

---

*마지막 커밋: Wave E (이 커밋이 origin 동기화 시점)*
