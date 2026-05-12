# Handoff: gamemaker-kit v0.2 — Wave B 완료, Wave C 대기

**Generated**: 2026-05-12 (23:00 KST)
**Branch**: main (origin 대비 16 commits ahead, 미푸시)
**Latest commit (about to be made)**: `feat(gamemaker-kit): v0.2 Wave B — 13 skills + bot hook v1 personas (B1-B6)`
**Status**: Wave B 13개 변경 (1 lib + 12 skills, 신규 11 + UPDATE 2 + RENAME 1) 완료, Wave C (2 스킬) 시작 직전

---

## Goal

게임 개발 자동화 Claude Code 플러그인 `gamemaker-kit`을 v0.1 (7스킬) → v0.2 (약 28스킬)로 확장.
4축 모델 (시간 / 직군 / 검증 / 통합) × 개발 완료 끝점. 외부 의존 0개.

사용자 핵심 약속: *"플러그인 안에서 게임 개발을 끝낸다"* — 출시·라이브옵스·외부 사람 피드백은 범위 밖.

---

## Completed

### 리서치 + 설계 + Wave A (이전 세션들)
- [x] 리서치 3 라운드 (13 서브에이전트 병렬) → `_research/extension-research.md`
- [x] 설계 v5 확정 → `_workspace/extension-design.md`
- [x] Wave A 12 스킬 + 데이터 자산 (`ad32e94`)

### Wave B — 직군(9 신규 + 1 UPDATE) + 검증축(4: 1 lib + 1 UPDATE + 1 RENAME + 2 신규) = 13 변경 ✅ 완료 (이번 세션)

**Step B1 — `_bot_hook_lib.js` 옵셔널 콜백 4개 추가**:
- [x] `stateSignature() → string|null`
- [x] `riskEstimate(action) → number 0..1|null`
- [x] `progressEstimate() → number 0..1|null`
- [x] `noveltyScore(action) → number 0..1|null`
- [x] `_gmkPersonaCapabilities` 인트로스펙션 객체 노출
- [x] `_gmkApiVersion: 1` 유지 (additive only)
- [x] 콜백 미존재 시 hook surface가 null 반환 + `_gmkPersonaCapabilities`로 detect 가능

**Step B2 — gmk-validate UPDATE** (전면 재작성):
- [x] Procedural Personas 4종 (Runner/Treasure/Survivor/Explorer)
- [x] `--policy persona-mix` 디폴트 (50 × 4 = 200)
- [x] state_coverage / action_entropy 메트릭 추가
- [x] suspicious-run 자동 추출 ~20판 → `validations/<m>/suspicious/{seed}.json`
- [x] Trial pruning (early_fail 30판 컷)
- [x] by_persona 필드 + `hypothesis.trials[]` 추적
- [x] CI-aware (binomial) hypothesis row 평가
- [x] 5-point smoke check 명시화 (gmk-prototype-rules §5 인용)
- [x] `shape: 'shader'` → INCONCLUSIVE + self-test 안내
- [x] gmk-self-test 참조로 변경 (gmk-feedback 제거)
- [x] persona fallback 처리 (callback 미존재 시 random)

**Step B3 — gmk-feedback → gmk-self-test RENAME + 재작성** (breaking change):
- [x] `skills/gmk-feedback/` → `skills/gmk-self-test/` git mv
- [x] SKILL.md 전면 재작성: 외부 사람 채널 완전 제거
- [x] 본인 플레이 노트 + suspicious-run 우선순위 라우팅
- [x] `--record` 플래그로 세션 노트 입력 분리 (플레이 중 세션은 화면 차단 없이)
- [x] 본인-verdict vs coded-verdict 비대칭 룰: FAIL은 본인 우선, PASS는 coded 우선
- [x] v0.1 `human:` 행 → `self-test:` 마이그레이션 절차 명시
- [x] v0.1 `human_feedback` 블록 → `self_test_legacy` 보존 + 새 `self_test` 작성
- [x] `/gmk-feedback` 레거시 alias 처리 명시

