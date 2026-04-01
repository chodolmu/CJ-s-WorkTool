import { create } from "zustand";
import type { AgentStatus, AgentSubstatus, FeatureStatus, Project, PipelineStep, PhaseCoachMessage, SmartInputRequest, GsdPipelineState, GsdApprovalRequest, GsdUIEvent } from "@shared/types";
import type { AgentCardData } from "../components/AgentCard";
import type { ActivityItem } from "../components/ActivityFeed";
import type { FeatureItem } from "../components/FeatureList";

interface PipelineState {
  status: "idle" | "running" | "paused" | "waiting_checkpoint" | "completed" | "failed";
  completedFeatures: number;
  totalFeatures: number;
  currentFeature: string | null;
  steps: PipelineStep[];
  activeStepId: string | null;
  completedStepIds: string[];
}

interface CheckpointData {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface AppState {
  // ── 프로젝트 ──
  currentProjectId: string | null;
  projectName: string | null;
  projects: Project[];

  // ── 기능 목록 ──
  features: FeatureItem[];

  // ── 에이전트 상태 ──
  agents: AgentCardData[];

  // ── 파이프라인 ──
  pipeline: PipelineState;

  // ── 활동 로그 ──
  activities: ActivityItem[];

  // ── 체크포인트 ──
  pendingCheckpoint: CheckpointData | null;

  // ── Phase Coach ──
  phaseCoach: PhaseCoachMessage | null;

  // ── Smart Input ──
  smartInputRequest: SmartInputRequest | null;

  // ── GSD 파이프라인 ──
  gsdPipeline: GsdPipelineState;
  gsdApproval: GsdApprovalRequest | null;

  // ── UI ──
  selectedAgentId: string | null;
  claudeInstalled: boolean | null;
  activePhaseChatStepId: string | null;

