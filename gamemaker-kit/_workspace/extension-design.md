# gamemaker-kit 확장 설계 v5 (v0.1 → v0.2)

라운드 1-3 + 사용자 방향성 최종 통합:
- 개발 완료 끝점 (출시·라이브옵스 제외)
- 파일 흡수 우선 (외부 의존 0개, gitleaks/Playwright만)
- **검증축은 봇 + 사용자 본인 self-test만** (외부 사람 0%)
- **약 28 스킬 — 4축 × 6직군 + 방법론 6 + 공통 인프라**
- 방법론(HTML 프로토타이핑 룰)을 1등 시민으로 복원

---

## 0. 한 줄 약속 재정립

**gmk-kit = "게임 *개발*을 한 컨텍스트에서 끝낸다"**

- 끝점 = "개발 완료" (사용자가 *"이제 출시 준비만 하면 된다"* 선언 시점)
- 출시·라이브옵스·소셜·외부 피드백 채널 = **gmk 밖**
- 약속: Claude Code + gmk + 게임 엔진 + 로컬 CLI 두어 개 외에 **외부 서비스·계정 0개**

학계 컨센서스 정직:
- 봇은 fun을 못 잰다 → gmk는 **"재미 falsification"** (안 재밌는 것만 거름)
- 재밌다 판정은 영원히 사람
- 지원 장르: **2D · 결정론적 입력 · 5분 이하 세션** (그 외는 Phase 3 어댑터)

---

## 1. 4축 모델 — gmk의 모든 능력은 이 축에 속함

```
                    ┌──────────────────────────────────┐
                    │  [북극성: Vision · Pillars]        │
                    └────────┬─────────────────────────┘
                             ↓
                    ┌──────────────────────────────────┐
                    │  [마일스톤 분해: 우선순위·의존성]    │
                    └────────┬─────────────────────────┘
                             ↓
        ┌──────────────────────────────────────────────────────────┐
        │  ★ 마일스톤 사이클 (이걸 N번 반복) — 4축 동시 진행            │
        │                                                            │
        │  축 1 시간 ───── Plan(가설·일감)                            │
        │  축 2 직군 ───── Build (기획·구현·아트·사운드·UX·QA 병렬)    │
        │  축 3 검증 ───── Validate (봇 80% + 사용자 본인 self-test 20%) │
        │  축 4 통합 ───── Integrate (머지·충돌·secret·포팅 재검증)    │
        │                                                            │
        └────────┬───────────────────────────────────────────────────┘
                 ↓
        🏁 개발 완료 (gmk 끝점)

        ┄┄┄┄┄┄┄┄┄ gmk 밖 ┄┄┄┄┄┄┄┄┄
        Steam 페이지 · 마케팅 · 출시 · 라이브옵스 · 패치노트
```

### 4축 각각의 정수

| 축 | 핵심 결정 지원 | 사용자가 매일 부딪히는 통증 |
|---|---|---|
| **1 시간** | "이 마일스톤이 Pillar를 강화하나? 다음 무엇? 끝낼 시점인가?" | 방향 잃기, 끝낼 줄 모름 |
| **2 직군** | "어느 직군이 막혔나? 우선순위 어떻게? 아트 늦으면 코드는?" | 직군 동기화 실패 |
| **3 검증** | "200판 봇으로 충분? 지금 내가 직접 플레이할 시점? suspicious-run 20판 중 어느 걸 먼저 볼까?" | 자기 시간 + 객관성 |
| **4 통합** | "지금 머지 위험? 자산 충돌? secret 노출? 포팅 후 게임필 유지?" | 통합 폭탄 |

---

## 2. _workspace/ 디렉토리 — gmk의 단일 진실

**핵심 원칙**: 모든 컨텍스트는 사용자 프로젝트의 `_workspace/` 안 md/json 파일로 살아있음. 외부 서비스 0개.