**Step B4 — gmk-prototype UPDATE** (룰북 인용 + schema 강제):
- [x] gmk-prototype-rules 인용으로 룰 본문 중복 제거 (캡/hook/header/RNG/library)
- [x] Hypothesis schema 강제 가드: kind ∈ {bot, self-test}, target {op, value}, bot행 confidence + sample_size 필수
- [x] freeform target ("> 4min") → 구조화 target ({op: '>', value: 240000}) 마이그레이션 안내
- [x] `--type=shader` 분기 stub (Wave D 템플릿 도착 전까지 minimal scaffold)
- [x] `human:` header 마이그레이션 (한 번 warn + bulk 변환)
- [x] `--bot-only` 플래그 (self-test 행 생략 — exit-velocity only)
- [x] v0.2 milestones.json 스키마 (tasks[], hypothesis.trials[], self_test, merge_gate, ported_to) 채택
- [x] gmk-share 제거 (Next 권고에서 제외)

**Step B5 — 직군별 9 스킬 신규**:
- [x] `skills/gmk-design-system/SKILL.md` (기획) — 시스템·상태머신·coupling·invariants spec
- [x] `skills/gmk-content-plan/SKILL.md` (기획) — 5가지 curve shape, cliff 명시, 강도 bumps
- [x] `skills/gmk-refactor-check/SKILL.md` (구현) — LOC/branches/depth/calls-out 임계, dead code, comment drift, 포팅 risk verdict (CLEAN/WARN/HIGH RISK)
- [x] `skills/gmk-art-spec/SKILL.md` (아트) — 자산 명세 + 팔레트 잠금 + 스타일 anchors + 일관성 risk
- [x] `skills/gmk-art-gen/SKILL.md` (아트) — `/art` (ComfyUI) wrapper, 팔레트+anchor 프롬프트 주입, task[] 갱신
- [x] `skills/gmk-sound-plan/SKILL.md` (사운드) — SFX 테이블 + BGM (none/single/adaptive) + 믹스 우선순위
- [x] `skills/gmk-ux-flow/SKILL.md` (UX) — 플로우 + FTUE 타임라인 + 입력맵 + 5 접근성 + 실패 모드
- [x] `skills/gmk-narrative/SKILL.md` (내러티브, 선택) — 브랜치 트리 + 분량 + 가시 분기점 + 톤 anchors
- [x] `skills/gmk-save-migrate/SKILL.md` (데이터) — 스키마 델타 + 마이그레이션 의사코드 + 롤백 + 테스트 케이스

**Step B6 — 검증축 2 스킬 신규**:
- [x] `skills/gmk-regression/SKILL.md` — PASS 마일스톤 일괄 재실행, 메트릭 drift 감지, "capture-but-don't-apply" 패턴 (auto-downgrade 안 함)
- [x] `skills/gmk-platform-check/SKILL.md` (haiku) — 6 카테고리 패턴-매칭 (브라우저 API / 뷰포트 / 터치+마우스 / 키보드 / 오디오 자동재생 / 스토리지 §6 위반)

---

## Not Yet Done

### Wave C — 통합 게이트 + 포팅 = 2 스킬 ← **다음 시작점**
- [ ] `skills/gmk-merge-gate/SKILL.md` NEW — 회귀(gmk-regression 산출 읽기) + 자산 충돌 + gitleaks secret 스캔
- [ ] `skills/gmk-port/SKILL.md` UPDATE — 5단계 재검증 (Generate/Compile/Smoke/Metric diff/사람 RE-PASS)

### Wave D — 정리·에이전트·메타
- [ ] `skills/gmk-share/` 디렉토리 통째로 제거 + CHANGELOG 명시
- [ ] `agents/systems-designer.md` / `feel-engineer.md` / `economy-balancer.md` / `playtest-analyst.md` NEW (Anthropic 4요소 + MAST 대응)
- [ ] `templates/prototype-shader.html` NEW (vanilla WebGL2)
- [ ] `.claude-plugin/plugin.json` v0.1.0 → v0.2.0 **AND** `.claude-plugin/marketplace.json` v0.1.0 → v0.2.0 (메모리 룰: 두 파일 동시 올림)
- [ ] `README.md` NEW — 개발 완료 끝점 + 4축 + 경쟁구도(18.2k★ vs 28스킬) + 학계 정직성 + 지원 장르
- [ ] `CONCEPT.md` 재작성 — "재미 검증" → "재미 falsification", §13 4축, §14 경쟁구도, §15 학계 한계

---

## Failed Approaches (Don't Repeat These)

이전 세션의 7개 + 이번 세션의 1개 신규.

