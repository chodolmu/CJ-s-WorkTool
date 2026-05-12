# gamemaker-kit 확장 리서치 (2026-05-11) — 라운드 1+2+3 통합

라운드 3에서 외부 생태계 + 학계 컨센서스 + 경쟁구도까지 확장 검증.

---

## 🚨 가장 중요한 발견 (라운드 3)

### 1) 18.2k 별 경쟁자 존재
**Donchitos `Claude-Code-Game-Studios`** (2026-04 v1.0.0-beta) — 72 스킬 / 49 에이전트 / 7-phase 파이프라인. `/milestone-review`, `/playtest-report`, Godot/Unity/Unreal 포팅 에이전트 모두 있음. **gmk가 만들려는 거 대부분 이미 있음**.

차이점: HTML 프로토타입 ❌ · Playwright 봇 ❌ · Pillar+Hypothesis schema ❌.

→ **gmk의 살아남는 유일한 길**: 위 3가지를 *진짜 강제*. *참고용/조언/체크리스트*가 아니라 *통과/낙제 게이트*.

### 2) 학계 컨센서스: 봇은 fun을 못 잰다
- EA SEED (CoG 2021, arXiv 2103.13798): *"Measuring non-objective metrics such as fun and immersion is an open research question"*
- MS Research / Modl.ai + Riot: 봇 = 커버리지·발란스·human-like까지만
- → **CONCEPT.md 첫 문장 정직하게 수정 필요**: "재미 검증" → "재미 falsification" (안 재밌는 것 빠른 거르기, 재밌다는 영원히 사람 몫)

### 3) 인디 시간의 48%를 안 다룸
- 코딩 36% + 아트 16% = 52% (gmk 커버 영역)
- **미커버 48%**: 플레이테스트 운영(10%) / 마케팅(10%) / Steam 페이지·트레일러(8%) / 빌드·QA(6%) / 번역(4%) / 커뮤니티(4%) / 기타
- 가장 큰 ROI 공백: **출시 인프라 묶음** (Wishlist Data API + butler + steamcmd + Sentry)

### 4) 동형 문제 reinvent 5개
- 마일스톤 가설 = 통계 실험 → Optuna Study/Trial + W&B hypothesis 필드
- 마일스톤 ship = 프로덕션 배포 → Argo Rollouts canary + Error Budget
- 4 도메인 에이전트 = multi-AI code review → judge/severity/verification
- /gmk-feedback = qualitative research → quote→code→theme 3단
- /gmk-loop = orchestration → LangGraph checkpointer + explicit handoff

### 5) 자체 ground 누락
- 포팅 후 재검증 게이트 없음 (godogen 스크린샷 self-repair)
- 봇 다양성 강제 안 함 (단일 정책 = 검증 자체가 환각)
- 지원 장르 명시 안 함

---

## 트랙 1 — `/gmk-brainstorm` 스킬 패턴 (라운드 1+2)

### Superpowers `brainstorming/SKILL.md` 원문 (164줄, raw fetch)

frontmatter:
```yaml
---
name: brainstorming
description: "You MUST use this before any creative work..."
---
```

9단계 체크리스트 (line 23-31):
1. Explore project context
2. Offer visual companion (own message)
3. Ask clarifying questions — one at a time, multiple choice 선호
4. Propose 2-3 approaches with trade-offs
5. Present design — sections, approval after each
6. Write design doc → `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` + commit
7. Spec self-review
8. User reviews spec
9. Transition to implementation (writing-plans)

하드 게이트 (line 10-12):
```
<HARD-GATE>
Do NOT invoke any implementation skill... until you have presented a design
and the user has approved it.
</HARD-GATE>
```

톤: 명령형 + 단정적(`MUST`, `Do NOT`, `EVERY project`). 사용자 응답 템플릿을 글자 그대로 박아둠.

### Osmani `idea-refine` 3-phase

- Phase 1 Understand & Expand — "How might we…", 5-6 변형(Inversion/Simplification/Combination)
- Phase 2 Evaluate & Converge — 비교 매트릭스, opinionated pushback 강제
- Phase 3 Sharpen & Ship — 한 페이지 스펙 + Not Doing 리스트

### /gmk-brainstorm 권고 5단계 (옵트인)

