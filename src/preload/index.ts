import { contextBridge, ipcRenderer } from "electron";

const api = {
  // 앱 정보
  getVersion: (): Promise<string> => ipcRenderer.invoke("app:get-version"),

  // IPC 이벤트 리스너
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },

  // ── Discovery ──
  discovery: {
    chat: (messages: { role: string; content: string }[]) =>
      ipcRenderer.invoke("discovery:chat", { messages }),
    complete: (projectName: string, specCard: unknown, workingDir?: string) =>
      ipcRenderer.invoke("discovery:complete", { projectName, specCard, workingDir }),
  },

  // ── Project ──
  project: {
    list: () => ipcRenderer.invoke("project:list"),
    load: (projectId: string) => ipcRenderer.invoke("project:load", { projectId }),
    loadLast: () => ipcRenderer.invoke("project:load-last"),
    delete: (projectId: string) => ipcRenderer.invoke("project:delete", { projectId }),
  },

  // ── Planning ─���
  planning: {
    generate: (projectId: string) => ipcRenderer.invoke("planning:generate", { projectId }),
    save: (projectId: string, plan: unknown) => ipcRenderer.invoke("planning:save", { projectId, plan }),
    approve: (projectId: string) => ipcRenderer.invoke("planning:approve", { projectId }),
    updateTask: (taskId: string, changes: unknown) => ipcRenderer.invoke("planning:update-task", { taskId, changes }),
    removeTask: (taskId: string) => ipcRenderer.invoke("planning:remove-task", { taskId }),
  },

  // ── Execution ���─
  execution: {
    start: (projectId: string) => ipcRenderer.invoke("execution:start", { projectId }),
    pause: () => ipcRenderer.invoke("execution:pause"),
    resume: () => ipcRenderer.invoke("execution:resume"),
    stop: () => ipcRenderer.invoke("execution:stop"),
    retryTask: (taskId: string) => ipcRenderer.invoke("execution:retry-task", { taskId }),
    skipTask: (taskId: string) => ipcRenderer.invoke("execution:skip-task", { taskId }),
    getStatus: (projectId: string) => ipcRenderer.invoke("execution:get-status", { projectId }),
    getTaskLog: (taskId: string) => ipcRenderer.invoke("execution:get-task-log", { taskId }),
  },

  // ── Data ──
  data: {
    getProjectTree: (projectId: string) => ipcRenderer.invoke("data:get-project-tree", { projectId }),
    getTaskDetail: (taskId: string) => ipcRenderer.invoke("data:get-task-detail", { taskId }),
    getHandoff: (taskId: string) => ipcRenderer.invoke("data:get-handoff", { taskId }),
    getProjectStats: (projectId: string) => ipcRenderer.invoke("data:get-project-stats", { projectId }),
  },

  // ── Git ──
  git: {
    status: (workingDir: string) => ipcRenderer.invoke("git:status", { workingDir }),
    init: (workingDir: string) => ipcRenderer.invoke("git:init", { workingDir }),
    commit: (workingDir: string, featureName: string, summary: string) =>
      ipcRenderer.invoke("git:commit", { workingDir, featureName, summary }),
    log: (workingDir: string, count?: number) => ipcRenderer.invoke("git:log", { workingDir, count }),
    diff: (workingDir: string) => ipcRenderer.invoke("git:diff", { workingDir }),
  },

  // ── Dialog ──
  dialog: {
    selectFolder: () => ipcRenderer.invoke("dialog:select-folder"),
  },

  // ── System ��─
  system: {
    checkClaudeCode: () => ipcRenderer.invoke("system:check-claude-code"),
  },
} as const;

export type WorkToolAPI = typeof api;

contextBridge.exposeInMainWorld("harness", api);
