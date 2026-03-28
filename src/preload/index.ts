import { contextBridge, ipcRenderer } from "electron";

// Renderer에서 접근 가능한 API만 노출 (보안)
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
    start: (presetId: string) =>
      ipcRenderer.invoke("discovery:start", { presetId }),
    answer: (questionId: string, answer: string) =>
      ipcRenderer.invoke("discovery:answer", { questionId, answer }),
    complete: (projectName: string, presetId: string, specCard: unknown, workingDir?: string, agents?: unknown[]) =>
      ipcRenderer.invoke("discovery:complete", { projectName, presetId, specCard, workingDir, agents }),
    chat: (messages: { role: string; content: string }[], round: number) =>
      ipcRenderer.invoke("discovery:chat", { messages, round }),
  },

  // ── Pipeline ──
  pipeline: {
    start: (projectId: string, workingDir: string) =>
      ipcRenderer.invoke("pipeline:start", { projectId, workingDir }),
    pause: () => ipcRenderer.invoke("pipeline:pause"),
    resume: () => ipcRenderer.invoke("pipeline:resume"),
  },

  // ── Project ──
  project: {
    create: (name: string, presetId: string) =>
      ipcRenderer.invoke("project:create", { name, presetId }),
    list: () => ipcRenderer.invoke("project:list"),
    load: (projectId: string) =>
      ipcRenderer.invoke("project:load", { projectId }),
    loadLast: () => ipcRenderer.invoke("project:load-last"),
    delete: (projectId: string) =>
      ipcRenderer.invoke("project:delete", { projectId }),
  },

  // ── Session ──
  session: {
    start: (projectId: string) =>
      ipcRenderer.invoke("session:start", { projectId }),
    end: () => ipcRenderer.invoke("session:end"),
  },

  // ── Checkpoint ──
  checkpoint: {
    respond: (action: string) =>
      ipcRenderer.invoke("checkpoint:respond", { action }),
  },

  // ── Decision (에이전트가 사용자에게 묻는 질문) ──
  decision: {
    respond: (answer: string) =>
      ipcRenderer.invoke("decision:respond", { answer }),
  },

  // ── Presets ──
  preset: {
    list: () => ipcRenderer.invoke("preset:list"),
    save: (preset: unknown) => ipcRenderer.invoke("preset:save", { preset }),
  },

  // ── Activities ──
  activities: {
    list: (projectId: string, limit?: number, offset?: number) =>
      ipcRenderer.invoke("activities:list", { projectId, limit, offset }),
  },

  // ── Agent Guidelines ──
  agent: {
    generateGuidelines: (projectId: string, presetId: string, description: string) =>
      ipcRenderer.invoke("agent:generate-guidelines", { projectId, presetId, description }),
    save: (presetId: string, agent: unknown) =>
      ipcRenderer.invoke("agent:save", { presetId, agent }),
    delete: (presetId: string, agentId: string) =>
      ipcRenderer.invoke("agent:delete", { presetId, agentId }),
  },

  // ── Chat ──
  chat: {
    send: (projectId: string, message: string, workingDir: string, mode?: string) =>
      ipcRenderer.invoke("chat:send", { projectId, message, workingDir, mode }),
    history: (projectId: string, limit?: number, offset?: number) =>
      ipcRenderer.invoke("chat:history", { projectId, limit, offset }),
    classify: (message: string) =>
      ipcRenderer.invoke("chat:classify", { message }),
  },

  // ── Phase ──
  phase: {
    get: (projectId: string) => ipcRenderer.invoke("phase:get", { projectId }),
    update: (projectId: string, phaseState: unknown) =>
      ipcRenderer.invoke("phase:update", { projectId, phaseState }),
  },

  // ── Learnings ──
  learning: {
    list: (projectId: string, agentId?: string) =>
      ipcRenderer.invoke("learning:list", { projectId, agentId }),
    add: (projectId: string, agentId: string, pattern: string, lesson: string, source: string) =>
      ipcRenderer.invoke("learning:add", { projectId, agentId, pattern, lesson, source }),
  },

  // ── Skills ──
  skill: {
    list: (projectId: string) => ipcRenderer.invoke("skill:list", { projectId }),
    add: (projectId: string, name: string, description: string, pattern: string, template: string) =>
      ipcRenderer.invoke("skill:add", { projectId, name, description, pattern, template }),
    delete: (skillId: string) => ipcRenderer.invoke("skill:delete", { skillId }),
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

  // ── System Check ──
  system: {
    checkClaudeCode: () => ipcRenderer.invoke("system:check-claude-code"),
  },
} as const;

export type HarnessAPI = typeof api;

contextBridge.exposeInMainWorld("harness", api);