| # | 단계 | 사용자 | 에이전트 |
|---|------|--------|----------|
| 1 | Frame | 마일스톤 목표 1줄 | pillars.json 읽기, "How might we…" 리프레이밍, 명확화 질문 1개 |
| 2 | Diverge | 답변 | 5-6 변형, MDA 라벨(Mechanic/Dynamic/Aesthetic/Inversion/Combination) |
| 3 | Stress-test | 2-3개 선택 | 비교 매트릭스 + opinionated pushback |
| 4 | Converge | 최종 1안 | 한 페이지 스펙 + Not Doing 리스트 |
| 5 | **Pillar Audit** | 통과/재검토 | Pillar 1:1 매핑(Reinforces/Neutral/Conflicts), Conflicts 있으면 Step 2-3 강제 리턴 |

산출: `.gamemaker-kit/brainstorms/M{n}-{slug}.md` + commit.

**옵트인 유지** — Superpowers의 "MUST before creative work" 워딩은 채택 안 함.

---

## 트랙 2 — 분야별 에이전트 + MAST + Anthropic (라운드 1+2)

### MAST 14모드 (arXiv 2503.13657 본문 확보)

FC1 시스템 설계 (41.77%): FM-1.1 task spec 위반 / **FM-1.2 역할 spec 위반** / FM-1.3 step repetition / FM-1.4 history loss / **FM-1.5 종료조건 미인지**

FC2 misalignment (36.94%): FM-2.1 reset / FM-2.2 clarification 안 함 / FM-2.3 derailment / **FM-2.4 정보 withholding** / **FM-2.5 input ignored** / FM-2.6 reasoning-action mismatch

FC3 검증/종료 (21.30%): FM-3.1 premature termination / **FM-3.2 verification 누락** / **FM-3.3 incorrect verification**

### Anthropic 멀티에이전트 가이드 원문 인용

- 에이전트 수: 단순 1, 직접 비교 **2-4**, 복잡 10+
- 4요소: **objective / output format / tools·sources / task boundaries**
- "spawning 50 subagents for simple queries" = 실패 사례

### 자율 게임 개발 실패 3 사례 (라운드 2)

A. **Godogen 4번 rewrite** — GDScript 환각, 컨텍스트 오버플로, 런타임 invisibility. 해결: "two separate Claude Code skills: orchestration / execution in isolated context: fork windows"

B. **$47K 무한 루프** — 11일간 두 에이전트 상호 검증. 단방향 verification + max-iteration cap 필수.

C. **17× 에러 증폭** — naive multi-agent aggregation. 에이전트 간 직접 통신 금지, supervisor 경유만.

### 게임 디자이너 직무 — Supercell JD 4축

(IGDA PDF fetch 실패, Supercell Senior Game Designer JD verbatim)
- 시스템 디자인 / 이코노미·메트릭 / 콘텐츠 반복 / 자율 LiveOps

→ gmk 4개 도메인 에이전트 근거: **systems-designer / feel-engineer / economy-balancer / playtest-analyst**

### Claude Code 플러그인 agents 표준

- 위치: `<plugin>/agents/` (NOT `.claude-plugin/` 안)
- frontmatter: name ★ / description ★ / tools / model / color
- plugin.json에 등록 불필요 — 디렉토리 컨벤션 자동 발견

### VoltAgent 실측 (4파일 fetch)

- 평균 286줄, 카탈로그형 명사구, JSON Communication Protocol 강제
- gmk는 JSON protocol 채택 안 함 — 과도, milestones.json + 평문 충분

### 안전 모델

- 단방향 verification (playtest-analyst만 검증, 사례 B 대응)
- 에이전트 간 직접 통신 금지 (사례 C 대응)
- max-iteration = 1
- 종료 조건 명시 (FM-1.5)

---

## 트랙 3 — 셰이더 프로토타입 (라운드 2 실측)

three.js/PixiJS/Babylon 실측:
- threshold 0.05-0.2, 허용 픽셀 0.1-3%
- three.js `deterministic-injection.js`: `_renderStarted/_renderFinished` 패턴 차용

prototype-shader.html 239줄 분배 (300줄 가드 안, 60줄 여유):
- shader 본문 80-120 / GL boilerplate 60 / hook 30 / 나머지 30+

`__gmk_botHook__` 셰이더 확장: ready, lastError, setSeed, setTime, setMouse, renderOnce, captureFrame, capturePixels, measureCentroid, setFragmentSource, currentMetrics, triggerEffect

