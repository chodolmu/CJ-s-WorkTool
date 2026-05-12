# Handoff: gamemaker-kit v0.2 확장 (설계 완료, 구현 대기)

**Generated**: 2026-05-12
**Branch**: main (origin 대비 14 commits ahead, 미푸시)
**Status**: 설계 완료, Wave A 구현 시작 직전

---

## Goal

게임 개발 자동화 Claude Code 플러그인 `gamemaker-kit`을 v0.1 → v0.2로 확장. 현재 7스킬 → **약 28스킬**(4축 × 6직군 + 방법론 6 + 공통 인프라). 사용자 핵심 요구: *"플러그인 안에서 게임 개발을 끝낸다"* — 출시·라이브옵스·외부 피드백은 범위 밖.

---

## Completed

- [x] 리서치 3 라운드 (총 13개 서브에이전트 병렬)
  - 라운드 1-2: brainstorming 패턴(Superpowers 원문) + 분야별 에이전트(MAST 14모드 + Anthropic 가이드) + 셰이더 검증(three.js/PixiJS/Babylon 실측) + 기존 7스킬 내부 정독
  - 라운드 3: 외부 생태계(Rosebud/Astrocade/CC-Game-Studios) + 동형 문제 패턴(Optuna/Argo/Dovetail/LangGraph) + 인디 시간 가계부 + 자동 플레이테스팅 학술 + 출시 인프라 + 경쟁구도 정직 점검
  - 산출: `_research/extension-research.md`
- [x] 설계 v5 확정
  - 산출: `_workspace/extension-design.md`
  - 4축 모델(시간/직군/검증/통합), 개발 완료 끝점, _workspace 파일 흡수 우선, 외부 의존 0개
  - 약 28 스킬 매트릭스 (그룹 A 공통 6 + B 방법론 6 + C 직군 10 + D 검증·통합 6)
- [x] CONCEPT.md 원본 + 기존 7스킬 + 3 템플릿 + _bot_hook_lib.js 내부 정독 완료 (라운드 2 보고서)

---

## Not Yet Done

### Wave A — 공통/축(6) + 방법론 룰북(6) = 12 스킬
- [ ] milestones.json schema 확장 (`tasks[]`, hypothesis 강화, trials[], merge_gate, ported_to.re_validation)
- [ ] `_workspace/` 디렉토리 구조 정립 (vision.md / roadmap.md / dashboard.md / milestones/<id>/kanban.md)
- [ ] gmk-init UPDATE — vision.md 출력 + supported_genres_check
- [ ] gmk-roadmap NEW — 마일스톤 분해·우선순위·의존성 그래프
- [ ] gmk-brainstorm NEW — 옵트인 5단계 (Frame/Diverge/Stress-test/Converge/Pillar Audit)
- [ ] gmk-task-split NEW — 마일스톤→직군별 일감 분해→kanban.md
- [ ] gmk-status MAJOR UPDATE — dashboard.md + 칸반 + 막힘 감지 (haiku→sonnet 격상)
- [ ] gmk-loop NEW — 단순 디스패처 (Plan→Build→Validate→Integrate)
- [ ] gmk-prototype-rules NEW — 300줄 가드 + `__gmk_botHook__` API spec 룰북
- [ ] gmk-shape-advisor NEW — hypothesis→shape(grid/continuous/dialogue/shader) 결정
- [ ] gmk-portability-check NEW — HTML 메커닉의 포팅 위험도 카탈로그
- [ ] gmk-mechanic-merge NEW — 검증된 두 프로토타입 통합 spec
- [ ] gmk-kill-milestone NEW — Cleveland 룰 폐기 트리거
- [ ] gmk-mock-inject NEW — 자산 placeholder/의존 주입 (아트·사운드 도착 전 검증)

