import type { AgentDefinition } from "@shared/types";

/**
 * 추천 에이전트 정의
 * category: "core" = 필수 (비활성화 불가), "recommended" = AI가 추천, "optional" = 있으면 좋은 것
 */
export interface CatalogAgent extends AgentDefinition {
  category: "core" | "recommended" | "optional";
  reason: string; // 사용자에게 왜 필요한지 설명
  matchTags: string[]; // 프로젝트 특성과 매칭할 태그
}

// ── 핵심 4에이전트 (모든 프로젝트 공통, 항상 활성) ──
const CORE_AGENTS: CatalogAgent[] = [
  {
    id: "director", displayName: "Director", icon: "🎬",
    role: "프로젝트 디렉터 + PM", goal: "프로젝트 방향 구체화, 작업 분배, 일정 관리",
    constraints: ["코드 작성 금지", "사용자 의도를 기술적 방향으로 번역"],
    model: "opus", trigger: "manual",
    guidelines: ["모든 요청을 분석하고 적절한 에이전트에게 배정", "일정과 우선순위 관리"],
    outputFormat: "",
    category: "core", reason: "모든 요청의 진입점. 방향을 결정하고 작업을 총괄합니다.",
    matchTags: [],
  },
  {
    id: "planner", displayName: "Planner", icon: "🔧",
    role: "기술 설계자", goal: "스펙을 기능 단위로 분해",
    constraints: ["코드 직접 작성 금지", "기능당 명확한 완료 기준 필수"],
    model: "opus", trigger: "manual",
    guidelines: ["MVP 최소 기능만 포함", "의존성 순서 고려"],
    outputFormat: "",
    category: "core", reason: "프로젝트를 실행 가능한 기능 단위로 나눕니다.",
    matchTags: [],
  },
  {
    id: "generator", displayName: "Generator", icon: "💻",
    role: "개발자", goal: "기능별 코드 구현",
    constraints: ["한 번에 하나의 기능만", "빌드 통과 유지"],
    model: "sonnet", trigger: "after_planner",
    guidelines: ["기존 코드 스타일 준수"],
    outputFormat: "",
    category: "core", reason: "실제 코드를 작성하는 핵심 에이전트입니다.",
    matchTags: [],
  },
  {
    id: "evaluator", displayName: "Evaluator", icon: "🔍",
    role: "QA 엔지니어", goal: "구현 품질 검증 + 통과/반려",
    constraints: ["코드 수정 금지", "객관적 기준만 적용"],
    model: "opus", trigger: "after_generator",
    guidelines: ["빌드 통과 확인", "핵심 기능 작동 확인"],
    outputFormat: "",
    category: "core", reason: "코드 품질을 검증하고 문제가 있으면 재작업을 요청합니다.",
    matchTags: [],
  },
];

// ── 게임 프로젝트 특화 에이전트 ──
const GAME_AGENTS: CatalogAgent[] = [
  {
    id: "balance-tester", displayName: "Balance Tester", icon: "⚖️",
    role: "게임 밸런스 전문가", goal: "난이도 곡선, 보상 체계, 수치 밸런스 검증",
    constraints: ["코드 수정 금지", "구체적 수치 기반 피드백만"],
    model: "sonnet", trigger: "after_generator",
    guidelines: ["난이도 곡선이 점진적인지 확인", "보상/처벌 비율 체크", "첫 플레이어도 클리어 가능한지"],
    outputFormat: "",
    category: "recommended", reason: "게임이 너무 쉽거나 어렵지 않게 밸런스를 잡아줍니다.",
    matchTags: ["rpg", "combat_grow", "survive", "hardcore", "medium"],
  },
  {
    id: "ux-reviewer", displayName: "UX Reviewer", icon: "🎯",
    role: "사용자 경험 검토자", goal: "직관적인 UI/UX 확인",
    constraints: ["주관적 판단 최소화"],
    model: "sonnet", trigger: "after_generator",
    guidelines: ["첫 사용자 관점에서 검토", "조작법 안내가 충분한지", "피드백이 즉각적인지"],
    outputFormat: "",
    category: "recommended", reason: "플레이어가 헤매지 않게 사용성을 확인합니다.",
    matchTags: ["controls_feel", "casual", "touch"],
  },
  {
    id: "story-writer", displayName: "Story Writer", icon: "📖",
    role: "스토리/대사 작가", goal: "대사, 이벤트, 세계관 텍스트 작성",
    constraints: ["게임 톤에 맞는 문체 유지"],
    model: "sonnet", trigger: "after_planner",
    guidelines: ["짧고 임팩트 있는 대사", "캐릭터별 말투 구분"],
    outputFormat: "",
    category: "recommended", reason: "게임 스토리와 대사를 작성합니다.",
    matchTags: ["rpg", "story_mood"],
  },
  {
    id: "pixel-artist", displayName: "Asset Planner", icon: "🎨",
    role: "에셋 구조 설계자", goal: "스프라이트, 타일맵, UI 에셋 구조 정리",
    constraints: ["실제 그래픽 제작은 불가"],
    model: "haiku", trigger: "after_planner",
    guidelines: ["에셋 네이밍 컨벤션 통일", "스프라이트 시트 구조 정의"],
    outputFormat: "",
    category: "optional", reason: "에셋 파일 구조를 체계적으로 관리합니다.",
    matchTags: ["pixel", "cartoon", "visuals"],
  },
  {
    id: "perf-checker", displayName: "Performance Checker", icon: "⚡",
    role: "성능 최적화 검토자", goal: "FPS, 메모리 사용량, 렌더링 효율 확인",
    constraints: ["코드 수정 금지", "측정 가능한 지표만"],
    model: "haiku", trigger: "after_generator",
    guidelines: ["requestAnimationFrame 사용 확인", "불필요한 리렌더링 체크"],
    outputFormat: "",
    category: "optional", reason: "게임이 부드럽게 돌아가는지 확인합니다.",
    matchTags: ["hardcore", "pixel", "shooting"],
  },
  {
    id: "sound-designer", displayName: "Sound Planner", icon: "🔊",
    role: "사운드 구조 설계자", goal: "효과음/배경음 구조 정의",
    constraints: ["실제 사운드 제작은 불가"],
    model: "haiku", trigger: "after_planner",
    guidelines: ["이벤트별 사운드 매핑", "볼륨 밸런스 가이드"],
    outputFormat: "",
    category: "optional", reason: "사운드 시스템의 구조를 설계합니다.",
    matchTags: ["sound", "story_mood", "addictive_loop"],
  },
];

