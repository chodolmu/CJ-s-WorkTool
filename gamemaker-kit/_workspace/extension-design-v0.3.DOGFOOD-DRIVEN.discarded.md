# gamemaker-kit 확장 설계 v0.3 (v0.2 → v0.3)

**기준일**: 2026-05-14
**입력**: `_workspace/dogfood-findings-v0.2.md` (11 finding, dino-run 1차 dogfood 산출)
**출발점**: v0.2.0 — ~28 skills + 4 domain agents, marketplace 등록 완료
**도착점**: v0.3.0 — finding 11개 해결 + 검증축 정확성 강화. **스킬 수 늘림 없음.**

---

## 0. v0.3의 한 문장 약속

> "**v0.2가 만든 것은 그대로 둔다. v0.2가 *잘못 잰 것*과 *막은 것*만 고친다.**"

- v0.3 = 정확성·인체공학 패치. v0.2의 4축·끝점·범위 모두 유지.
- 신규 스킬 추가 0개. **기존 스킬의 step 강화 + schema 추가 필드 + flag 도입**으로 모두 해결.
- 신규 agent 0개.
- dino-run 통과시키는 것 = 비목표 (F10/W17 — 함정).

---

## 1. v0.2 → v0.3 변경 동기 (dogfood 요약)

dino-run dogfood 1차에서 11개 finding이 잡힘. 분포:

- **Critical 3** — 검증축 verdict가 *거짓*이거나 작업이 *막힘*. v0.3 차단 (이게 안 풀리면 v0.2는 production-broken).
- **Major 4** — 사용자 시간 낭비 / 마찰. verdict는 안 오염되지만 SKILL 흐름이 강제로 끌고 감.
- **Minor 4** — 영향 낮은 정정 / quality-of-life.

**가장 큰 통찰**: v0.2는 *직군 축*과 *통합 축*은 *작성*했지만, **검증 축의 정확성을 검증 못 한 채 출시**됐음. dogfood가 잡은 11개 finding 중 **5개가 검증축(C1, C2, C3, M4, M5)**, 3개가 메소드론·기획축(M6, M7, N11), 3개가 UX/QA(N8, N9, N10). 가장 약한 곳이 가장 자주 호출되는 곳이었음.

**v0.3 = "검증축 정확성을 v0.2 직군축 수준으로 끌어올림"** + 부수 정리.

---

## 2. 우선 변경 원칙 (Anti-F10 / W17 가드)

dogfood findings 적용 시 반드시 지킬 원칙 — 이걸 어기면 v0.3 자체가 dino-run 통과시키는 도구로 변질됨:

### P1. **finding은 일반화로만 쓴다**
각 finding은 dino-run 한 케이스에서 발견됐지만, *v0.3 변경이 dino-run을 PASS시키는 것*을 목표로 하면 안 됨. 변경 후 dino-run을 retest해서 PASS가 나오면 그건 *부산물*이고, FAIL이 그대로면 그건 *현실*임. dino-run을 통과시키려 변경 범위를 늘리지 않는다.