### Wave B — 직군(10) + 검증축(4) = 14 스킬
- [ ] _bot_hook_lib.js UPDATE — 옵셔널 콜백(stateSignature/riskEstimate/progressEstimate/noveltyScore)
- [ ] gmk-validate UPDATE — Procedural Personas 4종 + state coverage + suspicious-run 20판 + Trial pruning
- [ ] gmk-prototype UPDATE — Hypothesis schema 강제 가드, --type=shader 분기
- [ ] gmk-feedback → **gmk-self-test** RENAME — 외부 사람 개념 완전 제거, 사용자 본인 플레이만
- [ ] gmk-regression NEW — 마일스톤 누적 회귀 자동
- [ ] gmk-platform-check NEW — 플랫폼 호환성 (haiku)
- [ ] gmk-design-system NEW (기획)
- [ ] gmk-content-plan NEW (기획)
- [ ] gmk-refactor-check NEW (구현)
- [ ] gmk-art-spec NEW (아트)
- [ ] gmk-art-gen NEW (아트, /art wrapper)
- [ ] gmk-sound-plan NEW (사운드)
- [ ] gmk-ux-flow NEW (UX)
- [ ] gmk-narrative NEW (내러티브, 선택)
- [ ] gmk-save-migrate NEW (데이터)

### Wave C — 통합 (2)
- [ ] gmk-merge-gate NEW — 회귀+자산 충돌+secret 스캔(gitleaks)
- [ ] gmk-port UPDATE — 5단계 재검증 (Generate/Compile/Smoke/Metric diff/사람 RE-PASS)

### Wave D — 정리·에이전트·메타
- [ ] skills/gmk-share/ 디렉토리 통째로 제거 + CHANGELOG 명시
- [ ] agents/systems-designer.md / feel-engineer.md / economy-balancer.md / playtest-analyst.md NEW
- [ ] templates/prototype-shader.html NEW (vanilla WebGL2, 239줄 분배안)
- [ ] .claude-plugin/plugin.json v0.2.0 + marketplace.json v0.2.0
- [ ] README.md NEW — 개발 완료 끝점 + 4축 + 경쟁구도 + 학계 정직성
- [ ] CONCEPT.md 재작성 — "재미 검증"→"재미 falsification", 지원 장르, §13/§14 신규

---

## Failed Approaches (Don't Repeat These)

### F1. "작고 날카로움" 과보정 (설계 v3 → v4 폐기 이유)
v3에서 Donchitos `Claude-Code-Game-Studios`(18.2k★) 경쟁구도 발견 후 *과보정*해서 P0 3개(봇 고도화/Hypothesis schema/포팅 재검증)만 남기고 나머지를 v0.3+로 다 미뤘음. 사용자가 *"범용적이되 핵심만"* 지적 → v4에서 10스킬로 복원, 다시 v5에서 28스킬로 확장. **교훈**: 차별점 강도 ≠ 작게 가는 것. *각 축 안의 정수*를 깊이 있게 가져가야 진짜 범용.

### F2. 외부 도구 위임에 5-10개 서비스 묶기 (v3 출시 인프라 섹션 폐기)
처음엔 Notion/Discord/Linear/Sentry/butler/steamcmd/Crowdin 등 다 위임하는 어댑터 패턴 설계. 사용자 지적: *"클로드 코드 + gmk 하나"* 약속이 깨짐. **교훈**: 외부 위임은 *파일 흡수* 우선. md/json 파일로 같은 효용 → Notion 등은 사용자 선택. 실제 외부 의존은 Playwright + gitleaks + 게임 엔진 CLI만.

### F3. 출시·라이브옵스 자동화를 gmk에 묶기 (v3 출시 트랙 전체 폐기)
gmk-publish-steam, gmk-wishlist-watch, gmk-patch-notes, gmk-review-pulse, gmk-presskit, gmk-localize 등 10개 후보. 사용자 명시: *"게임 출시가 아닌 게임 개발 완료에 포커스"*. **교훈**: gmk 끝점 = "개발 완료" 선언. Steam 페이지·위시리스트·라이브옵스는 *명시적으로* 범위 밖.

