// ============================================
// 프로젝트
// ============================================
export interface Project {
  id: string;
  name: string;
  presetId: string;
  specCard: SpecCard | null;
  status: ProjectStatus;
  workingDir: string;
  selectedAgents: AgentDefinition[];
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus =
  | "discovery"
  | "planning"
  | "building"
  | "paused"
  | "completed";

// ============================================
// Discovery 스펙 카드
// ============================================
export interface SpecCard {
  projectType: string;
  coreDecisions: CoreDecision[];
  expansions: Expansion[];
  techStack: string[];
  rawAnswers: DiscoveryAnswer[];
  directorHints?: DirectorHints;
}

/** Discovery에서 수집한 프로젝트별 맞춤 힌트 — Director가 파이프라인 구성에 활용 */
export interface DirectorHints {
  domainContext: string;           // "한국 부동산 임대차 법률", "2D 픽셀 플랫포머" 등
  reviewFocus: string[];           // 검증 시 중점 항목
  techConstraints: string[];       // 기술적 제약/요구사항
  suggestedPhases?: string[];      // AI가 제안하는 파이프라인 단계
}

export interface CoreDecision {
  key: string;
  label: string;
  value: string;
  source: "user" | "ai";
}

export interface Expansion {
  id: string;
  label: string;
  enabled: boolean;
  suggestedBy: "ai";
}

export interface DiscoveryAnswer {
  questionId: string;
  question: string;
  selectedOption: string | null;
  freeText: string | null;
}

// ============================================
// 동적 파이프라인
// ============================================

/** 파이프라인 단계 유형 */
export type PipelineStepType =
  | "plan"       // 기능 분해 + 계획
  | "design"     // 설계 (아트, 아키텍처, DB 등)
  | "generate"   // 코드 생성/구현
  | "evaluate"   // 검증/테스트
  | "custom";    // 도메인 특화 (법률검토, 보안감사 등)

/** Director가 생성하는 파이프라인 단계 정의 */
export interface PipelineStep {
  id: string;
  agentId: string;         // 실행할 에이전트 ID
  displayName: string;     // UI 표시명
  type: PipelineStepType;
  description: string;     // 이 단계에서 할 일
  loop?: {                 // generate+evaluate 루프 설정
    maxRetries: number;
    pairedWith: string;    // 루프 상대 step id
  };
}

/** Director가 반환하는 전체 파이프라인 구성 */
export interface DynamicPipeline {
  steps: PipelineStep[];
  generateStepId: string;   // 메인 구현 단계 ID (Feature 루프 대상)
  evaluateStepId: string;   // 메인 검증 단계 ID
}

// ============================================
// 기능
// ============================================
export interface Feature {
  id: string;
  projectId: string;
  name: string;
  description: string;
  order: number;
  status: FeatureStatus;
  createdAt: string;
  updatedAt: string;
  // 일정 관련
  estimatedStart: string | null;
  estimatedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  assignedAgent: string | null;
  priority: number;
}

/** 캘린더/간트 뷰용 일정 아이템 */
export interface ScheduleItem {
  id: string;
  featureId: string;
  projectId: string;
  projectName: string;
  featureName: string;
  estimatedStart: string;
  estimatedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  status: FeatureStatus;
  assignedAgent: string | null;
  priority: number;
}

export type FeatureStatus =
  | "pending"
  | "in_progress"
  | "evaluating"
  | "completed"
  | "failed";

// ============================================
// 에이전트 실행
// ============================================
export interface AgentRun {
  id: string;
  projectId: string;
  featureId: string | null;
  agentId: string;
  status: AgentStatus;
  startedAt: string;
  completedAt: string | null;
  tokenInput: number;
  tokenOutput: number;
  changeSummary: string | null;
  filesChanged: string[];
  verdict: "pass" | "fail" | null;
  score: number | null;
  findings: Finding[];
  error: string | null;
}

export type AgentStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "paused";

export interface Finding {
  severity: "error" | "warning" | "info";
  message: string;
  summaryForUser: string;
}

// ============================================
// 에이전트 정의
// ============================================
export interface AgentDefinition {
  id: string;
  displayName: string;
  icon: string;
  role: string;
  goal: string;
  constraints: string[];
  model: "opus" | "sonnet" | "haiku";
  trigger: "manual" | "after_planner" | "after_generator" | "after_evaluator";
  guidelines: string[];
  outputFormat: string;
}

// ============================================
// 프리셋
// ============================================
export interface Preset {
  id: string;
  name: string;
  description: string;
  discoveryQuestions: DiscoveryQuestion[];
  agents: AgentDefinition[];
  evaluatorCriteria: string[];
  baseGuidelines: string;
}

export interface DiscoveryQuestion {
  id: string;
  question: string;
  options: QuestionOption[];
  allowFreeText: boolean;
  order: number;
  conditional?: {
    dependsOn: string;
    showWhen: string[];
  };
}

export interface QuestionOption {
  label: string;
  value: string;
  description?: string;
}

// ============================================
// 활동 로그
// ============================================
export interface ActivityEntry {
  id: string;
  projectId: string;
  timestamp: string;
  agentId: string;
  eventType: ActivityEventType;
  message: string;
  details: string | null;
  featureId: string | null;
}

export type ActivityEventType =
  | "thinking"
  | "tool_call"
  | "complete"
  | "error"
  | "checkpoint"
  | "user_action"
  | "system";

// ============================================
// 채팅 메시지
// ============================================
export interface ChatMessage {
  id: string;
  projectId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// ============================================
// 프로젝트 단계 (Phase)
// ============================================
export type ProjectPhase =
  | "research"     // R&D: 기술 조사, 아키텍처 탐색
  | "design"       // 설계: 스펙 상세화, 데이터 모델
  | "prototype"    // 프로토타입: 핵심 기능만 빠르게
  | "implement"    // 구현: 전체 기능 개발
  | "test"         // 테스트: 검증, 버그 수정
  | "polish";      // 폴리싱: UX 개선, 최적화

export interface PhaseDefinition {
  id: ProjectPhase;
  label: string;
  icon: string;
  description: string;
  checklist: PhaseCheckItem[];
  gateCondition: string; // 다음 단계로 넘어가는 조건 설명
}

export interface PhaseCheckItem {
  id: string;
  label: string;
  completed: boolean;
  autoCheck?: boolean; // 자동 확인 가능 여부
}

export interface ProjectPhaseState {
  currentPhase: ProjectPhase;
  phases: Record<ProjectPhase, {
    status: "locked" | "active" | "completed" | "skipped";
    startedAt: string | null;
    completedAt: string | null;
    checklist: PhaseCheckItem[];
  }>;
}

// ============================================
// 프로젝트 계획 문서
// ============================================
export interface PlanDocument {
  overview: string;
  specSummary: {
    projectType: string;
    coreDecisions: { key: string; label: string; value: string }[];
    techStack: string[];
    expansions: { label: string; enabled: boolean }[];
  };
  features: PlanFeatureEntry[];
  agentTeam: { id: string; displayName: string; icon: string; role: string }[];
  changeLog: PlanChangeLog[];
}

export interface PlanFeatureEntry {
  featureId: string;
  name: string;
  description: string;
  status: FeatureStatus;
  estimatedStart: string | null;
  estimatedEnd: string | null;
  assignedAgent: string | null;
}

export interface PlanChangeLog {
  date: string;
  action: "plan_created" | "feature_added" | "feature_removed" | "feature_status_changed"
    | "feature_completed" | "schedule_updated" | "agent_changed" | "feature_requested";
  detail: string;
  trigger: "system" | "pipeline" | "user";
}

// ============================================
// 세션
// ============================================
export interface Session {
  id: string;
  projectId: string;
  startedAt: string;
  endedAt: string | null;
  summary: string | null;
}