### P2. **dino-run evidence는 readonly**
`C:\GameMaking\dino-run\` 의 milestones.json / pillars.json / prototypes/ / .gamemaker-kit/validations/ 전부 v0.3 작업 중 **편집 금지**. evidence는 변경 후에 v0.3의 새 메커니즘이 *같은 입력에 어떻게 다르게 답하는지* 보는 용도. 입력 자체를 v0.3 통과되게 다듬으면 anti-finding이 됨.

### P3. **검증 메커니즘 변경이 wave A에 몰린다**
verdict 정확성은 검증 메커니즘에 직접 손대지 않으면 못 고침. C1·C2·C3는 v0.3 wave A에 묶이고 같이 머지된다. 일부만 출시하면 검증축이 모자이크가 됨.

### P4. **새 스킬 추가는 finding 정당화로 안 됨**
finding 11개 중 어느 것도 "새 스킬이 필요하다"라는 결론이 아님 — 전부 기존 스킬의 step 변경, schema 필드 추가, flag 도입으로 끝남. v0.3에서 새 스킬 추가는 *별도 v0.4 backlog로 분리*. v0.3 scope creep 금지.

### P5. **dogfood 2차는 v0.3 wave A·B 머지 후**
dogfood 2차 (integration·agents 절반 커버)는 v0.3 wave A·B가 머지된 *후에* 시작. 더 빨리 시작하면 같은 finding을 또 발견할 뿐 (검증축 미수정 상태에서는 mechanic-authoring half에서도 같은 함정 재발).

---

## 3. Wave 분해 — 11 findings × 3 waves

각 wave는 단일 commit · 단일 origin push.

### Wave A — 검증축 정확성 (Critical 3 + N9)

| Finding | 변경 위치 | 변경 종류 |
|---|---|---|
| C1 | `gmk-prototype` Step 3 / `gmk-validate` Step 4 / milestones.json schema | 메커니즘 변경 |
| C2 | `gmk-validate` runner determinism check / `_bot_hook_lib.js` | 메커니즘 변경 |
| C3 | `gmk-self-test` preconditions / `gmk-validate` `--skip` flag | flag 추가 |
| N9 | `gmk-validate` runner output write step | 1-line defensive fix |

**머지 단위 이유**: C1·C2·C3은 *서로 같은 흐름 (validate→self-test)을 지나가는* finding. 일부만 머지하면 검증축이 부분-잘못-부분-맞음 상태로 모자이크됨. N9는 단순 fix지만 같은 파일(runner) 손대니 같이 묶음.

**완료 신호**: 새 메커니즘 (Random baseline ratio, determinism projection, --skip flag, mkdir recursive) 모두 SKILL.md에 명시 + `gmk-prototype-rules` 룰북에 결정론 contract 명시. dino-run retest는 *하지 않음* (P2). 대신 *합성 fixture*로 v0.3 메커니즘의 정확성 검증.

### Wave B — SKILL 흐름 인체공학 (Major 4)

| Finding | 변경 위치 | 변경 종류 |
|---|---|---|
| M4 | `gmk-validate` Step 1 default | default 변경 (200 → 50) + CI-width 사전 표시 |
| M5 | `gmk-prototype` Step 3 hypothesis writing | 체크리스트 추가 + `_bot_tautology_risk` 태그 |
| M6 | `gmk-roadmap` Step 0/1 | project_type prompt + clone-recommend 분기 |
| M7 | `gmk-init` Step 3 anti-examples | step을 *deferred*로 분리, 또는 minimal-commit 모드 |

**머지 단위 이유**: 전부 *SKILL 흐름이 사용자를 강제로 끌고 가는* 류 — 한꺼번에 풀면 사용자가 v0.3 release note에서 "SKILL들이 덜 잡아끌게 됐다" 한 묶음으로 인식. 분리하면 어색한 transition (M4만 fix 된 v0.3.x → M6 fix 된 v0.3.y).

**완료 신호**: 각 SKILL.md의 변경된 step을 *자체 인용 가능*하게 — "왜 v0.3에서 이 step이 바뀌었는가"를 SKILL.md 본문이 짧게 1줄 설명. (마이그레이션 안내, 사용자 학습 비용 줄임.)

### Wave C — Minor + dogfood 2차 통합 finding (N8, N10, N11 + 새 발견)

| Finding | 변경 위치 | 변경 종류 |
|---|---|---|
| N8 | `gmk-prototype` "Next" block + `gmk-self-test` `--quick` flag | flag 추가 |
| N10 | `gmk-roadmap` Step 2 / "Notes for the model" | 작성 강화 (enforcement는 아님) |
| N11 | `gmk-roadmap` Step 3 post-check | warning emit 추가 |

**+ dogfood 2차 발견 통합**: wave A·B 머지 *후* dogfood 2차 실행 → 거기서 잡힌 새 finding을 wave C에 흡수. wave C 머지 시점이 dogfood 2차 종료 시점과 같음.

**완료 신호**: wave C 머지 + CHANGELOG에 dogfood 2차 evidence 링크.

---

## 4. Schema 변경 (v0.2 → v0.3, backward-compat)

v0.3는 milestones.json 스키마에 다음을 **추가**한다. 기존 필드 제거 / 의미 변경 없음 (v0.2 milestones.json은 그대로 읽힘).

### 4.1 `hypothesis.measured_by[].` 신규 필드 (C1)

```typescript
{
  metric: '...',
  kind: 'bot' | 'self-test',
  target: { op, value },
  confidence: number,
  sample_size: number,

  // ★ v0.3 신규 — C1 해결
  _target_authored_against?: 'bot' | 'human' | 'unspecified',
  //   bot      : target은 봇 능력 기준 (e.g. ratio-over-random)
  //   human    : target은 디자인 의도 기준 (사람 플레이 예상치)
  //   unspecified : v0.2 기록 (마이그레이션 시 기본값)
  // gmk-validate가 verdict 출력 시 단위/맥락을 이 값에 맞춰 표시.

  _target_basis?:
    | { kind: 'absolute' }
    | { kind: 'ratio_over_random_baseline', multiplier: number }
    | { kind: 'ratio_over_previous_milestone', milestone_id: string, multiplier: number },
  // bot-row가 ratio 기반이면 gmk-validate가 baseline을 *측정* 후 ratio 계산.

  _bot_tautology_risk?: 'yes' | 'no' | 'maybe',  // M5 해결
}
```

마이그레이션: v0.2 milestones.json의 `measured_by[]`는 위 신규 필드 모두 미설정. `gmk-validate`는 미설정 시 `unspecified`로 취급하고 *verdict는 그대로 출력하되 warning 표시*: *"이 row는 v0.2 작성 — target 기준이 명시 안 됨"*. 사용자가 v0.3 재실행 시 prompt로 채울 기회.

### 4.2 `hypothesis.metrics.random_baseline` (C1)

```typescript
hypothesis: {
  if, then,
  measured_by: [...],
  trials: [...],

  // ★ v0.3 신규
  random_baseline?: {
    measured_at: string,
    runs: number,
    metrics: { [metric_name]: { p50, p90, mean, std } }
  }
}
```

`gmk-validate`가 persona-mix 직전에 Random 페르소나 단독 20판 실행 → 위 블록에 저장 → bot-row 중 `_target_basis.kind === 'ratio_over_random_baseline'`인 것은 이 baseline에 multiplier 곱해 절대 target으로 변환 후 평가.

### 4.3 `validation.skipped` 공식화 (C3)

```typescript
validation?: {
  ran_at: string,
  ...,

  // ★ v0.3 공식화 (v0.2에선 임시 수기 입력)
  skipped?: {
    skipped_at: string,
    reason: string,           // 필수, 비어있으면 거부
    skipped_by: 'user' | 'gmk-validate-skip-flag',
  }
}
```

`gmk-validate <m> --skip --reason "..."`이 위 블록을 작성. `gmk-self-test` precondition은 `validation` 존재 OR `validation.skipped` 존재 둘 다 satisfy로 인정.

### 4.4 `pillars.json` 신규 필드 (M6)

```typescript
{
  project_name, engine, created_at, pillars: [...], supported_genres_check: {...},

  // ★ v0.3 신규
  project_type?: 'original' | 'clone' | 'tutorial' | 'other',
  //  - original : 원본 디자인, mechanic 미검증 (v0.2 기본값)
  //  - clone    : 기지 게임 클론, mechanic 사전 검증됨
  //  - tutorial : 학습 목적
  // gmk-roadmap이 decomposition 추천 강도를 이 값에 맞춰 변경.
}
```

마이그레이션: v0.2 pillars.json은 미설정 → `original`로 간주. 사용자가 next-time-gmk-roadmap 호출 시 prompt.

---

## 5. SKILL.md 변경 매트릭스

| SKILL | 변경 | finding | wave |
|---|---|---|---|
| `gmk-init` | Step 3 anti-examples → deferred 또는 minimal-commit + pillars.json `project_type` prompt 추가 | M7, M6 (project_type) | B |
| `gmk-roadmap` | Step 0 project_type 분기, Step 2 batching anti-pattern 명시, Step 3 linear-chain warning | M6, N10, N11 | B/C |
| `gmk-prototype` | Step 3 `_target_authored_against` / `_target_basis` / `_bot_tautology_risk` prompt, "Next" block intuition-check pause | C1, M5, N8 | A/B |
| `gmk-prototype-rules` | §3 결정론 contract — `summary()` 중 deterministic projection (`{score, custom}`) 명시 | C2 | A |
| `gmk-validate` | Step 1 default 50 + CI-width 표시, Step 0 determinism check 수정, Step 1.5 Random baseline 20판 측정 단계 추가, Step 4 ratio-target 평가 로직, Step 6 mkdir recursive, `--skip --reason` flag 추가 | C1, C2, M4, N9, C3 | A/B |
| `gmk-self-test` | precondition: `validation` 존재 OR `validation.skipped` 존재로 완화, `--quick "<verdict>"` flag | C3, N8 | A/C |
| `_bot_hook_lib.js` | `summary()` 주석에 deterministic vs observational 필드 분리 명시 (or split into `state()`+`metadata()`, v0.2 callers 호환) | C2 | A |

**비변경 SKILL** (12+): `gmk-brainstorm`, `gmk-status`, `gmk-loop`, `gmk-task-split`, `gmk-shape-advisor`, `gmk-portability-check`, `gmk-mechanic-merge`, `gmk-kill-milestone`, `gmk-mock-inject`, `gmk-design-system`, `gmk-content-plan`, `gmk-refactor-check`, `gmk-art-spec`, `gmk-art-gen`, `gmk-sound-plan`, `gmk-ux-flow`, `gmk-narrative`, `gmk-save-migrate`, `gmk-regression`, `gmk-platform-check`, `gmk-merge-gate`, `gmk-port`. dogfood가 안 건드린 영역.

→ **dogfood 2차의 책무**: 이 비변경 SKILL 중 *integration·agents 절반* (`gmk-port`, `gmk-merge-gate`, `gmk-regression`, 4 agents)을 실제 호출하면서 새 finding 생성. wave C 시점에 통합.

---

## 6. Backward-compat 약속

| 사용자 자산 | v0.3 호환 |
|---|---|
| v0.2 milestones.json | 그대로 읽힘. 신규 필드 미설정 → `unspecified` 취급 + warning |
| v0.2 pillars.json | 그대로 읽힘. `project_type` 미설정 → `original` 취급 + 다음 gmk-roadmap 호출 시 prompt |
| v0.2 `_bot_hook_lib.js` | `summary()` 인터페이스 유지. 새 split API (`state()`+`metadata()`)는 옵션 |
| v0.2 validate 결과 (`.gamemaker-kit/validations/<m>/`) | 그대로 사용. v0.3 새 random_baseline 블록은 다음 validate 호출 시 생성 |
| v0.2 self-test 결과 | 그대로 사용 |
| v0.1 → v0.2 migrations | v0.2 CHANGELOG의 migration notes 그대로 |

**Breaking 없음**. v0.2.X 사용자는 SKILL.md만 업데이트하면 새 기능 사용 가능, 기존 워크플로 계속 작동.

---

## 7. 비목표 (v0.3에서 *하지 않는 것*)

P4 가드 기준으로 명시적 분리:

| 항목 | 이유 | 어디로 |
|---|---|---|
| 새 SKILL 추가 | finding 11개가 모두 기존 SKILL 변경으로 풀림 | v0.4 |
| 새 agent 추가 | dogfood가 agents 미호출 — agent 부족이 아니라 호출 부재가 finding | dogfood 2차 후 v0.4 |
| `gmk-port` Stage 5/6 강화 | dogfood가 미실행 — 데이터 없는 변경은 합리화 | dogfood 2차 후 v0.4 |
| 4축 모델 재구성 | dogfood는 4축 모델 자체에는 finding 없음 | 영영 안 함 (v0.2 4축 stable) |
| `gmk-share` 부활 | 끝점 밖, v0.2에서 제거됨 | 영영 안 함 |
| 외부 사람 피드백 채널 | gmk 끝점 밖 | 영영 안 함 |
| 셰이더 visual diff validate | v0.2 CONCEPT.md §10 v0.3 항목 — 미루지 말지만 dogfood 미커버 | dogfood 2차에서 shader 게임 시도 후 결정 |
| dino-run을 PASS시키는 변경 | F10 함정 | 영영 안 함 |

---

## 8. 검증 체크리스트 (각 wave 머지 전)

### Wave A 머지 전
- [ ] `gmk-validate` 합성 fixture로 verdict 정확성 검증:
  - fixture-1: bot이 absolute target 못 닿지만 사람은 닿음 → v0.2는 FAIL, v0.3는 ratio-target이면 PASS, absolute target이면 FAIL + warning ("target was authored against bot capability — consider ratio")
  - fixture-2: 결정론 check이 wall-clock leak 없이 동일 seed 동일 verdict
  - fixture-3: `validation.skipped` 블록 있는 마일스톤에 `gmk-self-test` 호출 → 정상 진행
  - fixture-4: 출력 디렉토리 미존재 상태에서 `gmk-validate` 호출 → 성공 (mkdir recursive)
- [ ] `gmk-prototype-rules` §3 — deterministic projection 필드 목록 명시
- [ ] schema 마이그레이션 — v0.2 milestones.json 읽고 v0.3 새 필드 추가 시 기존 필드 무손실

### Wave B 머지 전
- [ ] `gmk-validate` 50판 default → CI-width "±0.11" 정도 표시 검증
- [ ] `gmk-prototype` Step 3 `_bot_tautology_risk: yes` 태그된 row가 validate verdict에 warning 출력
- [ ] `gmk-roadmap` project_type='clone' 입력 시 1-milestone 추천 출력 확인
- [ ] `gmk-init` Step 3 — anti-example deferred 모드에서 pillar 텍스트가 init 직후 그대로 유지

### Wave C 머지 전
- [ ] `gmk-self-test --quick "잘 되네"` → coded session note 작성, structured session 안 함
- [ ] `gmk-roadmap` linear chain 입력 시 warning 출력
- [ ] dogfood 2차 evidence — `_workspace/dogfood-findings-v0.3.md` 작성됨

### v0.3.0 릴리스 전
- [ ] CHANGELOG.md — v0.2 → v0.3 모든 변경 사항 + migration notes
- [ ] CONCEPT.md §10 — v0.3 항목 done 표시, v0.4 항목 갱신
- [ ] README.md — 변경 사항 (default runs, schema 필드) 반영
- [ ] plugin.json + marketplace.json — 둘 다 v0.3.0 (memory rule `feedback_version_bump`)
- [ ] dogfood 2차 결과 — coverage gap 일부 해소 (integration 또는 agents 한 절반)

---

## 9. 구현 순서 (Wave 단위)

### Wave A — 검증축 정확성 (Critical 3 + N9)
1. milestones.json schema 확장 (`_target_authored_against`, `_target_basis`, `_bot_tautology_risk`, `random_baseline`, `validation.skipped`)
2. `_bot_hook_lib.js` 주석/split (선택) — deterministic vs observational 분리
3. `gmk-prototype-rules` §3 — 결정론 contract 명시
4. `gmk-validate` runner — determinism projection, Random baseline pass, ratio-target eval, mkdir recursive, `--skip --reason` flag
5. `gmk-prototype` Step 3 — 신규 schema 필드 prompt
6. `gmk-self-test` precondition — `validation.skipped` 인정
7. 합성 fixture로 검증
8. git commit + origin push

### Wave B — SKILL 흐름 인체공학 (Major 4)
9. `gmk-validate` Step 1 default 50 + CI-width display
10. `gmk-prototype` Step 3 bot-tautology 체크리스트
11. `gmk-roadmap` project_type 분기 + clone-recommend
12. `gmk-init` Step 3 anti-example deferred
13. 합성 fixture로 검증
14. git commit + origin push

### Wave C — Minor + dogfood 2차 (3 + 새 finding)
15. dogfood 2차 실행 — integration / agents 절반 타겟 (게임은 새 작은 게임 또는 dino-run 사본 — F10 가드 하에 어느 쪽이든)
16. dogfood 2차 finding → `_workspace/dogfood-findings-v0.3.md`
17. `gmk-prototype` "Next" block intuition-check
18. `gmk-self-test --quick` flag
19. `gmk-roadmap` linear-chain warning + batching anti-pattern 명시
20. dogfood 2차 신규 finding 흡수
21. CHANGELOG + CONCEPT §10 + README 갱신
22. plugin.json + marketplace.json v0.3.0
23. git commit + origin push

각 wave 후 사용자 검토 + plugin reinstall로 자동완성 확인.

---

## 10. 결정 사항 (이 문서 자체에서 확정)

| 결정 | 이유 |
|---|---|
| v0.3에서 새 SKILL 추가 안 함 | finding 11개가 모두 기존 SKILL 변경으로 풀림 (P4) |
| v0.3에서 새 agent 추가 안 함 | dogfood에서 agent 미호출, 부족 evidence 없음 |
| 4축 모델 / 끝점 / 범위 유지 | dogfood가 거기엔 finding 없음 |
| Wave A·B·C 순서 고정 | C1·C2·C3 모자이크 머지 방지 (P3) |
| dogfood 2차 = wave C 일부 | finding 통합 흡수, 별도 release 만들지 않음 |
| dino-run readonly | F10/W17 함정 차단 (P2) |
| Backward-compat 약속 | v0.2 자산 무손실 — sliver upgrade |
| 11 findings → 3 waves 매핑 고정 | 변경 시 scope creep 위험 — 추가 finding은 v0.4 |

---

## 11. 열린 결정 (사용자 검토 필요)

| 결정 필요 | 옵션 |
|---|---|
| **`_bot_hook_lib.js` `summary()` split** | (a) 주석만 추가, v0.2 호환 유지 / (b) `state()`+`metadata()`로 분리, `summary()`는 두 결과 merge 반환하는 wrapper로 남김 |
| **`gmk-init` Step 3 deferred 방식** | (a) 완전히 deferred (init 시 anti-example 없이 진행, 첫 milestone PASS 후 `/gmk-pillar-stress-test` 별도 호출) / (b) minimal-commit (init 시 pillar당 1개만 요구, 나중에 추가) |
| **dogfood 2차 게임 결정** | (a) 새 작은 게임 (mechanic 1-2개, 1 evening) / (b) dino-run을 *읽기 전용 evidence로 두고* 별 디렉토리에 새 사본 만들어 m4 통과 시도 — F10 다시 안 빠지면 ok |
| **`_target_authored_against: 'unspecified'`에 대한 verdict 정책** | (a) 그대로 출력 + warning (현재 plan) / (b) hard-FAIL — 미설정 row는 verdict 계산 자체 거부, 사용자가 채워야 진행 / (c) 한 번 묻고 진행 (interactive) |

---

*다음 단계: 이 문서 사용자 검토 → Wave A 구현 시작.*