### F4. 외부 사람 피드백 채널 자동 수집 (Discord/Steam/itch RSS) — 폐기
gmk-feedback에 외부 채널 자동 수집·텍스트 입력 둘 다 포함. 사용자: *"검증 축에 사용자 본인만 검증 — 외부 사람 검증이 들어가는건 이 플러그인의 목표가 아니야"*. **교훈**: 검증축 = 봇 80% + 사용자 본인 self-test 20%. 외부 사람 0%. `gmk-feedback` → `gmk-self-test` 리네임. `kind: 'human'` → `kind: 'self-test'`.

### F5. zoodev-loop 통합 시도 (설계 v1 폐기)
설계 v1에서 zoodev-loop를 일반화·흡수 후보로 다룸. 사용자: *"zoodev-loop는 이것과 아예 별개의 이야긴데 이건 왜나오는거야?"*. **교훈**: zoodev-loop는 ZooMerge 전용. gamemaker-kit과 직교. 절대 통합 안 함.

### F6. HTML 프로토타이핑 방법론을 직군 스킬 안에 묻기 (v5 직전 폐기)
v4에서 직군 스킬 22개로 확장하면서 정작 *HTML 단일파일 + 300줄 가드 + hook API + shape 선택*이라는 우리 코어 방법론을 gmk-prototype 한 스킬에 묻음. 사용자 지적: *"html웹 프로토타이핑 같은 개발 방법론적인 내용들은 다 어디갔어"*. **교훈**: 방법론은 *횡단 1등 시민*. 별도 그룹 B(6 스킬)로 분리.

### F7. AskUserQuestion 옵션 4개 초과 (한 번 실패)
한 질문에 5개 옵션 보내서 InputValidationError. 4개로 줄여서 재시도. **교훈**: 옵션 최대 4개.

---

## Key Decisions

| 결정 | 근거 |
|---|---|
| **끝점 = "개발 완료"** | 사용자 명시. Steam·라이브옵스·외부 피드백은 gmk 밖 |
| **4축 모델 (시간/직군/검증/통합)** | 라운드 3 후 사용자가 그린 그림: 비전→마일스톤→사이클(직군 병렬+검증+머지)→완성 |
| **검증축: 봇 80% + 사용자 본인 20%, 외부 사람 0%** | 사용자 명시. gmk-feedback → gmk-self-test 리네임 |
| **파일 흡수 우선 (외부 도구 위임 최소화)** | 사용자: *"외부 도구를 또 복잡하게 이것저것 써야 하면 의미에서 벗어남"*. _workspace/ md/json이 단일 소스 |
| **외부 의존 0개 (Playwright + gitleaks + 게임 엔진만)** | 파일 흡수 우선의 결과 |
| **약 28 스킬 — 4그룹 (공통 6 + 방법론 6 + 직군 10 + 검증·통합 6)** | 사용자: *"좀 더 많은게 담겨있어야 하지 않나"*. 단 각 스킬 입구 수준 깊이 |
| **방법론(HTML 프로토 룰북) 1등 시민** | 사용자 지적: 방법론이 직군 스킬에 묻혀 안 보임. 그룹 B로 별도 분리 |
| **gmk-share 제거** | 외부 공유는 개발 완료 밖. v0.2에서 디렉토리 삭제 + CHANGELOG 명시 |
| **"재미 검증" → "재미 falsification"** | EA SEED + MS Research 컨센서스: 봇은 fun 못 잼. 정직성이 차별점 |
| **지원 장르 명시: 2D · 결정론적 입력 · 5분 이하 세션** | 라운드 3 회의론 점검. 그 외 장르는 Phase 3 어댑터 |
| **agents/ 위치 = `<plugin>/agents/`** | Claude Code 공식 docs 원문 — NOT `.claude-plugin/` 안 |
| **agents 본문 구조 = Anthropic 4요소 + MAST FM-1.2/1.5/3.3 대응** | 라운드 2 실증 |
| **에이전트 간 직접 통신 금지, supervisor(/gmk-loop) 경유만** | $47K 무한 루프 + 17× 에러 증폭 사례 대응 |
| **max-iteration = 1, 양방향 verification 금지** | 같은 사례 대응 |
| **VoltAgent JSON Communication Protocol 채택 안 함** | 과도, milestones.json + 평문 충분 |
| **Procedural Personas 4종 hand-tuned (진화 학습 X)** | Holmgård TCIAIG 2019. 진화 비용 회피 |
| **Suspicious-run 20판 자동 추출 → 사용자 본인 라우팅** | Riot+Modl 패턴. "봇이 사람 주의를 라우팅" |
| **Hypothesis schema에 confidence/baseline/early_fail 강제** | Optuna Study/Trial + W&B 패턴. 차별 ground를 JSON으로 강제 |
| **포팅 5단계 재검증 (Generate/Compile/Smoke/Metric diff/사람 RE-PASS)** | godogen 4번 rewrite 사례 대응 |

