import { create } from "zustand";
import type { AgentStatus, FeatureStatus, Project } from "@shared/types";
import type { AgentCardData } from "../components/AgentCard";
import type { ActivityItem } from "../components/ActivityFeed";
import type { FeatureItem } from "../components/FeatureList";

interface PipelineState {
  status: "idle" | "running" | "paused" | "waiting_checkpoint" | "completed" | "failed";
  completedFeatures: number;
  totalFeatures: number;
  currentFeature: string | null;
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

  // ── UI ──
  selectedAgentId: string | null;
  claudeInstalled: boolean | null;

  // ── 액션 ──
  setProject: (id: string, name: string) => void;
  setProjects: (projects: Project[]) => void;
  setFeatures: (features: FeatureItem[]) => void;
  updateFeatureStatus: (featureId: string, status: FeatureStatus) => void;
  initAgents: (agents: { id: string; displayName: string; icon: string }[]) => void;
  updateAgentStatus: (agentId: string, status: AgentStatus, currentFeature?: string | null) => void;
  updateAgentChangeSummary: (agentId: string, summary: string, filesChanged: string[]) => void;
  setPipelineStatus: (status: PipelineState["status"]) => void;
  setPipelineProgress: (completed: number, total: number, current: string | null) => void;
  addActivity: (activity: Omit<ActivityItem, "id">) => void;
  setCheckpoint: (checkpoint: CheckpointData | null) => void;
  setSelectedAgent: (id: string | null) => void;
  setClaudeInstalled: (installed: boolean) => void;
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
  },
  activities: [],
  pendingCheckpoint: null,
  selectedAgentId: null,
  claudeInstalled: null,

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
          ? { ...a, status, currentFeature: currentFeature ?? a.currentFeature, lastActivity: new Date().toISOString() }
          : a,
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

  addActivity: (activity) =>
    set((state) => ({
      activities: [
        ...state.activities.slice(-499), // 최대 500개 유지
        { ...activity, id: `act-${++activityCounter}` },
      ],
    })),

  setCheckpoint: (checkpoint) => set({ pendingCheckpoint: checkpoint }),

  setSelectedAgent: (id) => set({ selectedAgentId: id }),

  setClaudeInstalled: (installed) => set({ claudeInstalled: installed }),

  reset: () =>
    set({
      currentProjectId: null,
      projectName: null,
      agents: [],
      features: [],
      pipeline: { status: "idle", completedFeatures: 0, totalFeatures: 0, currentFeature: null },
      activities: [],
      pendingCheckpoint: null,
      selectedAgentId: null,
    }),
}));
