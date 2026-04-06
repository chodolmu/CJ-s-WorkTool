// ============================================
// v3 핵심 도메인 타입
// ============================================

// === 프로젝트 ===
export interface Project {
  id: string;
  name: string;
  description: string;
  specCard: SpecCard | null;
  status: ProjectStatus;
  workingDir: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus =
  | "planning"
  | "active"
  | "paused"
  | "completed";

// === SpecCard (Discovery 결과) ===
export interface SpecCard {
  projectName: string;
  projectType: string;
  description: string;
  coreDecisions: string[];
  techStack: string[];
  features: string[];
}

// === 마일스톤 ===
export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  orderIndex: number;
  status: MilestoneStatus;
  validationStrategy: string;
  sprints?: Sprint[];
  createdAt?: string;
  completedAt?: string;
}

export type MilestoneStatus = "pending" | "active" | "completed" | "failed";

// === 스프린트 ===
export interface Sprint {
  id: string;
  milestoneId: string;
  projectId: string;
  name: string;
  description: string;
  orderIndex: number;
  status: SprintStatus;
  validationStrategy: string;
  dependencies: string[];
  tasks?: Task[];
  createdAt?: string;
  completedAt?: string;
}

export type SprintStatus = "pending" | "active" | "completed" | "failed";

// === 태스크 ===
export interface Task {
  id: string;
  sprintId: string;
  projectId: string;
  name: string;
  description: string;
  plan: string;
  orderIndex: number;
  status: TaskStatus;
  difficulty: TaskDifficulty;
  model: ModelType;
  executionMode: ExecutionMode;
  harnessId?: string;
  dependencies: string[];
  validation: TaskValidation;
  estimatedFiles: string[];
  actualFiles: string[];
  cost: number;
  durationMs: number;
  retryCount: number;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export type TaskStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type TaskDifficulty = "easy" | "medium" | "hard";
export type ModelType = "haiku" | "sonnet" | "opus";
export type ExecutionMode = "single" | "harness";

export interface TaskValidation {
  auto: string[];
  manual?: string;
}

// === 핸드오프 ===
export interface TaskHandoff {
  id: string;
  taskId: string;
  projectId: string;
  summary: string;
  filesChanged: string[];
  designDecisions: string[];
  knownIssues: string[];
  nextTaskNotes?: string;
  createdAt?: string;
}

// === 검증 ===
export interface ValidationResult {
  id: string;
  targetType: "task" | "sprint" | "milestone";
  targetId: string;
  passed: boolean;
  results: ValidationCheck[];
  validatedBy: "auto" | "opus" | "user";
  createdAt?: string;
}

export interface ValidationCheck {
  check: string;
  passed: boolean;
  message: string;
}

// === 태스크 로그 ===
export interface TaskLog {
  id: number;
  taskId: string;
  eventType: TaskLogEventType;
  message: string;
  timestamp: string;
}

export type TaskLogEventType =
  | "start"
  | "thinking"
  | "tool_call"
  | "output"
  | "error"
  | "complete";

// === 프로젝트 트리 (조회용) ===
export interface ProjectTree {
  project: Project;
  milestones: (Milestone & { sprints: (Sprint & { tasks: Task[] })[] })[];
}

// === 프로젝트 통계 ===
export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  pendingTasks: number;
  totalCost: number;
  costByModel: {
    haiku: number;
    sonnet: number;
    opus: number;
  };
  progressPercent: number;
}

// === 실행 상태 ===
export interface ExecutionStatus {
  status: "idle" | "running" | "paused";
  activeTaskId: string | null;
  completedTasks: number;
  totalTasks: number;
}

// === 채팅 메시지 (Discovery 대화용) ===
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