---

## Current State

**Working**:
- 기존 v0.1 자산 모두 그대로 동작:
  - 7 스킬: gmk-init / gmk-prototype / gmk-validate / gmk-share / gmk-feedback / gmk-port / gmk-status
  - 3 템플릿: prototype-grid.html / prototype-continuous.html / prototype-dialogue.html
  - _bot_hook_lib.js (162줄, makeHook 표준 5종)
  - .claude-plugin/plugin.json + marketplace.json (v0.1.0)
  - CONCEPT.md (250줄, 12섹션)
  - _research/research-summary.md

**Broken**: 없음. v0.2 작업이 시작 안 됨.

**Uncommitted Changes**:
- gamemaker-kit 내부엔 *없음* (status에 잡힌 변경은 상위 디렉토리의 다른 프로젝트)
- gamemaker-kit 자체는 git status에 안 보이는데 — 디렉토리가 git에 추가 안 됐을 가능성 있음. 첫 커밋 전에 `git status`로 확인 필요

---

## Files to Know

| 파일 | 왜 중요한가 |
|---|---|
| `_workspace/extension-design.md` | **v5 설계 문서**. 모든 결정·스킬 매트릭스·Wave 순서·검증 체크리스트. 구현 시작 전 반드시 정독 |
| `_research/extension-research.md` | 라운드 1-3 통합 리서치. 각 결정의 근거. 의심나는 결정은 여기서 출처 확인 |
| `CONCEPT.md` | v0.1 원본 개념 — *재작성 대상*이지만 톤·구조 레퍼런스 |
| `_research/research-summary.md` | 6라운드 원본 리서치 (v0.1 결정 근거) |
| `skills/gmk-prototype/SKILL.md` | 253줄. 톤 가이드 + 300줄 가드 + hook 강제 패턴 — 신규 SKILL.md의 톤 레퍼런스 |
| `skills/gmk-validate/SKILL.md` | 325줄. 봇 검증 흐름 — Wave B에서 Procedural Personas로 확장 |
| `skills/gmk-port/SKILL.md` | 342줄. 포팅 흐름 — Wave C에서 5단계 재검증 추가 |
| `templates/_bot_hook_lib.js` | 162줄. makeHook(spec) 5종. Wave B에서 옵셔널 콜백 추가 |
| `templates/prototype-grid.html` | 243줄. 메타 헤더 + hook 노출 패턴. shader 템플릿 작성 시 레퍼런스 |
| `.claude-plugin/plugin.json` | v0.1.0 → v0.2.0 (Wave D) |
| `.claude-plugin/marketplace.json` | v0.1.0 → v0.2.0 — **두 파일 둘 다 올림 (메모리 룰)** |

---

## Code Context

### `_workspace/` 디렉토리 구조 (Wave A에서 만들어야 함)

