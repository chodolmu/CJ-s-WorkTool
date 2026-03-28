import type { PhaseDefinition, ProjectPhase } from "./types";

export const PHASE_DEFINITIONS: PhaseDefinition[] = [
  {
    id: "research",
    label: "Research",
    icon: "🔬",
    description: "기술 스택 조사, 레퍼런스 분석, 아키텍처 탐색",
    gateCondition: "기술 스택이 확정되고, 핵심 리스크가 파악됨",
    checklist: [
      { id: "tech-stack", label: "기술 스택 비교/선정 완료", completed: false },
      { id: "reference", label: "레퍼런스 프로젝트 분석", completed: false },
      { id: "risks", label: "핵심 기술 리스크 파악", completed: false },
      { id: "architecture", label: "기본 아키텍처 방향 결정", completed: false },
    ],
  },
  {
    id: "design",
    label: "Design",
    icon: "📐",
    description: "스펙 상세화, 데이터 모델 설계, API 구조 정의",
    gateCondition: "기능 목록이 확정되고, 데이터 구조가 설계됨",
    checklist: [
      { id: "spec-detail", label: "기능 요구사항 상세화", completed: false },
      { id: "data-model", label: "데이터 모델 / 스키마 설계", completed: false },
      { id: "api-design", label: "API / 인터페이스 설계", completed: false },
      { id: "ui-wireframe", label: "UI 와이어프레임 / 화면 구조", completed: false },
    ],
  },
  {
    id: "prototype",
    label: "Prototype",
    icon: "🧪",
    description: "핵심 기능만 빠르게 구현하여 방향성 검증",
    gateCondition: "핵심 기능이 동작하고, 방향이 검증됨",
    checklist: [
      { id: "core-feature", label: "핵심 기능 1개 동작 확인", completed: false, autoCheck: true },
      { id: "feasibility", label: "기술 실현 가능성 검증", completed: false },
      { id: "user-flow", label: "주요 사용자 플로우 테스트", completed: false },
    ],
  },
  {
    id: "implement",
    label: "Implement",
    icon: "🔨",
    description: "전체 기능 구현 — Planner→Generator→Evaluator 파이프라인",
    gateCondition: "모든 기능이 구현되고, 빌드가 통과함",
    checklist: [
      { id: "all-features", label: "전체 기능 구현 완료", completed: false, autoCheck: true },
      { id: "build-pass", label: "빌드 에러 없음", completed: false, autoCheck: true },
      { id: "basic-qa", label: "기본 동작 확인", completed: false },
    ],
  },
  {
    id: "test",
    label: "Test",
    icon: "🧪",
    description: "전체 기능 검증, 엣지 케이스, 버그 수정",
    gateCondition: "주요 버그가 수정되고, 안정성이 확인됨",
    checklist: [
      { id: "evaluator-pass", label: "Evaluator 전체 통과", completed: false, autoCheck: true },
      { id: "edge-cases", label: "엣지 케이스 검증", completed: false },
      { id: "bug-fix", label: "발견된 버그 수정", completed: false },
      { id: "performance", label: "성능 확인 (로딩, 반응성)", completed: false },
    ],
  },
  {
    id: "polish",
    label: "Polish",
    icon: "✨",
    description: "UX 개선, 애니메이션, 최적화, 마무리",
    gateCondition: "릴리즈 준비 완료",
    checklist: [
      { id: "ux-review", label: "사용자 경험 리뷰 완료", completed: false },
      { id: "visual-polish", label: "비주얼 폴리싱", completed: false },
      { id: "optimization", label: "성능 최적화", completed: false },
      { id: "final-check", label: "최종 확인 + 릴리즈 준비", completed: false },
    ],
  },
];

export const PHASE_ORDER: ProjectPhase[] = [
  "research", "design", "prototype", "implement", "test", "polish",
];

export function getPhaseIndex(phase: ProjectPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function getNextPhase(current: ProjectPhase): ProjectPhase | null {
  const idx = getPhaseIndex(current);
  return idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : null;
}

export function createInitialPhaseState(startPhase: ProjectPhase = "research"): Record<string, unknown> {
  const phases: Record<string, unknown> = {};
  const startIdx = getPhaseIndex(startPhase);

  for (let i = 0; i < PHASE_ORDER.length; i++) {
    const def = PHASE_DEFINITIONS[i];
    phases[PHASE_ORDER[i]] = {
      status: i < startIdx ? "skipped" : i === startIdx ? "active" : "locked",
      startedAt: i === startIdx ? new Date().toISOString() : null,
      completedAt: null,
      checklist: def.checklist.map((c) => ({ ...c })),
    };
  }

  return phases;
}
