# gamemaker-kit

> **Prototype in HTML. Validate the fun. Port to your engine.**
>
> Claude Code 플러그인 — 마일스톤 단위로 폐기 가능한 HTML 프로토타입을 만들고, 봇 자가플레이로 객관적 검증, 사람이 주관적 재미 검증, 통과한 것만 Godot/Unity로 포팅한다.

---

## 0. 한 문단 요약

게임 개발 워크플로우는 코드 개발과 다르다. 검증 기준이 "동작"이 아닌 "재미"이고, 한 마일스톤이 재미없으면 통째로 폐기되어야 한다. 그런데 실제 엔진(Godot 850 클래스, Unity 패키지 지옥)에서 폐기는 비싸다. **gamemaker-kit은 마일스톤마다 단일 HTML 파일로 핵심 메커닉만 구현 → Playwright 봇이 200판 자가플레이 → 사람에게 itch.io 링크 → 재미 가설 통과 시에만 본 엔진 프로젝트로 포팅**하는 워크플로우를 강제한다.

---

## 1. 왜 이게 필요한가 (리서치 합의)

- **단일파일 폭주가 #1 실패 패턴** (1,400라인 넘으면 회복 불가). → 마일스톤 단위 격리된 HTML로 구조적으로 막음.
- **AI는 "재미"를 못 평가한다** (IEEE Spectrum, HN 컨센서스). → 사람 verify를 워크플로우에 강제.
- **검증 루프 부재가 #1 병목** (y1uda·Kevin London·Godogen·MAST 21.3% 모두 같은 곳). → Playwright MCP가 즉시 닫음.
- **엔진 API 환각이 구조적** (Godogen 4번 재작성). → 환각이 가장 적은 HTML/JS에서 메커닉 검증, 엔진은 포팅 단계에만.
- **AI Slop 백래시가 Steam 알고리즘에 진입**. → 사람 게이트가 출시 직전이 아니라 매 마일스톤에 존재.
- **인디 진짜 통증 = "30개 도구 사이의 접착제 부재"**. → kit이 그 접착제.

리서치 6라운드 모든 결론이 이 한 워크플로우로 수렴.

---

## 2. 워크플로우

```
Milestone 정의
   ↓
[/gmk-prototype <name>]
   ├─ prototypes/<name>.html 단일파일 생성 (300줄 가드)
   ├─ Pillar + Hypothesis 헤더 주입
   └─ Playwright 자동 launch
   ↓
[/gmk-validate <name>]
   ├─ 헤드리스 봇 200판 (random + MCTS)
   ├─ clear rate / dominant strategy / crash 검출
   └─ 객관적 게이트 PASS/FAIL 판정
   ↓ PASS
[/gmk-share <name>]
   ├─ GitHub Pages / itch.io 자동 배포
   └─ 친구한테 던질 링크 출력
   ↓
[/gmk-feedback <name>]
   ├─ Discord/itch 코멘트 텍스트 입력 받음
   ├─ thematic coding으로 분류
   └─ 재미 가설 통과/실패 보조 판정
   ↓ 사람이 GO 결정
[/gmk-port <name> --to godot|unity]
   ├─ 검증된 메커닉만 GDScript/C#으로 변환
   ├─ 본 프로젝트(godot/ 또는 unity/)에 통합
   └─ 게임필 차이 체크리스트 출력
```

---

## 3. 디렉토리 구조 (사용자 게임 프로젝트 안)

```
ZooMerge/                         # 사용자 게임 프로젝트
├─ godot/                         # 본 엔진 프로젝트
│   ├─ scenes/
│   ├─ scripts/
│   └─ ...
├─ prototypes/                    # gamemaker-kit이 관리
│   ├─ m1-merge-feel.html         # 마일스톤 1 프로토타입
│   ├─ m1-merge-feel.meta.json    # Pillar/Hypothesis/검증 결과
│   ├─ m2-dragon-evo.html
│   ├─ m2-dragon-evo.meta.json
│   └─ ...
└─ .gamemaker-kit/                # 플러그인 상태
    ├─ pillars.json               # 게임 디자인 pillar (3-5개)
    ├─ milestones.json            # 마일스톤별 hypothesis + 결과
    ├─ feedback/                  # 수집된 사람 피드백
    │   └─ m1-feedback-2026-05-15.md
    └─ port-checklists/           # 포팅 시 게임필 차이 체크리스트
        └─ m2-port-godot.md
```