```
ZooMerge/                              # 사용자 게임 프로젝트
├─ prototypes/                         # HTML 단일파일 프로토타입
├─ .gamemaker-kit/                     # 내부 상태
│   ├─ pillars.json                    # 사용자 편집 가능
│   ├─ milestones.json                 # gmk 갱신
│   ├─ validations/<m>/
│   │   ├─ trial-{id}.json
│   │   ├─ aggregated.json
│   │   └─ suspicious/<seed>.json
│   ├─ self-tests/<m>/                 # ★ feedback/ 아님
│   │   ├─ session-{date}.md           # 사용자 본인 플레이 노트
│   │   └─ coded.md
│   ├─ merge-gates/<m>.md
│   └─ port-checklists/<m>.md
└─ _workspace/                         # 사용자가 매일 보는 md 대시보드
    ├─ vision.md                       # 북극성
    ├─ roadmap.md                      # 마일스톤 목록·우선순위
    ├─ dashboard.md                    # 매번 덮어쓰기
    ├─ brainstorms/M{n}-{slug}.md      # /gmk-brainstorm 산출 (옵트인)
    └─ milestones/<id>/
        ├─ kanban.md                   # 직군별 일감
        └─ notes.md                    # 사용자 자유 메모
```

### milestones.json schema (Wave A에서 확장)

```typescript
{
  project_name: string,
  milestones: [{
    id: string,
    name: string,
    pillars_targeted: string[],
    hypothesis: {
      if: string,
      then: string,
      measured_by: [{
        metric: 'clear_rate' | 'state_coverage' | 'action_entropy'
              | 'frustration_proxy' | 'dominant_strategy_ratio' | 'crash_rate'
              | 'self_test_says_X' | string,
        kind: 'bot' | 'self-test',                  // ★ 'human' 아님
        target: { op: '>' | '<' | '==' | 'between', value: number | [number, number] },
        confidence: 0.80 | 0.90 | 0.95,
        sample_size: number,
        baseline?: {
          source: 'previous-milestone' | 'absolute',
          value: any,
          milestone_id?: string
        },
        early_fail?: { after_runs: number, condition: string }
      }],
      trials: [{
        trial_id, started_at, config, result: { metrics, verdict, pruned, pruned_reason, finished_at }
      }]
    },
    prototype: string,
    shape: 'grid' | 'continuous' | 'dialogue' | 'shader',  // shader 추가
    created_at: string,

    // ★ Wave A에서 신규
    tasks: [{
      id: string,
      discipline: 'design' | 'code' | 'art' | 'audio' | 'ux' | 'qa',
      title: string,
      status: 'backlog' | 'in-progress' | 'review' | 'done' | 'blocked',
      blocked_by?: string[],
      assignee?: string,
      created_at, updated_at, completed_at?
    }],

    validation?: { /* 페르소나별 metric 포함 */ },
    validation_history?: [...],

    // ★ Wave B: gmk-self-test에서 갱신
    self_test?: {
      sessions: [{
        date: string,
        duration_min: number,
        notes_path: string,
        suspicious_seeds_reviewed: number[],
        verdict: 'PASS' | 'FAIL' | 'NEEDS_MORE_PLAY'
      }],
      coded_themes: [...],
      latest_verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE'
    },

    // ★ Wave C: gmk-merge-gate에서 갱신
    merge_gate?: {
      ran_at: string,
      regression_ok: boolean,
      asset_conflicts: [{ path: string, milestones: [string] }],
      secrets_detected: [{ file, line, type }],
      verdict: 'PASS' | 'FAIL',
      warnings: string[]
    },

    // ★ Wave C: gmk-port에서 갱신
    ported_to?: {
      ported_at, engine, files_created, files_modified, checklist,
      re_validation: {
        compile_ok: boolean,
        smoke_run_ok: boolean,
        metric_diff: {
          html_metrics, engine_metrics, delta, warnings
        },
        visual_diff?: { roi, threshold, max_diff_pixel_ratio, passed },
        verdict: 'RE_PASS' | 'RE_FAIL' | 'NEEDS_TUNING',
        verdict_reason: string,
        tuned_at?: string
      }
    },

    killed?: boolean
  }]
}
```