게임 이펙트 메트릭 (Swink + Oreate AI 연구):
- 응답성 16-100ms tight
- hit-stop **50-100ms (3-5 프레임)**
- shake 진폭 4-32px, 지속 5-15 프레임

검증 도구: Playwright `toHaveScreenshot` + pixelmatch + SwiftShader 강제(`--use-angle=swiftshader`)

→ v0.2에서는 hook 노출까지만, visual diff validate는 v0.3.

---

## 트랙 4 — 기존 자산 통합 (라운드 2 내부 정독)

기존 7 스킬 모델·톤 매트릭스:
- gmk-init opus 대화형
- gmk-prototype sonnet 단정 지시
- gmk-validate sonnet 과학 중립
- gmk-share haiku 실무 간결
- gmk-feedback sonnet 정성 객관 (quote verbatim)
- gmk-port opus 보수 (API 환각 차단)
- gmk-status haiku 중립 데이터

milestones.json 전체 스키마 추출 (라운드 2 보고서 참조).

기존 톤 8규칙 + 표준 섹션 구조 → 신규 SKILL.md 강제 준수.

---

## 트랙 5 — 자동 플레이테스팅 학술 (라운드 3) ★ v0.2 핵심

### 현 봇 진단
random + MCTS depth-3 = 얕은 통계. **상태공간 1%도 안 봄** (Wuji 분석: random walker가 도달한 영역 평균 6%).

### Procedural Personas — Holmgård TCIAIG 2019

진화 학습 없이 hand-tuned utility 4종 prefab:
- **Runner** (속도 최우선): `0.8·progress + 0.2·score`
- **Treasure hunter** (점수 극대화): `0.1·progress + 0.9·score`
- **Survivor** (위험 회피): `0.5·progress + 0.5·(1/risk)`
- **Explorer** (novelty): `0.3·score + 0.7·novelty`

MiniDungeons에서 동일 레벨 clear_rate 23-71%로 분기 → 디자인 결함 위치 특정.

### 메트릭 카탈로그 (v0.2 채택 7개)

| 메트릭 | 정의 | 출처 | 도입 비용 |
|---|---|---|---|
| state_coverage | 도달 고유 추상상태 / 추정치 | EA SEED, TITAN | 중 |
| action_entropy | Shannon entropy of action 분포 | EA SEED CoG 2021 | 저 |
| novelty_score | KNN distance from existing trajectories | Lehman & Stanley | 중 |
| frustration_proxy | 같은 액션 3회 + 점수 변동 0 | Roohi CHI Play 2021 | 저 |
| dominant_strategy_per_persona | 페르소나별 dominant n-gram | Holmgård | 중 |
| suspicious_run_rate | outlier 자동 추출 | Riot+Modl | 저 |
| niche_coverage (MAP-Elites lite) | 2D behavior grid 채움률 | Mouret QD | 중 (옵션) |

### Suspicious-run 워크플로우 (active learning)

200판 중 outlier 20판만 사람한테:
- entropy 하위 10% (한 가지 행동만)
- entropy 상위 10% (너무 흩어짐)
- duration 양끝 5%
- crashed/stuck 전부

200판 → 사람 20판 = 부담 1/10.

→ **철학적 전환**: "봇이 가설을 검증" → **"봇이 사람의 주의를 라우팅"**

### GVGAI 호환 (선택)

forward model 콜백 옵션 추가하면 외부 GVGAI MCTS·deep RL 봇 그대로 사용 가능. v0.3 후보.

---

## 트랙 6 — Hypothesis Schema 강화 (라운드 3) ★ v0.2 핵심

### 동형 문제 자각

마일스톤 가설 = 통계 실험. 그런데 현재 schema에:
- 통과 기준 정량화 안 됨
- 신뢰도(confidence) 없음
- 사전 baseline 없음
- Trial 단위 추적 없음

### Optuna + W&B 패턴 차용

```typescript
hypothesis: {
  // 기존
  if: string,
  then: string,

  // ★ 신규
  measured_by: [{
    metric: string,                    // 'clear_rate' | 'state_coverage' | ...
    target: { op: '>', '<', '==', 'between', value: any },
    kind: 'bot' | 'human',
    confidence: 0.80 | 0.90 | 0.95,    // 통계적 신뢰 (기본 0.80)
    sample_size: number,                // 봇은 200, 사람은 5 등
    baseline?: { source: 'previous-milestone' | 'absolute', value: any }
  }],

  // Optuna Study/Trial
  trials: [{
    trial_id: string,
    started_at: string,
    config: { bot_policy, seed_range, ... },
    result: { metric_values, verdict },
    pruned?: boolean                    // fail-fast 신호 시 조기 컷
  }]
}
```