```
ZooMerge/                                  # 사용자 게임 프로젝트
├─ godot/                                  # 본 엔진 프로젝트
├─ prototypes/                             # HTML 단일파일 프로토타입
│   ├─ m1-merge-feel.html
│   └─ ...
├─ .gamemaker-kit/                         # gmk 내부 상태 (gitignore 가능)
│   ├─ pillars.json                        # 비전·Pillar 정의 (사용자 편집 가능)
│   ├─ milestones.json                     # 마일스톤 전체 schema (gmk가 갱신)
│   ├─ integrations.toml                   # 향후 출시 단계에서 키 저장 (gitignore)
│   ├─ validations/<milestone>/            # 봇 200판 결과
│   │   ├─ trial-{id}.json
│   │   ├─ aggregated.json
│   │   └─ suspicious/<seed>.json          # 사람이 봐야 할 outlier 20판
│   ├─ self-tests/<milestone>/
│   │   ├─ session-{date}.md               # 사용자 본인의 플레이 노트 (raw)
│   │   └─ coded.md                        # gmk 자동 thematic coding (사용자 자기 코멘트만)
│   ├─ merge-gates/<milestone>.md          # 머지 게이트 결과
│   └─ port-checklists/<milestone>.md      # 포팅 재검증 체크
└─ _workspace/                             # 사용자가 매일 보는 md 대시보드
    ├─ vision.md                           # 북극성 (Pillar 사람 친화 표시)
    ├─ roadmap.md                          # 마일스톤 목록·우선순위 (gmk 자동 갱신, 사용자도 편집 가능)
    ├─ dashboard.md                        # 매번 덮어쓰기 — 직군·막힘·다음 액션
    ├─ brainstorms/                        # /gmk-brainstorm 산출 (옵트인)
    │   └─ M{n}-{slug}.md
    └─ milestones/<id>/
        ├─ kanban.md                       # 직군별 일감 칸반
        └─ notes.md                        # 사용자 자유 메모
```

**파일 흡수 우선의 효과**:
- 사용자가 VSCode에서 그대로 봄
- git으로 백업
- Notion·Linear에 *복사·붙여넣기*하고 싶으면 사용자 자유 (gmk는 모름)
- gmk는 *primary source*이고 모든 외부 도구는 *읽기 미러*. 양방향 sync 안 함

---

## 3. 스킬 매트릭스 — v0.2 최종 (약 28개)

**구성**: 공통/축 인프라 + 방법론(HTML 프로토타이핑 룰) + 직군별 일감 처리 + 검증·통합. 모두 *입구 수준* 깊이 (명세·검증·결정 지원·다음 액션 권고; 실 자산 생성은 외부 도구 wrapper).

### 그룹 A — 공통/축 인프라 (6)

| 스킬 | model | 축 | 상태 | 역할 |
|---|---|---|---|---|
| **gmk-init** | opus | 1 | UPDATE | vision.md + pillars.json 생성, 지원 장르 안내 |
| **gmk-roadmap** | sonnet | 1 | **NEW** | 마일스톤 분해, 우선순위, 의존성 그래프 → roadmap.md |
| **gmk-brainstorm** | sonnet | 1 | **NEW** | 옵트인 발산-수렴 (5단계, MDA 렌즈) |
| **gmk-task-split** | sonnet | 1·2 | **NEW** | 마일스톤 → 직군별 일감 분해 → kanban.md |
| **gmk-status** | sonnet | 2 | **MAJOR UPDATE** | dashboard.md + 칸반 + 막힘 감지 + 다음 액션 권고 |
| **gmk-loop** | sonnet | all | **NEW** | 단순 디스패처 (Plan→Build→Validate→Integrate) |

### 그룹 B — 방법론 (HTML 프로토타이핑 룰북, 6) ★ 우리만의 ground