### Procedural Personas (Wave B, hand-tuned utility)

```js
// _bot_hook_lib.js의 옵셔널 콜백
makeHook({
  // 기존 5종 (필수)
  reset, isOver, legalActions, apply, collectSummary,

  // ★ 신규 옵셔널
  stateSignature: () => string,         // JSON.stringify([gridState, score]) 정도
  riskEstimate: (action) => number,     // 0..1
  progressEstimate: () => number,       // 0..1
  noveltyScore: (action) => number,     // 0..1
});

// gmk-validate의 페르소나 utility
const personas = {
  Runner:   (s, a) => 0.8 * progress(s, a) + 0.2 * score(s, a),
  Treasure: (s, a) => 0.1 * progress(s, a) + 0.9 * score(s, a),
  Survivor: (s, a) => 0.5 * progress(s, a) + 0.5 * (1 / risk(s, a)),
  Explorer: (s, a) => 0.3 * score(s, a) + 0.7 * novelty(s, a),
};

// --policy persona-mix = 200판을 4종 × 50판 분할
```

### Suspicious-run 자동 추출 기준

```
200판 후 outlier 20판 선정:
- entropy 하위 10% (한 가지 행동만)
- entropy 상위 10% (너무 흩어짐)
- duration 양끝 5% (너무 짧거나 길거나)
- crashed/stuck 전부

→ validations/<m>/suspicious/{seed}.json 저장
→ /gmk-self-test가 사용자에게 우선순위 순으로 노출
```

### 포팅 5단계 재검증 (Wave C, gmk-port)

```
[Stage 1: Generate] systems-designer가 HTML→GDScript/C# 변환
[Stage 2: Compile]  godot --headless --check-only → fail 시 1회 retry
[Stage 3: Smoke]    봇 5판 → crash 시 1회 retry
[Stage 4: ★ Metric diff] HTML 200판 vs Engine 200판
                    - clear_rate delta > 0.2 → "게임필 안 옮겨짐" 경고
                    - dominant_strategy 변경 → "메커닉 환각 의심"
                    - action_entropy delta > 0.3 → "전략 공간 변경"
[Stage 5: 사람 RE-PASS] RE_PASS / RE_FAIL / NEEDS_TUNING
```

### 신규 SKILL.md 톤 규칙 (라운드 2 실측, 8개)

기존 7스킬 정독에서 추출. 신규 28스킬 작성 시 강제 준수:
1. Conversational ≠ Wishy-Washy ("Pick **one** of these")
2. 제약은 hard cap vs soft cap 명시 ("at 300 lines warn, at 600 refuse")
3. 거부는 명시 메시지 + stop
4. 숫자는 근거와 함께 ("200 runs — fewer is unreliable")
5. "Not" 리스트로 경계 명확
6. Notes 섹션은 "don't" 명령형
7. API 환각 차단 — well-known 이름 명시
8. 사용자 override는 명시 flag + audit trail (`forced: true`)

표준 섹션 구조:
```
# gmk-{slug} — [한 문구 north star]
[0-2문 도입]
## Preconditions
## Flow (Step 1, Step 2, ...)
## Edge cases & policy
## What this skill does NOT do
## Notes for the model running this skill
```

### 에이전트 frontmatter (Wave D, agents/)

위치: `gamemaker-kit/agents/` (NOT `.claude-plugin/agents/`)

```yaml
---
name: <kebab-case>
description: |
  <한 줄 역할> on HTML prototypes for gamemaker-kit milestones.
  Use proactively when <트리거 키워드>.
tools: Read, Edit, Write, Bash, Glob, Grep
model: sonnet
color: <orange|purple|green|blue>
---

You are a senior <role> embedded in the gamemaker-kit pipeline.

## Objective
## Output format
## Tools & sources
## Boundaries (역할 경계 — MAST FM-1.2)
## Refusal conditions (FM-3.3)
## Termination (FM-1.5, max-iteration=1)
## Notes
```