### F1-F8 — 이전 세션 (전부 유효)
1. "작고 날카로움" 과보정 (v3→v4 폐기)
2. 외부 도구 5-10개 묶기 (v3 출시 인프라 폐기)
3. 출시·라이브옵스 자동화 (v3 출시 트랙 폐기)
4. 외부 사람 피드백 채널 (v3 자동 수집 폐기)
5. zoodev-loop 통합 (v1 폐기)
6. HTML 프로토타이핑을 직군 스킬 안에 묻기 (v4→v5)
7. AskUserQuestion 옵션 5개+ (한 번 실패)
8. 부모 저장소에서 `git commit` 시 부수 staged 변경 동반 (Wave A 세션 신규)

### F9 — 이번 세션 신규
**Write 도구는 디렉토리 이동(`git mv`) 후 새 파일에도 Read 선행 필요**
gmk-feedback → gmk-self-test 리네임 시 디렉토리 이동만으로는 충분치 않고, 새 경로 `skills/gmk-self-test/SKILL.md`에 한 번 Read한 뒤 Write가 가능했다. Read 없는 Write는 거부됨. 워크플로우 가이드: rename + content rewrite은 (1) `git mv`, (2) 1-line Read, (3) 전체 Write 순서.

---

## Key Decisions (이번 세션에서 추가)

| 결정 | 어디에 명시했나 |
|---|---|
| **옵셔널 콜백 4개**: `stateSignature`/`riskEstimate`/`progressEstimate`/`noveltyScore`, 각각 null 반환 가능, `_gmkPersonaCapabilities`로 detect | _bot_hook_lib.js + gmk-prototype-rules §4 |
| **Procedural Personas 4종**: hand-tuned 스코어링, 50판 × 4 = 200판 디폴트, 진화 학습 없음 | gmk-validate Step 3 |
| **Trial pruning at 30 runs**: persona-mix 디폴트 ON, single-persona OFF | gmk-validate Step 3 |
| **Suspicious-run cap ~20**: entropy 양끝 + duration 양끝 + crashed | gmk-validate Step 5 |
| **CI-aware bot row evaluation**: confidence 0.80/0.90/0.95 + sample_size → binomial CI | gmk-validate Step 4 |
| **persona fallback**: callback 미존재 시 그 persona는 random + `fallback_used: [...]` 플래그 | gmk-validate Step 3 |
| **본인-verdict vs coded-verdict 비대칭**: FAIL은 본인 우선, PASS는 coded 우선 | gmk-self-test Step 6 |
| **gmk-feedback → gmk-self-test 리네임은 breaking change** + legacy alias 1회 warn | gmk-self-test edge cases |
| **`/gmk-feedback` invocation**: 레거시 alias, 1회 warn, 동일 flow 실행 | gmk-self-test edge cases |
| **Hypothesis target 구조화** `{op, value}`, freeform 마이그레이션 안내 | gmk-prototype Step 3 |
| **bot row 필수 필드**: `confidence`, `sample_size`; self-test row는 optional | gmk-prototype Step 3 |
| **`--bot-only` 플래그**: self-test 행 생략, 사용자 acknowledge 필요 | gmk-prototype |
| **shape='shader' 분기 v0.2 stub**: minimal scaffold + bot INCONCLUSIVE, 풀 템플릿 Wave D | gmk-prototype Step 4, gmk-validate edge cases |
| **6 prototype-platform-check 카테고리 closed set**: browser API / viewport / touch+mouse / keyboard / audio autoplay / storage(§6 위반) | gmk-platform-check Step 2 |
| **Regression: capture-but-don't-apply**: regression trial 저장은 하되 milestones.json verdict는 사용자가 `--accept-regression` 호출 시에만 downgrade | gmk-regression Step 7 |
| **Regression drift 임계**: ±10pp rates / ±25% durations | gmk-regression Step 4 |
| **6 prototype shape closed set 확장 확정**: `grid | continuous | dialogue | shader` | gmk-prototype + gmk-shape-advisor |
| **5 curve shape closed set**: flat / stairs / ramp / wave / bell | gmk-content-plan |
| **4 art-asset category closed set**: characters / tiles / effects / UI | gmk-art-spec |
| **3 BGM type closed set**: none / single-loop / two-layer adaptive | gmk-sound-plan |
| **5 accessibility floor closed set**: color-blind / tutorial skippable / input redundancy / pause anywhere / text size | gmk-ux-flow |
| **5 refactor-check threshold table**: LOC 25/50, Branches 5/10, Nesting 3/4-5, Calls-out 4/5-8 | gmk-refactor-check Step 2 |
| **Save schema version is integer counter (not semver)** | gmk-save-migrate Step 1 |
| **Default rollback for save migration**: backup-and-replace, 30-day retention | gmk-save-migrate Step 4 |