**핵심 — 본 프로젝트는 검증 통과한 것만 받는다.** 실패한 m1 프로토타입은 `prototypes/`에서 폐기, `godot/`는 깨끗하게 유지.

---

## 4. 스킬 (MVP 스코프)

| 스킬 | 모델 | 역할 |
|---|---|---|
| `/gmk-init` | sonnet | 게임 프로젝트 초기화. Pillar 3-5개 정의. 본 엔진 선택 (godot/unity) |
| `/gmk-prototype <name>` | sonnet | 마일스톤 HTML 프로토타입 생성. Pillar + Hypothesis 강제 |
| `/gmk-validate <name>` | sonnet | Playwright 봇 200판. 객관적 게이트 |
| `/gmk-share <name>` | haiku | itch.io / GitHub Pages 배포 (단순 작업) |
| `/gmk-feedback <name>` | sonnet | 정성 피드백 thematic coding → 가설 판정 보조 |
| `/gmk-port <name>` | opus | HTML 메커닉 → GDScript/C# 변환. 가장 정교한 판단 필요 |
| `/gmk-status` | haiku | 모든 마일스톤 진행/검증 상태 트리 |

**왜 7개냐**: 리서치 3번 (MAST)에서 "10개 이하 + 2-tier"가 안전. 7개 스킬 + 2 모델 tier (sonnet 실행 / opus 포팅 판단).

---

## 5. 마일스톤 schema

`milestones.json` 안에 각 마일스톤은 이렇게 생김:

```json
{
  "id": "m1-merge-feel",
  "name": "머지 손맛",
  "pillars_targeted": ["tactile-satisfaction", "discovery-joy"],
  "hypothesis": {
    "if": "두 드래곤 머지 시 0.3초 hit-stop + screen shake + 파티클",
    "then": "플레이어가 5분 내 머지 자체에 중독된다",
    "measured_by": [
      { "metric": "session_length_avg", "target": "> 4min", "kind": "bot" },
      { "metric": "tester_says_addictive", "target": "true", "kind": "human" }
    ]
  },
  "prototype": "prototypes/m1-merge-feel.html",
  "validation": {
    "bot_runs": 200,
    "bot_result": { "clear_rate": 0.67, "dominant_strategy": null, "crashes": 0 },
    "human_feedback": ".gamemaker-kit/feedback/m1-feedback-2026-05-15.md",
    "verdict": "PASS"
  },
  "ported_to": "godot/scenes/merge_grid.tscn"
}
```

---

## 6. 봇 검증 (Playwright + 휴리스틱)

```javascript
// validate.js (gamemaker-kit이 생성)
const { chromium } = require('playwright');

async function runBot(seed) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`file://${prototypePath}`);

  // window.__gmk_botHook__이 프로토타입에서 노출하는 API
  await page.evaluate((s) => window.__gmk_botHook__.startGame(s), seed);

  // random + MCTS — 게임 종료까지 행동
  while (!(await page.evaluate(() => window.__gmk_botHook__.isOver()))) {
    const actions = await page.evaluate(() => window.__gmk_botHook__.legalActions());
    const choice = mcts(actions);  // 깊이 3 정도
    await page.evaluate((a) => window.__gmk_botHook__.act(a), choice);
  }

  return await page.evaluate(() => window.__gmk_botHook__.summary());
  // { score, duration, build_used, crashed }
}