4개 에이전트:
- **systems-designer** (sonnet) — 메커닉/규칙 spec
- **feel-engineer** (sonnet) — 손맛/이펙트 튜닝
- **economy-balancer** (sonnet) — 수치 밸런스
- **playtest-analyst** (sonnet) — 검증 결과 판정 (단방향 verification)

---

## Resume Instructions

### 1. 설계 문서 정독
```
Read C:\GameMaking\Tool\gamemaker-kit\_workspace\extension-design.md
```
v5 설계 전체. 특히 §3 스킬 매트릭스 / §6 Wave별 구현 / §11 검증 체크리스트.

### 2. 리서치 문서 참조 (의심나는 결정 출처 확인용)
```
Read C:\GameMaking\Tool\gamemaker-kit\_research\extension-research.md
```

### 3. 기존 스킬 톤 레퍼런스 정독 (신규 SKILL.md 작성 전)
```
Read C:\GameMaking\Tool\gamemaker-kit\skills\gmk-prototype\SKILL.md
Read C:\GameMaking\Tool\gamemaker-kit\skills\gmk-validate\SKILL.md
```
이 톤·구조를 따라 신규 28스킬 작성.

### 4. Wave A부터 구현 시작

**Step A1 — milestones.json schema 확장 예제 작성**:
- 새 schema의 valid 예제 1개를 `_workspace/examples/milestones-example.json`에 작성
- 기존 milestones.json과 backward compat 확인 (필드 추가만, 기존 필드 보존)

**Step A2 — _workspace/ 디렉토리 구조 가이드 작성**:
- `_workspace/structure.md`에 디렉토리 트리 + 각 파일 역할 명세
- vision.md, roadmap.md, dashboard.md의 *형식 템플릿* 명시 (placeholder 포함)

**Step A3 — 공통 인프라 6 스킬 작성** (그룹 A):
1. gmk-init UPDATE (기존 SKILL.md 수정)
2. gmk-roadmap NEW (skills/gmk-roadmap/SKILL.md 신규)
3. gmk-brainstorm NEW
4. gmk-task-split NEW
5. gmk-status MAJOR UPDATE (haiku→sonnet 격상, dashboard.md 생성 흐름)
6. gmk-loop NEW

각 스킬은 라운드 2 톤 8규칙 + 표준 섹션 구조 준수.

**Step A4 — 방법론 룰북 6 스킬 작성** (그룹 B, ★ 차별 ground):
1. gmk-prototype-rules NEW (300줄 가드 + hook API spec 룰북 — *다른 스킬이 호출*)
2. gmk-shape-advisor NEW
3. gmk-portability-check NEW
4. gmk-mechanic-merge NEW
5. gmk-kill-milestone NEW
6. gmk-mock-inject NEW

**Step A5 — Wave A 검증**:
- 12개 SKILL.md 모두 frontmatter 정합성 (name/description/model)
- 톤 8규칙 준수 (특히 거부 조건 명시 메시지)
- _workspace/ 파일 형식 일관성

**Step A6 — git commit**: "feat(v0.2): Wave A — 공통/축 인프라 6 + 방법론 룰북 6 스킬"

### 5. Wave B → C → D 순서로 진행
설계 문서 §10 구현 순서 그대로.

### 6. 마지막 — 메타 갱신 + git push
- plugin.json + marketplace.json 둘 다 v0.2.0 (메모리 룰)
- README.md 신규 작성 (개발 완료 끝점 + 4축 + 경쟁구도 + 학계 정직성)
- CONCEPT.md 재작성

---

## Setup Required

**필수**:
- Node + npm (Playwright는 사용자가 봇 검증 돌릴 때만 설치)
- 게임 엔진 (Godot 4 / Unity) — 사용자 측 필수, gmk는 안 깔음

**선택**:
- gitleaks CLI — Wave C의 gmk-merge-gate에서 호출. 사용자 측에서 설치 가이드만 제공