| 스킬 | model | 축 | 역할 |
|---|---|---|---|
| **gmk-prototype-rules** | sonnet | 2·4 | **NEW** | 300줄 가드, `__gmk_botHook__` API spec, hook 자가검증. 다른 스킬이 호출하는 *룰북* |
| **gmk-shape-advisor** | sonnet | 1·2 | **NEW** | hypothesis → shape 선택 결정 지원 (grid/continuous/dialogue/shader) |
| **gmk-portability-check** | sonnet | 4 | **NEW** | HTML 메커닉의 *포팅 위험도* 사전 평가 (환각 가능성 카탈로그) |
| **gmk-mechanic-merge** | sonnet | 1·4 | **NEW** | 두 검증된 프로토타입을 *통합 마일스톤*으로 합치는 spec |
| **gmk-kill-milestone** | sonnet | 1 | **NEW** | 폐기 트리거 (Cleveland 룰). 마일스톤 죽이고 새로 시작 |
| **gmk-mock-inject** | sonnet | 2 | **NEW** | 외부 자산(아트/사운드) placeholder·의존 주입. 도착 전 검증 가능 |

### 그룹 C — 직군별 일감 처리 (10)

| 스킬 | model | 직군 | 축 | 역할 |
|---|---|---|---|---|
| **gmk-design-system** | sonnet | 기획 | 2 | **NEW** | 시스템 다이어그램·상태머신·데이터 모델 spec |
| **gmk-content-plan** | sonnet | 기획 | 1·2 | **NEW** | 컨텐츠 분량 + 진행 곡선 계산 |
| **gmk-prototype** | sonnet | 구현 | 2 | UPDATE | Hypothesis schema 강제 가드, --type=shader 분기 |
| **gmk-refactor-check** | sonnet | 구현 | 4 | **NEW** | 테크부채·복잡도·데드코드 검출 |
| **gmk-art-spec** | sonnet | 아트 | 2 | **NEW** | 자산 명세·일관성 가드·팔레트 잠금 |
| **gmk-art-gen** | sonnet | 아트 | 2 | **NEW** | 외부 `/art` 스킬 wrapper (ComfyUI 파이프라인 호출) |
| **gmk-sound-plan** | sonnet | 사운드 | 2 | **NEW** | SFX/BGM 명세, 적응형 음악 의도 |
| **gmk-ux-flow** | sonnet | UX | 2 | **NEW** | 메뉴·FTUE·입력 매핑·접근성 체크 |
| **gmk-narrative** | sonnet | 내러티브 (선택) | 2 | **NEW** | 분기 트리·대사량·톤 일관성 (내러티브 게임만) |
| **gmk-save-migrate** | sonnet | 데이터 | 4 | **NEW** | 세이브 호환성·스키마 마이그레이션 |

### 그룹 D — 검증·통합 (5)

| 스킬 | model | 직군 | 축 | 역할 |
|---|---|---|---|---|
| **gmk-validate** | sonnet | QA | 3 | UPDATE | Procedural Personas 4종, state coverage, suspicious-run 20판 |
| **gmk-self-test** | sonnet | QA (사용자 본인) | 3 | **RENAMED** | gmk-feedback → gmk-self-test. 본인 플레이 노트 + suspicious-run 우선순위. 외부 사람 개념 완전 제거 |
| **gmk-regression** | sonnet | QA | 3·4 | **NEW** | 마일스톤 누적 회귀 자동 (이전 PASS 마일스톤 봇 재실행) |
| **gmk-platform-check** | haiku | QA | 3·4 | **NEW** | 플랫폼 호환성 빠른 점검 |
| **gmk-merge-gate** | sonnet | 공통 | 4 | **NEW** | 회귀 + 자산 충돌 + secret 스캔(gitleaks) |
| **gmk-port** | opus | 구현 | 4 | UPDATE | 5단계 재검증 게이트 |

총 **약 28 스킬** (그룹 A 6 + B 6 + C 10 + D 6, gmk-merge-gate가 그룹 D에 중복 카운트 안 함).

**제거**: `gmk-share` — 외부 게시는 gmk 끝점 밖. v0.2에서 디렉토리 제거 + CHANGELOG 명시.

---

