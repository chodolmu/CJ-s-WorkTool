# gamemaker-kit — 리서치 요약

이 플러그인의 모든 설계 결정 근거. 6라운드 리서치(2026-05-08).

---

## 6라운드 리서치 합의점 (10가지)

| # | 발견 | 근거 라운드 |
|---|------|-----------|
| 1 | MCP 에디터 자동화 > 코드 보조 (주당 4-6h 절감) | 1 |
| 2 | 검증 루프 부재가 #1 병목 | 1, 2, 3, 4 |
| 3 | 49 에이전트는 함정. 2-tier > 3-tier | 3 (MAST 41-86.7% 실패율) |
| 4 | 단일파일 폭주가 가장 흔한 죽음 (1,400라인+) | 1, 2 |
| 5 | AI는 "재미"·게임필을 못 잡음 | 1, 4 (IEEE Spectrum, HN 컨센서스) |
| 6 | 엔진 API 환각이 구조적 (Godogen 4번 재작성) | 2, 3 |
| 7 | 세션 stateless = 돈 누수 (multi-agent 7배 토큰) | 2 |
| 8 | 인디 진짜 통증 = "30개 도구 사이의 접착제 부재" | 5 |
| 9 | Suno/Udio 라이선스 함정. AI Slop이 Steam 알고리즘에 진입 | 1, 5 |
| 10 | Design Pillars + Hypothesis-Driven은 검증 친화적 | 4 |

---

## 결정 근거 매핑

### 결정 1: HTML 프로토타입 우선
- **지지**: #4 (단일파일 폭주는 마일스톤 단위 격리로 막힘), #6 (HTML/JS 환각이 가장 적음 — LLM 학습 데이터 1위), #2 (Playwright MCP가 즉시 검증 루프 닫음 — Godot용으로 새로 짤 필요 없음).
- **반대 가능성**: 3D/액션 플랫포머는 게임필이 핵심이라 웹 검증의 의미가 약함.
- **완화**: 장르 적합도 매트릭스 (1번 리서치) — 카드/머지/퍼즐/덱빌더/시뮬은 ✅. ZooMerge·ProjectFS·Puzzle 다 이 카테고리.

### 결정 2: 마일스톤 = 폐기 가능 단위
- **지지**: #4 (1,400라인 회복 불가 → 통째로 버리는 게 정답), #5 (AI가 재미를 못 잡으니 "버릴 수 있게" 만들어야), #10 (Hypothesis-Driven은 반증 가능해야 함 = 가설 실패 시 폐기).
- **선례**: Sam Liberty Medium, Modes of Play의 "If X then Y measured by Z".

### 결정 3: 봇/사람 이중 검증 게이트
- **지지**: #5 + 4번 리서치의 "AI 봇으로 객관적, 사람으로 주관적" 컨센서스. modl.ai/Antithesis 모두 같은 결론.
- **봇이 잡는 것**: 크래시, dominant strategy, 클리어 가능성, 평균 세션 길이, 승률 분포.
- **사람이 잡는 것**: 재미, 감정 호, 사회적 다이내믹스, "느낌".

### 결정 4: 엔진은 Godot+Unity 동시 (단, MVP는 Godot만)
- **사용자 답변**: "Godot+Unity 동시" 선택.
- **위험 (3번 리서치)**: Godogen이 Godot 하나만으로도 4번 재작성. Unity-MCP는 GitHub 이슈 가득.
- **완화 — MVP는 Godot 포팅만**: Unity 어댑터는 인터페이스만 설계, 구현은 Phase 2. 사용자도 ZooMerge·ProjectFS·Puzzle 다 Godot이라 자연스럽게 정렬.

### 결정 5: 7개 스킬 + 2-tier
- **근거**: #3 (MAST). 2-tier (Planner+Executor) > 3-tier. 10개 이하 안전.
- **Tier**: opus = 포팅 판단 (가장 정교). sonnet = 실행. haiku = 단순 작업 (배포, status).

### 결정 6: 봇은 random + MCTS, ML 없음
- **근거 (4번 리서치)**: ML-Agents 셋업 비용 큼. 휴리스틱 봇이 dominant strategy 검출엔 충분.
- **사용자 답변**: "레코드 + 휴리스틱 봇" 선택.

### 결정 7: 본 프로젝트는 검증 통과한 것만 받음
- **사용자 답변**: "별도 폴더(prototypes/) 격리".
- **근거**: #4 + 인디 워크플로우 회고 (1번 리서치 GDC 2026 포스트모템) — "AI 다이얼로그는 출시 시 전면 삭제"한 패턴과 같은 철학. 검증 안 된 것은 본 프로젝트 진입 금지.

### 결정 8: 포팅 스킬 MVP 포함
- **사용자 답변**: "MVP에 포팅 스킬도 포함".
- **근거**: 핵심 명제("HTML → 검증 → 포팅")를 빼면 그냥 "HTML 게임 빌더"가 됨. 차별점 사라짐.
- **완화**: 포팅은 자동 변환 + "엔진별 게임필 차이" 체크리스트 출력 (자동 ≠ 완벽).