**환경 변수**: 없음. 모든 상태는 사용자 프로젝트의 `.gamemaker-kit/` 안. 외부 서비스 키 0개.

---

## Warnings

### W1. 기존 7스킬과의 backward compat
- 기존 사용자의 milestones.json은 *새 필드 없이* 동작해야 함. Wave A schema 확장 시 신규 필드는 *옵셔널*.
- gmk-feedback → gmk-self-test 리네임은 *breaking change*. 기존 사용자에게 마이그레이션 안내 CHANGELOG 필수.

### W2. _workspace 경로 정책 (글로벌 메모리 룰)
`C:\GameMaking\CLAUDE.md` 명시: 게임별 워크스페이스는 *해당 게임 폴더 안의 `_workspace/`*. `C:\GameMaking\_workspace\`는 art 파이프라인 공유 자원 전용. gmk가 `_workspace/`를 만들 때 반드시 *사용자 게임 폴더 안*에 둘 것.

### W3. zoodev-loop 안 건드림
사용자 명시. CONCEPT.md §9 "병렬 사용"은 유지하되, gmk-loop가 zoodev-loop를 *흡수* 시도 절대 안 함.

### W4. ZooMerge dogfood 별도 (글로벌 메모리 룰)
gmk dogfood는 ZooMerge 아닌 별개 게임. ZooMerge 디렉토리 절대 열지 말 것 (`feedback_pillar_framing.md` 메모리 룰).

### W5. plugin.json + marketplace.json 동시 버전 업 (글로벌 메모리 룰)
`feedback_version_bump.md` 메모리 룰: taskforge-pro push 시 두 파일 둘 다 버전 올림. gmk도 같은 정책 적용.

### W6. 에이전트 위치 함정
Claude Code 공식 docs 원문: *"Don't put commands/, agents/, skills/, or hooks/ inside the .claude-plugin/ directory."* — agents는 `<plugin>/agents/`. 절대 `.claude-plugin/agents/` 아님.

### W7. AskUserQuestion 옵션 최대 4개
한 질문당 옵션 5개 이상이면 InputValidationError. 4개로 분할.

### W8. 출시·라이브옵스 영역 유혹 차단
v3에서 한 번 출시 인프라 쪽으로 시야 쏠림. *"개발 완료 끝점"* 원칙 위반 신호:
- gmk-publish-* 류 스킬 추가 시도
- 위시리스트·리뷰·패치노트 자동화 시도
- 외부 사람 피드백 수집 채널 추가 시도

이 신호 발견되면 즉시 사용자에게 *"이거 개발 완료 밖인데 진짜 v0.2에 넣을까요"* 확인.

### W9. CC-Game-Studios(18.2k★) 과보정 함정
설계 v3에서 한 번 *작고 날카로움*으로 과보정. 사용자: *"크기가 작고 스페셜하게 가지는 않을건데"*. 차별점 강도 ≠ 작게. 약 28스킬 규모 유지.

### W10. 학계 컨센서스 정직성
*"재미 검증"이라는 표현 절대 사용 금지*. 항상 *"재미 falsification"* (안 재밌는 것 거르기). README와 CONCEPT.md에 이 정직성이 강조돼야 함 — EA SEED + MS Research 출처와 함께.

---

## Task List 상태 (Resume 시 TaskList 호출하면 확인 가능)

- #1 [completed] 리서치 라운드 1+2 통합
- #2 [completed] 설계 v4 → v5 (4축 + 개발 완료 + 파일 흡수 + 외부 0개)
- #3 [pending] **Wave A: 공통/축(6) + 방법론 룰북(6) = 12 스킬** ← 다음 시작점
- #4 [pending] Wave B: 직군 10개 + 검증축 4개 = 14 스킬
- #5 [pending] Wave C: 통합 게이트 + 포팅 = 2 스킬
- #6 [pending] Wave D: gmk-share 제거 + 4 에이전트 + shader 템플릿 + 메타
