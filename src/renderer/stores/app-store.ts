import { create } from "zustand";
import type {
  Project,
  Milestone,
  Sprint,
  Task,
  TaskStatus,
  ProjectStats,
} from "@shared/types";

interface AppState {
  // 프로젝트 목록
  projects: Project[];
  currentProjectId: string | null;

  // 프로젝트 트리
  milestones: (Milestone & { sprints: (Sprint & { tasks: Task[] })[] })[];

  // 실행 상태
  executionStatus: "idle" | "running" | "paused";
  activeTaskId: string | null;

  // 선택
  selectedTaskId: string | null;

  // 통계
  stats: ProjectStats | null;

  // UI
  claudeInstalled: boolean | null;

  // 액션
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (id: string | null) => void;
  setProjectTree: (milestones: AppState["milestones"]) => void;
  setExecutionStatus: (status: AppState["executionStatus"]) => void;
  setActiveTask: (id: string | null) => void;
  selectTask: (id: string | null) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  setStats: (stats: ProjectStats) => void;
  setClaudeInstalled: (installed: boolean) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  projects: [],
  currentProjectId: null,
  milestones: [],
  executionStatus: "idle",
  activeTaskId: null,
  selectedTaskId: null,
  stats: null,
  claudeInstalled: null,

  setProjects: (projects) => set({ projects }),

  setCurrentProject: (id) => set({ currentProjectId: id }),

  setProjectTree: (milestones) => set({ milestones }),

  setExecutionStatus: (status) => set({ executionStatus: status }),

  setActiveTask: (id) => set({ activeTaskId: id }),

  selectTask: (id) => set({ selectedTaskId: id }),

  updateTaskStatus: (taskId, status) =>
    set((state) => ({
      milestones: state.milestones.map((m) => ({
        ...m,
        sprints: m.sprints.map((s) => ({
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, status } : t,
          ),
        })),
      })),
    })),

  setStats: (stats) => set({ stats }),

  setClaudeInstalled: (installed) => set({ claudeInstalled: installed }),

  reset: () =>
    set({
      currentProjectId: null,
      milestones: [],
      executionStatus: "idle",
      activeTaskId: null,
      selectedTaskId: null,
      stats: null,
    }),
}));