### Trial Pruning

빠른 1차 신호로 망한 시도 조기 컷:
- 처음 10판 모두 crash → 200판 안 돌리고 즉시 FAIL
- 처음 20판 clear_rate 0 → 즉시 FAIL (목표 0.5 이상이면)
- 처음 30판 dominant_strategy_ratio > 0.9 → 즉시 FAIL

비용 절약: 평균 200판 → 30판으로 단축 가능 (실패 마일스톤 한정).

---

## 트랙 7 — 포팅 후 재검증 게이트 (라운드 3) ★ v0.2 핵심

### 환각 최대 발생 지점

CONCEPT §7에서 "체크리스트 자동 생성"만 있고 *재검증 게이트 없음*. godogen의 4번 rewrite 사례 = 포팅에서 환각 최대 발생.

### godogen 스크린샷 self-repair 패턴

godogen 해결책 verbatim: *"two separate Claude Code skills: one for orchestration, another for execution in isolated context: fork windows"* + 시각 결함 검출.

### v0.2 포팅 재검증 워크플로우

```
/gmk-port <milestone> --to godot
  ↓
[Stage 1: Generate] systems-designer가 HTML→GDScript 변환
  ↓
[Stage 2: Compile-check] godot --headless --check-only
  → 컴파일 fail → systems-designer가 1회 retry, 그래도 fail → "수동 수정 필요"
  ↓
[Stage 3: Smoke-run] godot --headless 실행 + 표준 hook 호출 (포팅된 봇)
  → crash → 1회 retry, 그래도 → "수동 수정 필요"
  ↓
[Stage 4: ★ Visual diff] HTML 봇 200판 vs Godot 봇 200판 — 핵심 메트릭 비교
  → clear_rate 차이 > 20% → "게임필이 안 옮겨졌음" 경고
  → dominant_strategy 변경 → "메커닉 환각 의심" 경고
  → 사람에게 최종 RE-PASS 판정 요청
  ↓
[Stage 5: Screenshot diff (옵션)] HTML 스크린샷 vs Godot 스크린샷 ROI 비교
  → 색감·이펙트 일치도 메트릭
```

### milestones.json 확장

```typescript
ported_to: {
  // 기존
  ported_at, engine, files_created, files_modified, checklist,

  // ★ 신규 — 재검증
  re_validation: {
    compile_ok: boolean,
    smoke_run_ok: boolean,
    metric_diff: {
      html_metrics: { clear_rate, dominant_strategy_ratio, ... },
      engine_metrics: { ... },
      delta: { clear_rate_delta, ... },
      warnings: string[]
    },
    visual_diff?: { roi, threshold, passed },
    verdict: 'RE_PASS' | 'RE_FAIL' | 'NEEDS_TUNING',
    verdict_reason: string,
    tuned_at?: string                  // 사람이 수동 튠 후 통과 시점
  }
}
```

---

## 트랙 8 — 외부 도구 통합 vs 자체 구축 (라운드 3)

### gmk가 *반드시 직접 짜야 하는* 것 (남은 USP)

1. **Pillar+Hypothesis JSON schema 강제 + 가드** (Donchitos 18.2k에 없음)
2. **봇 = 낙제 게이트 / 사람 = 합격 게이트의 분리** (학계 합의 위 설계)
3. **HTML 프로토타입 폐기 가능성 강제** (Cleveland 룰 자동화)
4. **`__gmk_botHook__` API 표준** (봇 환각 구조적 차단)
5. **포팅 후 재검증 게이트** (godogen 패턴 자동화 — 현 미커버)
6. **gmk-wishlist-watch / patch-notes / nextfest-prep** (게임 도메인 톤·임계값) — v0.3 후

### 외부 도구에 *위임할* 것 (재발명 금지)