## 4. agents/ 4개 도메인 에이전트 (라운드 1-2 유지)

위치: `gamemaker-kit/agents/` (Claude Code 플러그인 공식 표준)

| 에이전트 | 도메인 4축 매핑 (Supercell JD) | 호출 단계 | 거부 (MAST 매핑) |
|---|---|---|---|
| **systems-designer** | 시스템 디자인 | prototype spec, port 재설계 | pillars/milestones 없음 (FM-1.1) |
| **feel-engineer** | 콘텐츠 반복 (감각) | prototype 튜닝, shader | systems spec 수정 (FM-1.2) |
| **economy-balancer** | 이코노미·메트릭 | numeric metric 있는 마일스톤 | numeric 임계 없음 (FM-3.3) |
| **playtest-analyst** | 자율 LiveOps (피드백) | validate, feedback | hypothesis.measured_by 임계 없음 (FM-3.3) |

공통 frontmatter + 본문 표준 (Anthropic 4요소 + MAST 대응 + 기존 톤 8규칙 준수). 라운드 2 설계 그대로.

안전 모델: 단방향 verification(playtest-analyst만 검증, $47K 루프 대응) + 에이전트 간 직접 통신 금지(supervisor 경유, 17× 에러 증폭 대응) + max-iteration=1.

---

## 5. 데이터 schema (v0.2 확장)

### pillars.json (사용자 편집 가능)

```json
{
  "project_name": "ZooMerge",
  "engine": "godot",
  "created_at": "2026-05-12",
  "pillars": [
    {
      "id": "tactile-satisfaction",
      "name": "손맛",
      "description": "모든 상호작용에 chunky한 피드백",
      "anti_examples": ["미적지근", "휙 지나감"]
    }
  ],
  "supported_genres_check": {
    "two_d": true,
    "deterministic_input": true,
    "session_under_5min": true
  }
}
```

### milestones.json (gmk 갱신)

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
        kind: 'bot' | 'self-test',  // ★ 'human' → 'self-test' (외부 사람 제거)
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
      // ★ Optuna Study/Trial 추적
      trials: [{
        trial_id, started_at, config, result: { metrics, verdict, pruned, pruned_reason, finished_at }
      }]
    },
    prototype: string,
    shape: 'grid' | 'continuous' | 'dialogue' | 'shader',
    created_at: string,

    // ★ 직군별 일감 (kanban.md 백킹)
    tasks: [{
      id: string,
      discipline: 'design' | 'code' | 'art' | 'audio' | 'ux' | 'qa',
      title: string,
      status: 'backlog' | 'in-progress' | 'review' | 'done' | 'blocked',
      blocked_by?: string[],  // 다른 task id
      assignee?: string,
      created_at, updated_at, completed_at?
    }],

    validation?: { /* 기존 + persona별 metric */ },
    validation_history?: [...],
    self_test?: {  // ★ human_feedback → self_test (외부 사람 제거)
      sessions: [{
        date: string,
        duration_min: number,
        notes_path: string,        // self-tests/<m>/session-{date}.md
        suspicious_seeds_reviewed: number[],
        verdict: 'PASS' | 'FAIL' | 'NEEDS_MORE_PLAY'
      }],
      coded_themes: [...],
      latest_verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE'
    },

    // ★ 머지 게이트
    merge_gate?: {
      ran_at: string,
      regression_ok: boolean,
      asset_conflicts: [{ path: string, milestones: [string] }],
      secrets_detected: [{ file, line, type }],
      verdict: 'PASS' | 'FAIL',
      warnings: string[]
    },

    // ★ 포팅 재검증
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

### roadmap.md (gmk 자동 갱신 + 사용자 편집 가능)