---

## Current State

**Working** (v0.1 + Wave A + Wave B 모두 동작):

v0.1 + Wave A 자산 그대로 + Wave B 변경 13건:
- _bot_hook_lib.js v1 (+ 옵셔널 콜백 4개)
- gmk-prototype UPDATE / gmk-validate UPDATE / gmk-feedback → gmk-self-test RENAME+rewrite
- 신규 11 스킬: gmk-design-system, gmk-content-plan, gmk-refactor-check, gmk-art-spec, gmk-art-gen, gmk-sound-plan, gmk-ux-flow, gmk-narrative, gmk-save-migrate, gmk-regression, gmk-platform-check

**Broken**: 없음.

**Uncommitted Changes** (gamemaker-kit 내부): 위 변경 전부.

**Pushed**: ❌ origin 푸시 안 됨 (origin/main 대비 16 commits ahead 예상).

---

## Files to Know (Wave C 시작 시 정독 권장)

| 파일 | 왜 중요한가 |
|---|---|
| `_workspace/extension-design.md` (§6 Wave C / §10 step 9-10) | merge-gate 3-check + port 5단계 재검증의 설계 근거 |
| `skills/gmk-port/SKILL.md` (현재 v0.1) | Wave C UPDATE — 5단계 재검증 (Generate/Compile/Smoke/Metric diff/사람 RE-PASS) |
| `skills/gmk-regression/SKILL.md` (이번 세션 신규) | merge-gate가 읽어야 함; capture-but-don't-apply 패턴 이해 필요 |
| `skills/gmk-portability-check/SKILL.md` (Wave A 신규) | merge-gate / port의 위험 카탈로그 참조 |
| `skills/gmk-validate/SKILL.md` (이번 세션 UPDATE) | port stage 4 (Metric diff)에서 HTML 200판 메트릭 baseline |
| `skills/gmk-save-migrate/SKILL.md` (이번 세션 신규) | port 시 save 스키마 변경 있으면 wire-in 필요 |
| `_workspace/examples/milestones-example.json` | merge_gate + ported_to.re_validation 필드 형태 |
| `_workspace/structure.md` (`.gamemaker-kit/merge-gates/`, `.gamemaker-kit/port-checklists/`) | 두 스킬의 출력 경로 규약 |

---

## Resume Instructions (Wave C 시작)

### 1. 설계 + Wave A/B 산출 재확인
```
Read C:\GameMaking\Tool\gamemaker-kit\_workspace\extension-design.md   (§6 Wave C / §10 step 9-10 / §11)
Read C:\GameMaking\Tool\gamemaker-kit\skills\gmk-port\SKILL.md         (현재 v0.1, UPDATE 대상)
Read C:\GameMaking\Tool\gamemaker-kit\skills\gmk-regression\SKILL.md   (Wave B 신규; merge-gate가 참조)
Read C:\GameMaking\Tool\gamemaker-kit\skills\gmk-portability-check\SKILL.md  (Wave A 신규; port와 연결)
```

### 2. Wave C Step C1 — `gmk-merge-gate` NEW
- 3-check: regression(이전 PASS 봇 재실행 — gmk-regression 산출 활용) + 자산 충돌(두 마일스톤이 같은 파일 경로 수정) + secret(gitleaks CLI)
- gitleaks 없으면 fallback 안내 (필수 아님, 선택)
- 출력: `.gamemaker-kit/merge-gates/<m>.md`
- verdict: PASS | FAIL
- regression check은 24h 이내 report 있으면 재사용, 없으면 직접 gmk-regression 호출

### 3. Wave C Step C2 — `gmk-port` UPDATE (5단계 재검증)
- Stage 1 Generate — systems-designer (Wave D)가 HTML → GDScript/C# 변환 (지금은 stub OK)
- Stage 2 Compile — `godot --headless --check-only` or `Unity -batchmode -quit`, 1회 retry
- Stage 3 Smoke — 엔진 측 5판 봇 실행, crash 시 1회 retry
- Stage 4 Metric diff — HTML 200판 vs Engine 200판, clear_rate/dominant_strategy/action_entropy 비교, 임계 초과 시 경고
- Stage 5 사람 RE-PASS — 사용자가 엔진에서 직접 플레이 후 verdict 입력 (RE_PASS/RE_FAIL/NEEDS_TUNING)
- 출력: `.gamemaker-kit/port-checklists/<m>.md`
- milestones.json `ported_to.re_validation` 필드 갱신

