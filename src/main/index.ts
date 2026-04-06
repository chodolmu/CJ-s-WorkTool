import { app, BrowserWindow, ipcMain, dialog } from "electron";
import fs from "fs";
import path from "path";
import { createDatabase, getDataDir } from "./memory/database";
import { MemoryManager } from "./memory/memory-manager";
import { SdkChat } from "./agent-runner/sdk-chat";
import { GitManager } from "./tools/git-manager";

let mainWindow: BrowserWindow | null = null;
let memoryManager: MemoryManager;

// 프로젝트별 인터랙티브 Claude 세션
const claudeSessions = new Map<string, SdkChat>();

// 실행 상태
let executionRunning = false;
let executionPaused = false;
let activeTaskId: string | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: "#2b2d31",
    titleBarStyle: "hiddenInset",
    frame: process.platform === "darwin" ? false : true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function initServices(): void {
  const db = createDatabase();
  memoryManager = new MemoryManager(db);
}

function registerIpcHandlers(): void {
  // ── App ──
  ipcMain.handle("app:get-version", () => app.getVersion());

  // ── Dialog ──
  ipcMain.handle("dialog:select-folder", async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory", "createDirectory"],
      title: "프로젝트 폴더 선택",
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // ── System Check ──
  ipcMain.handle("system:check-claude-code", async () => {
    try {
      const version = require("child_process").execSync("claude --version", {
        encoding: "utf-8", timeout: 5000, shell: true, windowsHide: true,
      }).trim();
      return { installed: true, version };
    } catch {
      return { installed: false, version: null };
    }
  });

  // ══════════════════════════════════
  // Discovery — claude -p로 one-shot 호출
  // ══════════════════════════════════

  ipcMain.handle("discovery:chat", async (_event, { messages }: {
    messages: { role: string; content: string }[];
  }) => {
    const latestUserMsg = messages[messages.length - 1]?.content ?? "";

    const systemPrompt = `당신은 프로젝트 기획 전문가입니다. 사용자의 프로젝트 아이디어를 구체화하여 SpecCard를 만들어야 합니다.

## 규칙
1. 한국어로 대화. 한 번에 2~3개 질문. 선택지를 제시하면 답하기 쉬워집니다.
2. 사용자가 이미 답한 질문을 다시 묻지 마세요.
3. 아래 항목이 80% 이상 파악되면 스펙을 정리하여 보여주고 확인 요청.

## 파악 항목
- 프로젝트 유형과 핵심 목적
- 기술 스택
- MVP 범위 (첫 빌드에 포함할 것)
- 핵심 기능 목록 (3~5개)

4. 사용자가 확인하면 응답 맨 끝에 JSON 출력:
{"ready":true,"specCard":{"projectName":"이름","projectType":"유형","description":"설명","coreDecisions":["결정1","결정2"],"techStack":["기술1"],"features":["기능1","기능2"]}}
5. 확인 전에는 JSON 금지.`;

    // 이전 대화를 포함해서 전체 맥락 전달
    const fullPrompt = messages.length > 1
      ? messages.map(m => `[${m.role === "user" ? "사용자" : "AI"}]: ${m.content}`).join("\n\n") + `\n\n위 대화를 이어서 응답하세요.`
      : latestUserMsg;

    try {
      const chat = new SdkChat();
      const { response } = await chat.send({
        message: fullPrompt,
        systemPrompt,
        workingDir: ".",
      });

      // JSON 스펙카드 추출
      let specCard = null;
      try {
        const jsonMatch = response.match(/\{[\s\S]*"ready"\s*:\s*true[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.ready && parsed.specCard) specCard = parsed.specCard;
        }
      } catch { /* 일반 대화 */ }

      const cleanResponse = response
        .replace(/\{[\s\S]*"ready"\s*:\s*true[\s\S]*\}/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      return {
        response: cleanResponse || (specCard ? "스펙을 정리했습니다!" : "응답 오류"),
        specCard,
      };
    } catch (err) {
      return {
        response: `AI 연결 오류: ${String(err).slice(0, 500)}`,
        error: String(err),
      };
    }
  });

  ipcMain.handle("discovery:complete", (_event, { projectName, specCard, workingDir }: {
    projectName: string; specCard: unknown; workingDir?: string;
  }) => {
    const project = memoryManager.createProject(projectName, "", workingDir ?? "");
    memoryManager.updateProjectSpecCard(project.id, specCard as any);
    memoryManager.updateProjectStatus(project.id, "planning");
    return memoryManager.getProject(project.id);
  });

  // ══════════════════════════════════
  // Projects
  // ══════════════════════════════════

  ipcMain.handle("project:list", () => memoryManager.listProjects());
  ipcMain.handle("project:load", (_event, { projectId }: { projectId: string }) => memoryManager.getProject(projectId));
  ipcMain.handle("project:delete", (_event, { projectId }: { projectId: string }) => {
    // 세션도 정리
    const session = claudeSessions.get(projectId);
    if (session) { session.stop(); claudeSessions.delete(projectId); }
    memoryManager.deleteProject(projectId);
    return { ok: true };
  });
  ipcMain.handle("project:load-last", () => memoryManager.getLastProject() ?? null);

  // 프로젝트 폴더 변경
  ipcMain.handle("project:set-working-dir", async (_event, { projectId, workingDir }: {
    projectId: string; workingDir: string;
  }) => {
    const db = (memoryManager as any).db;
    db.prepare("UPDATE projects SET working_dir = ?, updated_at = ? WHERE id = ?")
      .run(workingDir, new Date().toISOString(), projectId);
    return { ok: true };
  });

  // ══════════════════════════════════
  // Claude 인터랙티브 채팅 — 프로젝트 폴더에서 claude를 띄움
  // ══════════════════════════════════

  ipcMain.handle("chat:start", (_event, { projectId, workingDir }: {
    projectId: string; workingDir: string;
  }) => {
    // 기존 세션 정리
    const existing = claudeSessions.get(projectId);
    if (existing) existing.stop();

    const chat = new SdkChat();
    claudeSessions.set(projectId, chat);

    // stdout → renderer
    chat.on("stdout", (text: string) => {
      mainWindow?.webContents.send("chat:output", { projectId, text });
    });

    // stderr → renderer
    chat.on("stderr", (text: string) => {
      mainWindow?.webContents.send("chat:output", { projectId, text });
    });

    // 프로세스 종료
    chat.on("exit", (code: number) => {
      mainWindow?.webContents.send("chat:exit", { projectId, code });
      claudeSessions.delete(projectId);
    });

    chat.on("error", (message: string) => {
      mainWindow?.webContents.send("chat:error", { projectId, message });
      claudeSessions.delete(projectId);
    });

    chat.startInteractive(workingDir);
    return { ok: true };
  });

  ipcMain.handle("chat:send", (_event, { projectId, message }: {
    projectId: string; message: string;
  }) => {
    const chat = claudeSessions.get(projectId);
    if (!chat?.isRunning) return { error: "세션이 없습니다. 먼저 시작하세요." };
    chat.write(message);
    return { ok: true };
  });

  ipcMain.handle("chat:stop", (_event, { projectId }: { projectId: string }) => {
    const chat = claudeSessions.get(projectId);
    if (chat) { chat.stop(); claudeSessions.delete(projectId); }
    return { ok: true };
  });

  // ══════════════════════════════════
  // Planning — claude -p one-shot
  // ══════════════════════════════════

  ipcMain.handle("planning:generate", async (_event, { projectId }: { projectId: string }) => {
    const project = memoryManager.getProject(projectId);
    if (!project?.specCard) return { error: "프로젝트 또는 SpecCard가 없습니다." };

    const systemPrompt = `너는 소프트웨어 프로젝트 매니저다. JSON만 출력하라.
프로젝트를 마일스톤 → 스프린트 → 태스크로 분할하라.

분할 원칙:
- 태스크 = AI가 한 세션에서 완료할 수 있는 크기
- 마일스톤 = 배포/데모 가능한 단위
- 스프린트 = 검증 가능한 단위
- 난이도: easy(haiku)/medium(sonnet)/hard(opus)

출력 스키마:
{"milestones":[{"id":"m1","name":"","description":"","orderIndex":0,"status":"pending","validationStrategy":"","sprints":[{"id":"m1-s1","milestoneId":"m1","name":"","description":"","orderIndex":0,"status":"pending","validationStrategy":"","dependencies":[],"tasks":[{"id":"m1-s1-t1","sprintId":"m1-s1","name":"","description":"","plan":"","orderIndex":0,"status":"pending","difficulty":"medium","model":"sonnet","executionMode":"single","dependencies":[],"validation":{"auto":["build","typecheck"]},"estimatedFiles":[]}]}]}]}`;

    try {
      const chat = new SdkChat();
      const { response } = await chat.send({
        message: `SpecCard:\n${JSON.stringify(project.specCard, null, 2)}`,
        systemPrompt,
        workingDir: project.workingDir || ".",
      });

      const jsonMatch = response.match(/\{[\s\S]*"milestones"[\s\S]*\}/);
      if (!jsonMatch) return { error: "PM이 유효한 JSON을 생성하지 못했습니다.\n\n" + response.slice(0, 500) };

      const plan = JSON.parse(jsonMatch[0]);
      memoryManager.savePlan(projectId, plan);
      memoryManager.updateProjectStatus(projectId, "planning");
      return { success: true, plan };
    } catch (err) {
      return { error: `계획 생성 실패: ${String(err)}` };
    }
  });

  ipcMain.handle("planning:save", (_event, { projectId, plan }: { projectId: string; plan: any }) => {
    memoryManager.savePlan(projectId, plan);
    return { success: true };
  });

  ipcMain.handle("planning:approve", (_event, { projectId }: { projectId: string }) => {
    memoryManager.updateProjectStatus(projectId, "active");
    const milestones = memoryManager.getMilestones(projectId);
    if (milestones.length > 0) {
      memoryManager.updateMilestoneStatus(milestones[0].id, "active");
      const sprints = memoryManager.getSprints(milestones[0].id);
      if (sprints.length > 0) memoryManager.updateSprintStatus(sprints[0].id, "active");
    }
    return { success: true };
  });

  ipcMain.handle("planning:update-task", (_event, { taskId, changes }: { taskId: string; changes: any }) => {
    memoryManager.updateTask(taskId, changes);
    return { success: true };
  });

  ipcMain.handle("planning:remove-task", (_event, { taskId }: { taskId: string }) => {
    memoryManager.deleteTask(taskId);
    return { success: true };
  });

  // ══════════════════════════════════
  // Execution — claude -p로 태스크 하나씩 실행
  // ══════════════════════════════════

  ipcMain.handle("execution:start", async (_event, { projectId }: { projectId: string }) => {
    if (executionRunning) return { error: "이미 실행 중입니다." };
    executionRunning = true;
    executionPaused = false;
    runExecutionLoop(projectId).catch((err) => {
      console.error("[Execution] loop error:", err);
      executionRunning = false;
      mainWindow?.webContents.send("execution:error", { message: String(err) });
    });
    return { success: true };
  });

  ipcMain.handle("execution:pause", () => { executionPaused = true; return { success: true }; });
  ipcMain.handle("execution:resume", () => { executionPaused = false; return { success: true }; });
  ipcMain.handle("execution:stop", () => { executionRunning = false; executionPaused = false; return { success: true }; });

  ipcMain.handle("execution:retry-task", async (_event, { taskId }: { taskId: string }) => {
    memoryManager.incrementTaskRetry(taskId);
    memoryManager.updateTaskStatus(taskId, "pending");
    return { success: true };
  });

  ipcMain.handle("execution:skip-task", (_event, { taskId }: { taskId: string }) => {
    memoryManager.updateTaskStatus(taskId, "skipped");
    return { success: true };
  });

  ipcMain.handle("execution:get-status", (_event, { projectId }: { projectId: string }) => {
    const stats = memoryManager.getProjectStats(projectId);
    return {
      status: executionRunning ? (executionPaused ? "paused" : "running") : "idle",
      activeTaskId,
      completedTasks: stats.completedTasks,
      totalTasks: stats.totalTasks,
    };
  });

  ipcMain.handle("execution:get-task-log", (_event, { taskId }: { taskId: string }) => {
    return memoryManager.getTaskLogs(taskId);
  });

  // ══════════════════════════════════
  // Data
  // ══════════════════════════════════

  ipcMain.handle("data:get-project-tree", (_event, { projectId }: { projectId: string }) => memoryManager.getProjectTree(projectId));
  ipcMain.handle("data:get-task-detail", (_event, { taskId }: { taskId: string }) => {
    const task = memoryManager.getTask(taskId);
    if (!task) return null;
    return {
      task,
      handoff: memoryManager.getHandoff(taskId),
      validation: memoryManager.getValidation("task", taskId),
      logs: memoryManager.getTaskLogs(taskId),
    };
  });
  ipcMain.handle("data:get-handoff", (_event, { taskId }: { taskId: string }) => memoryManager.getHandoff(taskId));
  ipcMain.handle("data:get-project-stats", (_event, { projectId }: { projectId: string }) => memoryManager.getProjectStats(projectId));

  // ══════════════════════════════════
  // Git
  // ══════════════════════════════════

  ipcMain.handle("git:status", (_event, { workingDir }: { workingDir: string }) => {
    const git = new GitManager(workingDir);
    if (!git.isGitRepo()) return { isRepo: false };
    return { isRepo: true, ...git.getStatus() };
  });
  ipcMain.handle("git:init", (_event, { workingDir }: { workingDir: string }) => {
    new GitManager(workingDir).init();
    return { ok: true };
  });
  ipcMain.handle("git:commit", (_event, { workingDir, featureName, summary }: { workingDir: string; featureName: string; summary: string }) => {
    return new GitManager(workingDir).autoCommit(featureName, summary);
  });
  ipcMain.handle("git:log", (_event, { workingDir, count }: { workingDir: string; count?: number }) => {
    const git = new GitManager(workingDir);
    return git.isGitRepo() ? git.getRecentCommits(count ?? 10) : [];
  });
  ipcMain.handle("git:diff", (_event, { workingDir }: { workingDir: string }) => {
    const git = new GitManager(workingDir);
    return git.isGitRepo() ? git.getDiff() : "";
  });
}

// ══════════════════════════════════
// Task Execution Loop
// ══════════════════════════════════

async function runExecutionLoop(projectId: string): Promise<void> {
  while (executionRunning) {
    if (executionPaused) { await new Promise(r => setTimeout(r, 1000)); continue; }

    const task = memoryManager.getNextPendingTask(projectId);
    if (!task) {
      executionRunning = false;
      mainWindow?.webContents.send("execution:all-complete", { projectId });
      break;
    }

    if (task.dependencies.length > 0) {
      const allDeps = task.dependencies.every(depId => {
        const d = memoryManager.getTask(depId);
        return d?.status === "completed" || d?.status === "skipped";
      });
      if (!allDeps) { memoryManager.updateTaskStatus(task.id, "queued"); continue; }
    }

    activeTaskId = task.id;
    await executeTask(task, projectId);
    activeTaskId = null;
  }
  executionRunning = false;
}

async function executeTask(task: import("@shared/types").Task, projectId: string): Promise<void> {
  const startTime = Date.now();
  memoryManager.updateTaskStatus(task.id, "running");
  memoryManager.addTaskLog(task.id, "start", `태스크 시작: ${task.name}`);
  mainWindow?.webContents.send("execution:task-started", { taskId: task.id, model: task.model });

  const project = memoryManager.getProject(projectId);
  if (!project) return;

  // 컨텍스트 조립
  const handoffs: string[] = [];
  for (const depId of task.dependencies) {
    const h = memoryManager.getHandoff(depId);
    if (h) handoffs.push(`[${depId}] ${h.summary} | Files: ${h.filesChanged.join(", ")}`);
  }

  const prompt = `# 태스크: ${task.name}
${task.description}

## 계획
${task.plan}

## 예상 변경 파일
${task.estimatedFiles.join(", ") || "없음"}
${handoffs.length > 0 ? `\n## 이전 태스크 결과\n${handoffs.join("\n")}` : ""}

완료 후 JSON handoff를 출력:
{"handoff":{"summary":"무엇을 했는지","filesChanged":["파일"],"designDecisions":["결정"],"knownIssues":["이슈"],"nextTaskNotes":"참고"}}`;

  try {
    const chat = new SdkChat();
    chat.on("stream", (data: { text: string }) => {
      mainWindow?.webContents.send("execution:task-progress", { taskId: task.id, eventType: "output", message: data.text });
    });

    const { response } = await chat.send({
      message: prompt,
      systemPrompt: "너는 소프트웨어 개발자다. 태스크를 완료하고 handoff JSON을 출력하라.",
      workingDir: project.workingDir || ".",
    });

    const durationMs = Date.now() - startTime;

    // Handoff 추출
    let handoffData = null;
    try {
      const m = response.match(/\{[\s\S]*"handoff"[\s\S]*\}/);
      if (m) handoffData = JSON.parse(m[0]).handoff;
    } catch { /* */ }

    if (handoffData) {
      const { v4: uuid } = require("uuid");
      memoryManager.createHandoff({
        id: uuid(), taskId: task.id, projectId,
        summary: handoffData.summary ?? "", filesChanged: handoffData.filesChanged ?? [],
        designDecisions: handoffData.designDecisions ?? [], knownIssues: handoffData.knownIssues ?? [],
        nextTaskNotes: handoffData.nextTaskNotes,
      });
    }

    memoryManager.updateTaskCost(task.id, 0, durationMs);
    memoryManager.updateTaskStatus(task.id, "completed");
    memoryManager.addTaskLog(task.id, "complete", `완료 (${Math.round(durationMs / 1000)}초)`);
    mainWindow?.webContents.send("execution:task-completed", { taskId: task.id, handoff: handoffData, durationMs });
    checkSprintCompletion(task.sprintId, projectId);
  } catch (err) {
    const durationMs = Date.now() - startTime;
    memoryManager.updateTaskCost(task.id, 0, durationMs);
    memoryManager.addTaskLog(task.id, "error", String(err).slice(0, 500));
    if (task.retryCount < 2) {
      memoryManager.incrementTaskRetry(task.id);
      memoryManager.updateTaskStatus(task.id, "pending");
    } else {
      memoryManager.updateTaskStatus(task.id, "failed");
    }
    mainWindow?.webContents.send("execution:task-failed", { taskId: task.id, error: String(err).slice(0, 300), retryCount: task.retryCount + 1 });
  }
}

function checkSprintCompletion(sprintId: string, projectId: string): void {
  const tasks = memoryManager.getTasks(sprintId);
  if (!tasks.every(t => t.status === "completed" || t.status === "skipped")) return;

  memoryManager.updateSprintStatus(sprintId, "completed");
  mainWindow?.webContents.send("execution:sprint-completed", { sprintId });

  const sprint = memoryManager.getSprintsByProject(projectId).find(s => s.id === sprintId);
  if (!sprint) return;

  const sprints = memoryManager.getSprints(sprint.milestoneId);
  if (sprints.every(s => s.status === "completed")) {
    memoryManager.updateMilestoneStatus(sprint.milestoneId, "completed");
    mainWindow?.webContents.send("execution:milestone-completed", { milestoneId: sprint.milestoneId });
    const next = memoryManager.getMilestones(projectId).find(m => m.status === "pending");
    if (next) {
      memoryManager.updateMilestoneStatus(next.id, "active");
      const ns = memoryManager.getSprints(next.id);
      if (ns.length > 0) memoryManager.updateSprintStatus(ns[0].id, "active");
    }
  } else {
    const next = sprints.find(s => s.status === "pending");
    if (next) memoryManager.updateSprintStatus(next.id, "active");
  }
}

// ── App Lifecycle ──

app.whenReady().then(async () => {
  initServices();
  registerIpcHandlers();
  createWindow();

  try {
    const version = require("child_process").execSync("claude --version", { encoding: "utf-8", timeout: 5000, shell: true, windowsHide: true }).trim();
    mainWindow?.webContents.once("did-finish-load", () => {
      mainWindow?.webContents.send("system:claude-status", { installed: true, version });
    });
  } catch {
    mainWindow?.webContents.once("did-finish-load", () => {
      mainWindow?.webContents.send("system:claude-status", { installed: false });
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