  // ── 액션 ──
  setProject: (id: string, name: string) => void;
  setProjects: (projects: Project[]) => void;
  setFeatures: (features: FeatureItem[]) => void;
  updateFeatureStatus: (featureId: string, status: FeatureStatus) => void;
  initAgents: (agents: { id: string; displayName: string; icon: string; trigger?: string }[]) => void;
  updateAgentStatus: (agentId: string, status: AgentStatus, currentFeature?: string | null) => void;
  updateAgentSubstatus: (agentId: string, substatus: AgentSubstatus) => void;
  updateAgentChangeSummary: (agentId: string, summary: string, filesChanged: string[]) => void;
  setPipelineStatus: (status: PipelineState["status"]) => void;
  setPipelineProgress: (completed: number, total: number, current: string | null) => void;
  setPipelineSteps: (steps: PipelineStep[]) => void;
  setActiveStep: (stepId: string | null) => void;
  completeStep: (stepId: string) => void;
  addActivity: (activity: Omit<ActivityItem, "id">) => void;
  setCheckpoint: (checkpoint: CheckpointData | null) => void;
  setPhaseCoach: (msg: PhaseCoachMessage | null) => void;
  setSmartInputRequest: (req: SmartInputRequest | null) => void;
  setSelectedAgent: (id: string | null) => void;
  setClaudeInstalled: (installed: boolean) => void;
  updateGsdPipeline: (update: Partial<GsdPipelineState>) => void;
  setGsdApproval: (approval: GsdApprovalRequest | null) => void;
  addGsdPhase: (phase: GsdPipelineState["phases"][0]) => void;
  updateGsdPhaseStatus: (phaseNumber: string, status: GsdPipelineState["phases"][0]["status"]) => void;
  setActivePhaseChatStep: (stepId: string | null) => void;
  reset: () => void;
}

let activityCounter = 0;

export const useAppStore = create<AppState>((set) => ({
  currentProjectId: null,
  projectName: null,
  projects: [],
  features: [],
  agents: [],
  pipeline: {
    status: "idle",
    completedFeatures: 0,
    totalFeatures: 0,
    currentFeature: null,
    steps: [],
    activeStepId: null,
    completedStepIds: [],
  },
  activities: [],
  pendingCheckpoint: null,
  phaseCoach: null,
  smartInputRequest: null,
  gsdPipeline: {
    isRunning: false,
    cost: 0,
    phases: [],
  },
  gsdApproval: null,
  selectedAgentId: null,
  claudeInstalled: null,
  activePhaseChatStepId: null,

  setProject: (id, name) => set({ currentProjectId: id, projectName: name }),

  setProjects: (projects) => set({ projects }),

  setFeatures: (features) => set({ features }),

  updateFeatureStatus: (featureId, status) =>
    set((state) => ({
      features: state.features.map((f) =>
        f.id === featureId ? { ...f, status } : f,
      ),
    })),

  initAgents: (agentDefs) =>
    set({
      agents: agentDefs.map((a) => ({
        id: a.id,
        displayName: a.displayName,
        icon: a.icon,
        trigger: a.trigger,
        status: "queued" as AgentStatus,
        currentFeature: null,
        progress: null,
        lastChangeSummary: null,
        lastActivity: null,
      })),
    }),

  updateAgentStatus: (agentId, status, currentFeature) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId
          ? {
              ...a,
              status,
              currentFeature: currentFeature ?? a.currentFeature,
              lastActivity: new Date().toISOString(),
              // completed/failed 시 substatus 초기화
              ...(status !== "running" ? { substatus: undefined } : {}),
            }
          : a,
      ),
    })),

  updateAgentSubstatus: (agentId, substatus) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, substatus } : a,
      ),
    })),

  updateAgentChangeSummary: (agentId, summary, filesChanged) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, lastChangeSummary: summary } : a,
      ),
    })),

  setPipelineStatus: (status) =>
    set((state) => ({ pipeline: { ...state.pipeline, status } })),

  setPipelineProgress: (completed, total, current) =>
    set((state) => ({
      pipeline: { ...state.pipeline, completedFeatures: completed, totalFeatures: total, currentFeature: current },
    })),

  setPipelineSteps: (steps) =>
    set((state) => ({
      pipeline: { ...state.pipeline, steps, activeStepId: null, completedStepIds: [] },
    })),

  setActiveStep: (stepId) =>
    set((state) => ({
      pipeline: { ...state.pipeline, activeStepId: stepId },
    })),

  completeStep: (stepId) =>
    set((state) => ({
      pipeline: {
        ...state.pipeline,
        activeStepId: null,
        completedStepIds: [...state.pipeline.completedStepIds, stepId],
      },
    })),

  addActivity: (activity) =>
    set((state) => ({
      activities: [
        ...state.activities.slice(-499), // 최대 500개 유지
        { ...activity, id: `act-${++activityCounter}` },
      ],
    })),

  setCheckpoint: (checkpoint) => set({ pendingCheckpoint: checkpoint }),

  setPhaseCoach: (msg) => set({ phaseCoach: msg }),

  setSmartInputRequest: (req) => set({ smartInputRequest: req }),

  setSelectedAgent: (id) => set({ selectedAgentId: id }),

  setClaudeInstalled: (installed) => set({ claudeInstalled: installed }),

  updateGsdPipeline: (update) =>
    set((state) => ({ gsdPipeline: { ...state.gsdPipeline, ...update } })),

  setGsdApproval: (approval) => set({ gsdApproval: approval }),

  addGsdPhase: (phase) =>
    set((state) => ({
      gsdPipeline: {
        ...state.gsdPipeline,
        phases: [...state.gsdPipeline.phases, phase],
      },
    })),

  updateGsdPhaseStatus: (phaseNumber, status) =>
    set((state) => ({
      gsdPipeline: {
        ...state.gsdPipeline,
        phases: state.gsdPipeline.phases.map((p) =>
          p.number === phaseNumber ? { ...p, status } : p,
        ),
      },
    })),

  setActivePhaseChatStep: (stepId) => set({ activePhaseChatStepId: stepId }),

  reset: () =>
    set({
      currentProjectId: null,
      projectName: null,
      agents: [],
      features: [],
      pipeline: { status: "idle", completedFeatures: 0, totalFeatures: 0, currentFeature: null, steps: [], activeStepId: null, completedStepIds: [] },
      activities: [],
      pendingCheckpoint: null,
      phaseCoach: null,
      smartInputRequest: null,
      selectedAgentId: null,
      activePhaseChatStepId: null,
    }),
}));