```markdown
# Roadmap — ZooMerge

## Vision (from pillars.json)
- tactile-satisfaction: 모든 상호작용에 chunky한 피드백
- discovery-joy: 다음 머지가 궁금함

## Milestones

| ID | Name | Pillars | Hypothesis (IF) | Status | Verdict |
|---|---|---|---|---|---|
| m1-merge-feel | 머지 손맛 | tactile | hit-stop 80ms + shake | ✅ Done | PASS |
| m2-dragon-evo | 드래곤 진화 곡선 | discovery | 5분당 새 종 | 🚧 In progress | — |
| m3-egg-spawn | 알 스폰 시스템 | discovery | 머지 5회당 알 | 📋 Planned | — |

## Dependencies
- m2 → m1 (PASS)
- m3 → m2

## Next recommendation
- m2 in progress (3 tasks done / 7 total). 봇 검증까지 1주 예상.
- 'gmk-prototype m2-dragon-evo' 또는 'gmk-status' 호출하세요.
```

### dashboard.md (매번 덮어쓰기)

```markdown
# Dashboard — 2026-05-12 17:30

## Active milestone: m2-dragon-evo

| 직군 | 일감 | 상태 | 막힘? |
|---|---|---|---|
| design | 진화 트리 spec | ✅ Done | — |
| code | 진화 애니메이션 | 🚧 In progress | — |
| art | 드래곤 5종 시안 | 🚧 In progress | — |
| audio | 진화 SFX | 🚫 Blocked | art 시안 대기 (3일째) |
| ux | (없음) | — | — |
| qa | (없음) | — | — |

## 막힘 알림
- audio가 art 시안 대기 중 (3일째) → **art 우선순위 ↑**

## 검증 상태
- 마지막 봇 검증: 없음
- 마지막 self-test: 없음 (self-test 권장 — suspicious-run 20판이 대기 중)

## 다음 추천 액션 (1개만)
- art 시안 받아서 audio 풀리게 하기

## Pillar 적합도
- 이 마일스톤이 강화하는 Pillar: discovery-joy ✓
- 이 마일스톤이 약화하는 Pillar: 없음
```

---

## 6. Wave별 구현 상세

### Wave A — 공통/축 인프라 + 방법론 룰북

**그룹 A 공통/축 (6)**:
- `skills/gmk-init/SKILL.md` UPDATE — vision.md 출력, supported_genres_check
- `skills/gmk-roadmap/SKILL.md` NEW — 마일스톤 분해, 우선순위, 의존성, roadmap.md
- `skills/gmk-brainstorm/SKILL.md` NEW — 옵트인 5단계
- `skills/gmk-task-split/SKILL.md` NEW — 마일스톤→직군별 일감 분해→kanban.md
- `skills/gmk-status/SKILL.md` MAJOR UPDATE — dashboard.md, 칸반, 막힘 감지
- `skills/gmk-loop/SKILL.md` NEW — 단순 디스패처

**그룹 B 방법론 (6)** ★:
- `skills/gmk-prototype-rules/SKILL.md` NEW — 300줄 가드 룰북, hook API spec
- `skills/gmk-shape-advisor/SKILL.md` NEW — hypothesis→shape 선택
- `skills/gmk-portability-check/SKILL.md` NEW — 포팅 위험도 카탈로그
- `skills/gmk-mechanic-merge/SKILL.md` NEW — 메커닉 통합 spec
- `skills/gmk-kill-milestone/SKILL.md` NEW — 폐기 트리거
- `skills/gmk-mock-inject/SKILL.md` NEW — 자산 placeholder 의존 주입

**데이터**:
- milestones.json에 `tasks[]` 필드 추가
- `_workspace/milestones/<id>/kanban.md` 형식 정립

### Wave B — 직군 스킬 (10) + 검증축 강화