| 영역 | 외부 best | 이유 |
|---|---|---|
| 3D 모델 생성 | **Meshy 6** ($10/월 + Godot/Unity 플러그인) | 모델 인프라+엔진 임포트 천문학적 비용 |
| Unity 안 scene/code assist | **Unity AI** ($10/월) | scene graph API 직접 활용 — 외부 정확도 못 따라감 |
| 본격 QA UI 테스트 | **GameDriver** ($150/월) | 콘솔·플랫폼 다양성 |
| 모바일 F2P 라이브옵스 | **deltaDNA** | 세그멘트·캠페인 mature |
| NPC 다이얼로그 | **Inworld** | 음성+감정+행동 모델 |
| BGM | **Stable Audio** or **Mubert** (Suno 공식 API 없음 — 의존 금지) | 합성 회사 코어 |
| 빌드 | **firebelley/godot-export** / **GameCI** | 표준 |
| Steam 푸시 | **steamcmd + game-ci/steam-deploy** | 표준 |
| itch 푸시 | **butler** | 표준 |
| 크래시 | **Sentry** | 게임 엔진 폭 압도적 |
| 자막 | **Whisper** 로컬 | 무료 + 정확 |
| 현지화 | **Crowdin + 내장 AI** | TMS가 필수 |

### *건드리지 말아야 할* 것

- Steam 스토어 페이지 작성 — API 없음 + 카피라이팅 사람 판단
- Next Fest 등록 신청 — 수동 + 거절 위험
- 트레일러 최종 컷 — AI가 비트 못 잡음
- 인플루언서 직접 DM — 평판 자살
- 자동 set_live to default branch — Steam 안전장치 우회 금지

---

## 트랙 9 — 경쟁구도 (라운드 3)

### vs Claude-Code-Game-Studios (18.2k★)

| 기능 | gmk | CC-Game-Studios |
|---|---|---|
| Claude Code 플러그인 | ✅ | ✅ |
| 마일스톤 워크플로우 | ✅ | ✅ (72 스킬) |
| **Pillar schema 강제** | ✅ | ❌ |
| **Hypothesis schema 강제** | ✅ | ❌ |
| **HTML 단일파일 프로토타입** | ✅ | ❌ |
| **Playwright 봇 자가플레이** | ✅ | ❌ (체크리스트만) |
| **객관/주관 검증 분리** | ✅ | ❌ |
| 사람 게이트 매 마일스톤 | ✅ | ✅ |
| **HTML→엔진 포팅 자동화** | ✅ | ❌ (엔진에서 시작) |
| **포팅 후 재검증** | v0.2★ | ❌ |
| **폐기 가능성 강제** | ✅ | ❌ |
| 스킬 수 | 9 (v0.2 후) | 72 |
| 별 | 0 | 18.2k |

→ **gmk는 작고 날카로움**. 7개 차별점 모두 *진짜 강제*되면 사용자 이동 가능.

### vs godogen (3.2k★)

godogen은 *엔진 직출 + 스크린샷 self-repair*. gmk는 *HTML 단계 검증 + 포팅 시 재검증으로 환각 차단*. 직접 경쟁 아니라 *역할 분리*.

### vs Rosebud / Astrocade (소비자 시장)

소비자 시장 진입 금지. ICP를 **"Claude Code 쓰는 기존 엔진 사용자의 위험 회피"**로 한정.

---

## 트랙 10 — CONCEPT.md 수정 항목 (라운드 3)

1. **첫 문단**: "재미 검증" → "재미 falsification". *명백히 안 재밌는 것 거르기*, *재밌다는 사람*.
2. **§1**: "지원 장르 명시" 추가. "2D · 결정론적 입력 · 5분 이하 세션"
3. **§4 스킬표**: 7 → 9 (brainstorm, loop 추가)
4. **§6 봇 검증**: 단일 정책 → **4-페르소나 + state coverage + entropy + novelty** + suspicious-run
5. **§7 포팅**: "체크리스트" → **재검증 게이트 5단계**
6. **§8 가드 정책**: 봇 다양성 강제 추가
7. **§10 Phase 2**: 셰이더 visual diff, 출시 인프라 스킬 명시
8. **새 §13 — 경쟁구도와 차별화**: 18.2k Game-Studios와 7대 차이 명시
9. **새 §14 — 학계 한계와 정직성**: 봇이 못 보는 영역, "재미"의 본질적 미해결

---

## 한계 (못 찾은 것, 라운드 1-3 누적)

- IGDA Curriculum Framework PDF 1차 사료 (다중 mirror fetch 실패)
- Nijman "Art of Screenshake" 슬라이드 정량
- Shadertoy 클라이언트 회귀 테스트 (비공개)
- MAST 14모드 일부는 카테고리 단위 권고만
- Superpowers brainstorming SKILL.md 부속 파일 본문 (메타데이터만)