// 200판 돌려서 집계
```

**프로토타입은 `__gmk_botHook__`를 반드시 노출한다** — `/gmk-prototype`이 생성 시 이 hook을 강제 주입.

---

## 7. 포팅 스킬 (`/gmk-port`)

이게 진짜 까다로움. opus 쓰는 이유.

### 변환 매핑 (예: HTML → Godot)

| HTML/JS | Godot |
|---|---|
| Canvas 2D draw | Node2D + `_draw()` 또는 Sprite2D |
| `setInterval` 게임 루프 | `_process(delta)` |
| `addEventListener('click')` | `InputEventMouseButton` |
| `setTimeout` 애니 | `Tween` |
| 충돌 검사 (수동) | `Area2D` / `CollisionShape2D` |
| 게임 상태 객체 | `class_name GameState extends Resource` |

### 자동 포팅하지 않는 것 (체크리스트로 출력)

- **게임필 수치는 그대로 못 옮긴다**: input latency, hit-stop duration, screen shake — 엔진에서 다시 튜닝 필수
- **물리**: HTML에서 수동 구현했으면 Godot 물리 엔진에 다시 맞춰야 함
- **사운드**: HTML에서 임시 SFX 썼으면 ElevenLabs로 새로 생성 + AudioStreamPlayer로 통합

`port-checklists/m2-port-godot.md`에 체크리스트 자동 생성. 사람이 한 줄씩 확인.

---

## 8. 가드 정책

- **300줄 가드**: 프로토타입 HTML 한 파일 300줄 넘으면 경고. 1,400줄 넘으면 차단.
- **Pillar 정합성 가드**: 마일스톤 hypothesis가 어떤 pillar도 강화하지 않으면 차단.
- **봇 hook 누락 가드**: `__gmk_botHook__` 없으면 `/gmk-validate` 거부.
- **포팅 전 검증 통과 강제**: `validation.verdict !== "PASS"`면 `/gmk-port` 거부.

---

## 9. taskforge-pro / zoodev-loop와의 관계

**병렬 사용**:
- `taskforge-pro` = 코드 마일스톤 PM (프로토타입 자체의 코드 분해는 여기서)
- `gamemaker-kit` = 게임 마일스톤 PM (재미 가설 검증)
- `zoodev-loop` = ZooMerge 전용 자율 루프 (gamemaker-kit이 일반화하면 deprecate 후보)

**의존 안 함**: gamemaker-kit은 단독 동작. taskforge-pro 없어도 됨.

---

## 10. MVP → Phase 2 → Phase 3

### MVP (Phase 1)
- HTML 프로토타입 + Playwright 봇 + Pillar/Hypothesis schema
- itch.io / GitHub Pages 자동 배포
- `/gmk-port` 첫 버전 (Godot만)
- ZooMerge로 dogfood

### Phase 2
- Vision 모델 결합 (godogen-style 시각 결함 검출)
- Unity `/gmk-port` 추가
- 정성 피드백 thematic coding 강화 (자동 태깅)
- ComfyUI MCP 연결 (프로토타입에 임시 아트 자동 생성)

### Phase 3
- ElevenLabs SFX 자동 통합 (포팅 시)
- Ink/Yarn 분기 자동 생성 (내러티브 게임용)
- 커뮤니티 어댑터 (Love2D, GameMaker Studio, Unreal)

---

## 11. 첫 주 구현 우선순위

1. `gamemaker-kit/` 폴더 + 플러그인 메타데이터 (`plugin.json`, `marketplace.json`)
2. `/gmk-init` 스킬 — Pillar 정의 대화
3. `/gmk-prototype` 스킬 — HTML 템플릿 + `__gmk_botHook__` 강제 주입
4. `/gmk-validate` 스킬 — Playwright 봇 러너
5. ZooMerge에 적용 — 첫 마일스톤 1개 끝까지 돌려보기
6. (검증된 후) `/gmk-port` 스킬

---

## 12. 열린 질문 (다음 세션에서 결정)

- **MCTS 깊이/시간 예산** — 200판 돌릴 때 한 판당 얼마나? 게임 길어지면 토큰 비용↑
- **봇 hook API 표준** — `__gmk_botHook__.legalActions()` / `act()` / `summary()` 시그니처를 어디까지 강제?
- **포팅 시 본 엔진 프로젝트와의 충돌** — `/gmk-port`가 만든 코드가 본 프로젝트 컨벤션과 안 맞으면? (taskforge-pro의 conventions.md 참조?)
- **itch.io 자동 배포 인증** — butler CLI? 사용자 토큰 어디 저장?
- **ZooMerge dogfood 시나리오** — 이미 진행 중인 Godot 프로젝트인데, 회고적으로 첫 프로토타입을 만들어볼지 다음 마일스톤부터 적용할지

---

*근거: `_research/research-summary.md` (이 파일과 같은 폴더)*