### 4. Wave C 검증 + commit
- 2 SKILL.md 정합성 확인
- 톤 8규칙 준수
- `git commit -- gamemaker-kit/` 명시 (F8 함정 회피)

### 5. 이후 — Wave D
설계 문서 §6 Wave D 그대로. 마지막에 plugin.json + marketplace.json 둘 다 v0.2.0.

---

## Setup Required

**필수**:
- Node + npm (Wave B에서 사용자가 이미 Playwright 설치 예상)
- 게임 엔진 (Wave C의 gmk-port 5단계 재검증 시점 → Godot CLI 또는 Unity batchmode)

**선택**:
- gitleaks CLI (Wave C의 gmk-merge-gate; 없으면 secret 검사 skip + 경고)

**환경 변수**: 없음.

---

## Warnings

### W1-W12 — 이전 세션 (전부 유효)
1. 기존 7스킬 backward compat — 신규 schema 필드 옵셔널 (Wave A milestones-example.json에 명시)
2. `_workspace/` 경로 정책 — 게임 폴더 안
3. zoodev-loop 안 건드림
4. ZooMerge dogfood 별도 디렉토리
5. plugin.json + marketplace.json 동시 v0.2.0
6. 에이전트 위치 = `<plugin>/agents/`
7. AskUserQuestion 옵션 최대 4개
8. 출시·라이브옵스 영역 유혹 차단
9. CC-Game-Studios 과보정 함정 (28스킬 규모 유지)
10. 학계 정직성 — "재미 falsification" (never "재미 검증")
11. 부모 저장소 커밋 시 pathspec `gamemaker-kit/` 명시
12. gmk-feedback → gmk-self-test breaking change (Wave A 시점 예고; 이번 세션 실행 완료)

### W13 — 이번 세션 신규
**Wave B에서 옵셔널 콜백을 추가했지만 v0.1 프로토타입 전부 호환 (`_gmkApiVersion: 1` 유지)**
- 새 콜백 4종은 spec에 없어도 hook이 작동함; `_gmkPersonaCapabilities`로 detect되고 persona가 random 폴백.
- 이는 의도된 설계 — 기존 v0.1 프로토타입을 다시 검증해도 `/gmk-validate`가 통과해야 한다.
- 만약 v0.1 프로토타입이 새 콜백 호출에서 에러가 난다면 hook lib의 try/catch가 잡아 null 반환 → 그래도 통과해야 함.
- 검증 방법: Wave C 이후 v0.1 프로토타입이 있는 프로젝트에서 dogfood 시 확인.

### W14 — 이번 세션 신규
**페르소나 캘리브레이션 변경 시 regression 재기준화 필요**
- 향후 Wave에서 페르소나 정의를 바꿀 일이 생기면 `gmk-regression`이 기존 baseline과 비교해 "regression" 신호를 잘못 낼 수 있음.
- 대처: gmk-regression은 baseline trial이 30일+ 오래되면 페르소나 변경 가능성 경고 추가됨.
- Wave C+에서 페르소나 손대지 말 것. 손댄다면 모든 baseline 재기준화 마이그레이션 절차 필요.

---

## Task List 상태 (Resume 시 TaskList 호출하면 확인 가능)

이번 세션:
- #1-7 [completed] Wave B B1-B7 전부 완료

다음 세션 (Wave C):
- [pending] Wave C Step C1: gmk-merge-gate NEW (regression + 자산 충돌 + gitleaks)
- [pending] Wave C Step C2: gmk-port UPDATE (5단계 재검증)
- [pending] Wave C 검증 + commit

이후 (Wave D):
- [pending] gmk-share 디렉토리 제거
- [pending] 4개 에이전트 (systems-designer / feel-engineer / economy-balancer / playtest-analyst)
- [pending] templates/prototype-shader.html
- [pending] plugin.json + marketplace.json v0.2.0
- [pending] README NEW
- [pending] CONCEPT.md 재작성

다음 세션 시작 시 TaskList는 새로 생성 (이번 세션의 #1-7 completed 상태는 보존되지 않음).