---

## 라운드별 핵심 발견

### Round 1 — 외부 도구 풍경
- **6가지 워크플로우 타입**: Vibe Solo / Spec+MCP / AI-First→Human Polish / Runtime AI / Sim-Backed Balance / Multi-Agent Studio
- **장르 적합도 매트릭스** 명확
- **Claude Swarm Mode 2026 초 출시** (Sonnet 5)
- **AI Slop 백래시가 검색 알고리즘 레벨로 진입** — Steam Next Fest 10% AI 명시

### Round 2 — 인디 고통점 (인용 기반)
- y1uda: 수동 build-test-fix 루프
- Kevin London: 20번 재시도 / 유령 UI / God object 양산
- Spritesheets: 프레임 간 일관성 붕괴
- Anthropic: multi-agent 7배 토큰
- 한 개발자 비교: 동일 워크로드 API $15k vs Max $800
- **3가지 큰 해결 후보**: 자동 build-test-fix 루프, 엔진 API ground truth, 세션 영속 컨텍스트 + 토큰 가드

### Round 3 — 멀티 에이전트 실험
- MAST: 41-86.7% 실패율
- "Bag of agents" 17배 에러 증폭 (Towards Data Science)
- **2-tier (Planner + Executor) 수렴**
- Generator-validator inconsistency (COLM 2025): 검증자 ≠ 생성자
- OpenGame: 단일 fine-tuned 27B + tool calls가 multi-agent보다 잘됨

### Round 4 — 재미 검증 방법론
- Design Pillars 업계 표준
- Hypothesis-Driven Design: "If X then Y measured by Z"
- 측정 가능 메트릭 카탈로그 (input-to-photon latency, jank, hit-stop, PaceMaker arXiv 2408.15001)
- 첫 10개 텔레메트리 이벤트 디폴트 스택
- 봇은 객관적, 사람은 주관적 — 컨센서스
- **3가지 채택 패턴**: Pillar-Bound Milestone / Telemetry Spec Card / 이중 게이트

### Round 5 — 비코드 파이프라인
- ComfyUI MCP 이미 성숙 (artokun, Comfy Pilot, Comfy Cozy)
- Suno/Udio 라이선스 함정 — Udio는 사실상 죽음 (2025-10 UMG 합의)
- ElevenLabs SFX v2 = SFX 표준
- PixelLab Aseprite 플러그인 = 픽셀아트 인디 1순위
- 런타임 LLM NPC = 데모용 (출시작 거의 없음)
- **결정적**: "30개 도구 사이의 접착제 부재" = 인디 진짜 통증

---

## 사용자 결정 요약

| 질문 | 답변 |
|---|---|
| 엔진 타겟 | 엔진 무관 (범용) |
| TaskForge Pro와 관계 | 완전 별도 플러그인 |
| MVP 코어 | 엔진 검증 루프 (godogen-style) |
| 타겟 사용자 | AI 익숙한 인디 개발자 |
| 엔진 우선순위 | Godot+Unity 동시 (MVP는 Godot 우선) |
| 프로토타입 분리 | 별도 폴더 (prototypes/) 격리 |
| 봇 검증 수준 | 레코드 + 휴리스틱 봇 |
| 포팅 스킬 | MVP에 포함 |
| 이름 | gamemaker-kit |

---

## 외부 소스 (라운드별 통합)

### 도구
- Donchitos/Claude-Code-Game-Studios (49 agents)
- htdt/godogen
- CoplayDev/unity-mcp
- Coding-Solo/godot-mcp
- Randroids-Dojo/Godot-Claude-Skills
- artokun/comfyui-mcp
- ConstantineB6/Comfy-Pilot
- Inworld AI / Charisma.ai / Convai
- Rosebud AI / Ludo.ai
- modl.ai / Regression.gg
- Suno / Udio / AIVA / ElevenLabs
- PixelLab / Scenario.gg / Layer.ai
- Ink (inkle) / Yarn Spinner
- Magic Hour / Mootion

### 학술
- GameGPT (arXiv 2310.08067)
- OpenGame / GameCoder-27B (arXiv 2604.18394)
- MAST taxonomy (arXiv 2503.13657, NeurIPS 2025)
- PaceMaker (arXiv 2408.15001)
- Volz 2016 — Automatic Game Balancing (arXiv 1603.03795)
- Jaffe 2012 — Restricted Play balance test
- arXiv 2407.11396 — "It might be balanced, but is it actually good?"
- arXiv 2506.04699 — Generative ABM for MMO economy

### 회고/비평
- Kevin London — "I made a game with AI"
- y1uda — Godot MCP postmortem
- Ihor Chyshkala — "Godogen's Four Rewrites"
- ContextKeep — "Tired of Re-Explaining Codebase"
- IEEE Spectrum — "Why AI Models Still Can't Handle Your Favorite Video Games"
- Sam Liberty — "Everything You've Heard About AI in Game Dev Is Wrong"
- StraySpark — "GDC 2026 AI Takeaways"
- ACM CHI PLAY 2024 — "Solo Developer / Ill-Informed Co-Worker"