**그룹 C 직군별 (10)**:
- `skills/gmk-design-system/SKILL.md` NEW — 시스템·상태머신·데이터 모델 spec
- `skills/gmk-content-plan/SKILL.md` NEW — 컨텐츠 분량·진행 곡선
- `skills/gmk-prototype/SKILL.md` UPDATE — Hypothesis schema 강제, --type=shader 분기
- `skills/gmk-refactor-check/SKILL.md` NEW — 테크부채·복잡도
- `skills/gmk-art-spec/SKILL.md` NEW — 자산 명세·일관성 가드
- `skills/gmk-art-gen/SKILL.md` NEW — `/art` wrapper
- `skills/gmk-sound-plan/SKILL.md` NEW — SFX/BGM 명세
- `skills/gmk-ux-flow/SKILL.md` NEW — 메뉴·FTUE·입력
- `skills/gmk-narrative/SKILL.md` NEW — 분기 트리·톤 (선택)
- `skills/gmk-save-migrate/SKILL.md` NEW — 세이브 호환성

**그룹 D 검증·통합 (5)**:
- `templates/_bot_hook_lib.js` UPDATE — 옵셔널 콜백 (stateSignature/riskEstimate/progressEstimate/noveltyScore)
- `skills/gmk-validate/SKILL.md` UPDATE — 페르소나 4종, 메트릭 7, suspicious-run, Trial pruning
- `skills/gmk-self-test/SKILL.md` RENAMED — 본인 플레이 노트 + suspicious-run 우선순위
- `skills/gmk-regression/SKILL.md` NEW — 마일스톤 누적 회귀
- `skills/gmk-platform-check/SKILL.md` NEW — 플랫폼 호환성 빠른 점검

**Procedural Personas** (hand-tuned, 진화 학습 없음):
- Runner: `0.8·progress + 0.2·score`
- Treasure hunter: `0.1·progress + 0.9·score`
- Survivor: `0.5·progress + 0.5·(1/risk)` (riskEstimate 콜백 있을 때만)
- Explorer: `0.3·score + 0.7·novelty` (noveltyScore 콜백 있을 때만)

`--policy persona-mix` = 200판을 페르소나 4종 × 50판으로 분할.

**Suspicious-run 자동 추출** (active learning):
- entropy 하위 10% (한 가지 행동만)
- entropy 상위 10% (너무 흩어짐)
- duration 양끝 5%
- crashed/stuck 전부
- 총 ~20판을 `validations/<m>/suspicious/`에 저장. /gmk-self-test가 사용자 본인에게 우선순위 순으로 노출 (entropy outlier 5개 + crashed 5개 + duration 양끝 5개 등).

**Trial pruning**:
- early_fail 룰로 망한 시도 평균 30판에 컷 (200판 → 30판 절약)

### Wave C — 통합 게이트 + 포팅

- `skills/gmk-merge-gate/SKILL.md` NEW — 회귀 + 자산 충돌 + secret 스캔
- `skills/gmk-port/SKILL.md` UPDATE — 5단계 재검증