// ── 웹앱 프로젝트 특화 에이전트 ──
const WEBAPP_AGENTS: CatalogAgent[] = [
  {
    id: "api-designer", displayName: "API Designer", icon: "🔗",
    role: "API 설계자", goal: "RESTful API 엔드포인트 설계 + 데이터 모델",
    constraints: ["구현 전 설계 문서 우선"],
    model: "sonnet", trigger: "after_planner",
    guidelines: ["RESTful 네이밍 컨벤션", "에러 응답 표준화", "버전 관리 전략"],
    outputFormat: "",
    category: "recommended", reason: "체계적인 API 구조를 설계합니다.",
    matchTags: ["dashboard", "saas", "ecommerce", "social"],
  },
  {
    id: "auth-specialist", displayName: "Auth Specialist", icon: "🔐",
    role: "인증/보안 전문가", goal: "로그인, 권한 관리, 보안 검토",
    constraints: ["보안 베스트 프랙티스 준수"],
    model: "sonnet", trigger: "after_planner",
    guidelines: ["JWT 토큰 관리", "CSRF/XSS 방어", "비밀번호 해싱"],
    outputFormat: "",
    category: "recommended", reason: "안전한 인증 시스템을 구축합니다.",
    matchTags: ["saas", "social", "ecommerce", "dashboard"],
  },
  {
    id: "a11y-checker", displayName: "Accessibility Checker", icon: "♿",
    role: "접근성 검토자", goal: "WCAG 기준 접근성 확인",
    constraints: ["자동 검사 도구 결과 기반"],
    model: "haiku", trigger: "after_generator",
    guidelines: ["키보드 네비게이션 가능 여부", "스크린리더 호환성", "색상 대비율"],
    outputFormat: "",
    category: "optional", reason: "모든 사용자가 접근 가능한지 확인합니다.",
    matchTags: ["saas", "dashboard", "social"],
  },
  {
    id: "responsive-checker", displayName: "Responsive Checker", icon: "📱",
    role: "반응형 디자인 검토자", goal: "다양한 화면 크기 대응 확인",
    constraints: ["코드 수정 금지"],
    model: "haiku", trigger: "after_generator",
    guidelines: ["모바일 320px ~ 데스크톱 1920px", "터치 영역 최소 크기"],
    outputFormat: "",
    category: "optional", reason: "모바일부터 데스크톱까지 잘 보이는지 확인합니다.",
    matchTags: ["ecommerce", "social", "saas"],
  },
  {
    id: "db-architect", displayName: "DB Architect", icon: "🗃️",
    role: "데이터베이스 설계자", goal: "스키마 설계, 인덱스 전략, 쿼리 최적화",
    constraints: ["정규화/비정규화 트레이드오프 명시"],
    model: "sonnet", trigger: "after_planner",
    guidelines: ["ERD 다이어그램 우선", "마이그레이션 전략"],
    outputFormat: "",
    category: "optional", reason: "데이터 구조를 효율적으로 설계합니다.",
    matchTags: ["saas", "ecommerce", "social"],
  },
];

/**
 * 프로젝트 유형 + 사용자 선택 기반으로 추천 에이전트 생성
 */
export function getRecommendedAgents(
  presetId: string,
  specCard: { coreDecisions: { key: string; value: string }[]; expansions: { id: string; enabled: boolean }[] },
): CatalogAgent[] {
  // 사용자 선택에서 태그 추출
  const userTags = new Set<string>();

  // Discovery 답변에서 태그 추출 (value를 태그로)
  for (const decision of specCard.coreDecisions) {
    userTags.add(decision.value.toLowerCase());
  }

  // 활성화된 확장에서 태그 추출
  for (const exp of specCard.expansions) {
    if (exp.enabled) userTags.add(exp.id);
  }

  // 프리셋별 특화 에이전트 선택
  const specializedAgents = presetId === "game" ? GAME_AGENTS : WEBAPP_AGENTS;

  // 매칭 점수 계산
  const scored = specializedAgents.map((agent) => {
    const matchCount = agent.matchTags.filter((tag) => {
      // 태그가 userTags에 포함되거나, userTags의 어떤 값에 부분 일치하는지
      if (userTags.has(tag)) return true;
      for (const userTag of userTags) {
        if (userTag.includes(tag) || tag.includes(userTag)) return true;
      }
      return false;
    }).length;

    return { agent, score: matchCount };
  });

  // 점수순 정렬
  scored.sort((a, b) => b.score - a.score);

  // Core는 항상 포함
  const result: CatalogAgent[] = [...CORE_AGENTS];

  // 매칭 점수 > 0인 에이전트를 recommended로 추가
  for (const { agent, score } of scored) {
    if (score > 0) {
      result.push({ ...agent, category: "recommended" });
    } else {
      result.push({ ...agent, category: "optional" });
    }
  }

  return result;
}