**머지 게이트 검사**:
1. 회귀 테스트 — Playwright로 기존 마일스톤 봇 재실행, PASS 마일스톤 중 verdict가 바뀐 게 있는지
2. 자산 충돌 — 두 마일스톤이 같은 파일 경로(prototypes/*.html 외) 수정 검출
3. Secret 스캔 — gitleaks CLI 호출 (.env, API key, token 패턴)

**포팅 재검증 5단계**:
1. Generate: systems-designer가 HTML→GDScript/C# 변환
2. Compile: godot --headless --check-only (or Unity 빌드 체크) → fail 시 1회 retry → "수동 수정 필요"
3. Smoke-run: --headless 실행 + 표준 hook 호출 5판 → crash 시 1회 retry
4. **Metric diff**: HTML 봇 200판 vs Engine 봇 200판 — clear_rate / dominant_strategy / action_entropy 비교, 임계 초과 시 경고
5. **사람 RE-PASS**: 사용자가 엔진에서 실제 플레이 + verdict 입력 (RE_PASS / RE_FAIL / NEEDS_TUNING)

### Wave D — 정리·에이전트·메타

**파일 제거**:
- `skills/gmk-share/` 디렉토리 통째로 삭제
- CHANGELOG.md에 "gmk-share removed — external sharing is out of scope for development completion"

**에이전트 + 셰이더 템플릿**:
- `agents/systems-designer.md` `agents/feel-engineer.md` `agents/economy-balancer.md` `agents/playtest-analyst.md`
- `templates/prototype-shader.html` (vanilla WebGL2)

**메타**:
- `.claude-plugin/plugin.json` v0.2.0
- `.claude-plugin/marketplace.json` v0.2.0
- `README.md` NEW — 개발 완료 포커스 명시, 4축 그림, 경쟁구도 비교(18.2k Game-Studios와의 차이), 학계 정직성, 지원 장르

**CONCEPT.md 재작성**:
- 첫 문단: "재미 검증" → "재미 falsification"
- §1: 지원 장르 명시 (2D · 결정론적 · 5분 이하)
- §1 신규: gmk 끝점 = "개발 완료" 선언, 출시·라이브옵스 명시적 제외
- §4: 스킬표 갱신 (10개)
- §6 봇 검증: 페르소나 + state coverage + suspicious-run + Trial pruning
- §7 포팅: 5단계 재검증 게이트
- §8 가드: 봇 다양성 강제, Hypothesis schema 강제
- §13 NEW: 4축 구조 (시간·직군·검증·통합)
- §14 NEW: 경쟁구도와 차별화 (Game-Studios·godogen·Rosebud 비교)
- §15 NEW: 학계 한계와 정직성

---

## 7. 외부 의존 명세 (사용자 인지 부담 측정)

| 단계 | 필요한 외부 | 사용자 셋업 |
|---|---|---|
| gmk-init | 없음 | — |
| gmk-roadmap | 없음 | — |
| gmk-prototype | 없음 | — |
| gmk-validate | **Playwright** (npm i -D playwright + chromium 설치) | 1회, gmk가 안내 |
| gmk-status | 없음 | — |
| gmk-feedback | 없음 (텍스트 붙여넣기) | — |
| gmk-merge-gate | **gitleaks** CLI (또는 trufflehog) | 1회, 선택 |
| gmk-port | **Godot CLI** (사용자가 어차피 갖고 있음) | 이미 있음 |
| gmk-brainstorm | 없음 | — |
| gmk-loop | 없음 | — |

**총 외부 셋업**: Playwright(필수) + gitleaks(선택) + Godot/Unity(어차피 있음). **계정·키 0개**.

---

## 8. 경쟁구도 명시

### vs Claude-Code-Game-Studios (18.2k★)

| 차원 | gmk v0.2 | CC-Game-Studios |
|---|---|---|
| Claude Code 플러그인 | ✅ | ✅ |
| 마일스톤 워크플로우 | ✅ | ✅ (72 스킬) |
| **Pillar JSON schema 강제** | ✅ | ❌ |
| **Hypothesis JSON schema 강제** | ✅ | ❌ |
| **HTML 단일파일 프로토타입** | ✅ | ❌ |
| **Playwright 봇 자가플레이** | ✅ | ❌ (체크리스트만) |
| **Procedural Personas 4종** | ✅ | ❌ |
| **객관/주관 검증 분리** | ✅ | ❌ |
| **HTML→엔진 포팅 자동화** | ✅ | ❌ |
| **포팅 후 재검증** | ✅ | ❌ |
| **머지 게이트 (자산 충돌+secret)** | ✅ | ❌ |
| **폐기 가능 워크플로우** | ✅ | ❌ |
| **개발 완료 끝점 명확** | ✅ | ❌ (확산형) |
| 스킬 수 | 10 | 72 |
| 별 | 0 | 18.2k |

→ **작고 날카로움 + 4축 다 커버** = 비교 우위

### vs godogen (3.2k★)

godogen: 엔진 직출 + 스크린샷 self-repair. **gmk: HTML 단계 검증 + 포팅 시 재검증** — 역할 분리.

### vs Rosebud / Astrocade (소비자 시장)

소비자 시장 진입 금지. ICP = **"Claude Code 쓰는 기존 엔진 사용자의 위험 회피"**

---

## 9. 의도적으로 안 하는 것 (Not Doing)

- **출시·라이브옵스·소셜 자동화** — gmk 끝점 밖
- **외부 사람 피드백** — 자동 수집은 물론이고 *수동 텍스트 입력*도 안 받음. 사용자 본인 self-test만
- **양방향 외부 sync** (Notion↔gmk) — 함정 큼
- **L4 완전 흡수** (자체 칸반 UI 등) — 외부 도구가 잘함
- **스킬 수 늘리기로 경쟁** — 10개 유지, 깊이로 승부
- **3D, 멀티플레이어, RPG 지원** — Phase 3
- **소비자 vibe-coding 시장** — 진입 금지
- **gmk-share** — v0.2에서 제거
- **gmk-loop LangGraph 고도화** — v0.4
- **셰이더 visual diff validate** — v0.3 (hook 노출까지만)
- **GVGAI forward model** — v0.3

---

## 10. 구현 순서 (Wave 단위)

### Wave A — 공통/축 + 방법론 (12)
1. milestones.json schema 확장 (`tasks[]`, hypothesis 강화)
2. `_workspace/` 디렉토리 구조 + 파일 형식 명세
3. gmk-init UPDATE / gmk-roadmap NEW / gmk-brainstorm NEW / gmk-task-split NEW
4. gmk-status MAJOR UPDATE / gmk-loop NEW
5. **방법론 6개** — gmk-prototype-rules / gmk-shape-advisor / gmk-portability-check / gmk-mechanic-merge / gmk-kill-milestone / gmk-mock-inject

### Wave B — 직군 (10) + 검증축 (4)
6. 그룹 C 직군 10개 NEW + gmk-prototype UPDATE
7. _bot_hook_lib.js UPDATE
8. gmk-validate UPDATE / gmk-self-test 리네임 / gmk-regression NEW / gmk-platform-check NEW

### Wave C — 통합 (2)
9. gmk-merge-gate NEW
10. gmk-port UPDATE (5단계 재검증)

### Wave D — 정리 + 에이전트 + 메타
11. gmk-share 제거
12. agents/ 4개
13. templates/prototype-shader.html NEW
14. plugin.json/marketplace.json v0.2.0
15. README NEW
16. CONCEPT.md 재작성

각 Wave 후 git commit.

---

## 11. 검증 체크리스트 (커밋 전)

- [ ] CONCEPT.md — "재미 falsification" + 지원 장르 + 4축 + 경쟁구도 + 학계 정직
- [ ] hypothesis schema — measured_by 강화, trials[], early_fail
- [ ] milestones.json — tasks[], merge_gate, ported_to.re_validation
- [ ] _bot_hook_lib.js — 옵셔널 콜백
- [ ] gmk-validate — 페르소나 4종, 메트릭 7, suspicious-run, pruning, 톤 8규칙
- [ ] gmk-prototype — Hypothesis 가드 강화, 모호 metric 거부
- [ ] gmk-port — 5단계 재검증
- [ ] gmk-merge-gate — 회귀+자산 충돌+secret 스캔
- [ ] gmk-roadmap — 마일스톤 분해, 의존성 그래프
- [ ] gmk-status — dashboard.md, 칸반, 막힘 감지
- [ ] gmk-self-test (gmk-feedback 리네임) — 외부 사람 개념 완전 제거, 본인 플레이 노트 + suspicious-run 우선순위
- [ ] gmk-share 제거 (CHANGELOG 명시)
- [ ] agents/ 4개 — Anthropic 4요소 + MAST 대응
- [ ] gmk-loop — max-iteration=1, 디스패처
- [ ] gmk-brainstorm — 옵트인 5단계
- [ ] plugin.json + marketplace.json — v0.2.0
- [ ] README — 개발 완료 끝점 + 4축 + 경쟁구도
- [ ] _workspace/ 파일 형식 — vision/roadmap/dashboard/kanban 모두 작성 명세
