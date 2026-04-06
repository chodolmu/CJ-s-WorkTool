import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { execSync } from "child_process";
import { createDatabase, getDataDir } from "./memory/database";
import { MemoryManager } from "./memory/memory-manager";
import { SdkChat } from "./agent-runner/sdk-chat";
import { GitManager } from "./tools/git-manager";

// Windows: Claude Code CLI가 git-bash를 찾을 수 있도록 환경변수 설정
if (process.platform === "win32" && !process.env.CLAUDE_CODE_GIT_BASH_PATH) {
  try {
    const bashPath = execSync("where bash", { encoding: "utf-8", timeout: 3000, windowsHide: true }).trim().split("\n")[0];
    if (bashPath) {
      process.env.CLAUDE_CODE_GIT_BASH_PATH = bashPath.trim();
    }
  } catch {
    // git-bash를 못 찾으면 일반적인 경로 시도
    const candidates = [
      "C:\\Program Files\\Git\\bin\\bash.exe",
      "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
      "D:\\Git\\bin\\bash.exe",
      "D:\\Git\\usr\\bin\\bash.exe",
    ];
    for (const p of candidates) {
      try {
        require("fs").accessSync(p);
        process.env.CLAUDE_CODE_GIT_BASH_PATH = p;
        break;
      } catch { /* skip */ }
    }
  }
}

let mainWindow: BrowserWindow | null = null;
let memoryManager: MemoryManager;

// 프로젝트별 SDK 채팅 세션
const sdkChatSessions = new Map<string, SdkChat>();

function getSdkChat(projectId: string): SdkChat {
  let chat = sdkChatSessions.get(projectId);
  if (!chat) {
    chat = new SdkChat();
    sdkChatSessions.set(projectId, chat);
  }
  return chat;
}

// Discovery 전용 SDK 채팅
let discoverySdkChat: SdkChat | null = null;

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
      const { execSync } = require("child_process");
      const version = execSync("claude --version", {
        encoding: "utf-8", timeout: 5000, shell: true, windowsHide: true,
      }).trim();
      return { installed: true, version };
    } catch {
      return { installed: false, version: null };
    }
  });

  // ══════════════════════════════════
  // Discovery
  // ══════════════════════════════════

  ipcMain.handle("discovery:chat", async (_event, { messages }: {
    messages: { role: string; content: string }[];
  }) => {
    const latestUserMsg = messages[messages.length - 1]?.content ?? "";

    const discoverySystemPrompt = `당신은 프로젝트 기획 전문가입니다. 사용자의 프로젝트 아이디어를 구체화하여 SpecCard를 만들어야 합니다.

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

    try {
      if (!discoverySdkChat) {
        discoverySdkChat = new SdkChat();
      }

      const discoveryPrompt = messages.length > 1
        ? `이전 대화를 이어서 진행합니다.\n\n사용자: ${latestUserMsg}`
        : latestUserMsg;

      const result = await discoverySdkChat.send({
        message: discoveryPrompt,
        systemPrompt: discoverySystemPrompt,
        workingDir: ".",
      });

      // JSON 스펙카드 추출
      let specCard = null;
      try {
        const jsonMatch = result.response.match(/\{[\s\S]*"ready"\s*:\s*true[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.ready && parsed.specCard) {
            specCard = parsed.specCard;
          }
        }
      } catch { /* 파싱 실패 — 일반 대화 */ }

      const cleanResponse = result.response
        .replace(/\{[\s\S]*"ready"\s*:\s*true[\s\S]*\}/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      return {
        response: cleanResponse || (specCard ? "스펙을 정리했습니다!" : "응답 오류"),
        specCard,
      };
    } catch (err) {
      return {
        response: `AI 연결 오류: ${String(err).slice(0, 300)}`,
        error: String(err),
      };
    }
  });

  ipcMain.handle("discovery:complete", (_event, { projectName, specCard, workingDir }: {
    projectName: string;
    specCard: unknown;
    workingDir?: string;
  }) => {
    const project = memoryManager.createProject(projectName, "", workingDir ?? "");
    memoryManager.updateProjectSpecCard(project.id, specCard as any);
    memoryManager.updateProjectStatus(project.id, "planning");
    discoverySdkChat = null; // Discovery 세션 정리
    return memoryManager.getProject(project.id);
  });

  // ══════════════════════════════════
  // Projects
  // ══════════════════════════════════

  ipcMain.handle("project:list", () => memoryManager.listProjects());
  ipcMain.handle("project:load", (_event, { projectId }: { projectId: string }) => memoryManager.getProject(projectId));
  ipcMain.handle("project:delete", (_event, { projectId }: { projectId: string }) => {
    memoryManager.deleteProject(projectId);
    return { ok: true };
  });
  ipcMain.handle("project:load-last", () => {
    const project = memoryManager.getLastProject();
    return project ?? null;
  });

  // ══════════════════════════════════
  // Planning
  // ══════════════════════════════════

  ipcMain.handle("planning:generate", async (_event, { projectId }: { projectId: string }) => {
    const project = memoryManager.getProject(projectId);
    if (!project?.specCard) return { error: "프로젝트 또는 SpecCard가 없습니다." };

    const systemPrompt = `너는 소프트웨어 프로젝트 매니저다.
사용자가 제공한 프로젝트 정의(SpecCard)를 기반으로 프로젝트를 마일스톤 → 스프린트 → 태스크로 분할하라.

## 분할 원칙
- 태스크 하나 = AI가 한 세션에서 완료할 수 있는 크기 (한 파일~몇 파일)
- 태스크 하나 = "~하면 끝" 한 문장으로 완료 조건 정의 가능
- 의존성은 최소화하여 병렬 실행 가능하게
- 마일스톤 = 배포/데모 가능한 단위
- 스프린트 = 검증 가능한 단위

## 난이도 판정
- easy (haiku): 보일러플레이트, 설정, 단순 복사, CSS
- medium (sonnet): 일반 기능 구현, 버그 수정, 리팩토링
- hard (opus): 아키텍처 설계, 복잡한 알고리즘, 다중 파일 변경

## 출력
반드시 아래 JSON 스키마의 배열을 출력하라. 다른 텍스트 없이 JSON만:
{
  "milestones": [{
    "id": "m1", "name": "", "description": "", "orderIndex": 0, "status": "pending",
    "validationStrategy": "",
    "sprints": [{
      "id": "m1-s1", "milestoneId": "m1", "name": "", "description": "", "orderIndex": 0,
      "status": "pending", "validationStrategy": "", "dependencies": [],
      "tasks": [{
        "id": "m1-s1-t1", "sprintId": "m1-s1", "name": "", "description": "", "plan": "",
        "orderIndex": 0, "status": "pending", "difficulty": "medium", "model": "sonnet",
        "executionMode": "single", "dependencies": [],
        "validation": { "auto": ["build", "typecheck"] },
        "estimatedFiles": []
      }]
    }]
  }]
}`;

    try {
      const sdkChat = new SdkChat();
      const { response } = await sdkChat.send({
        message: `SpecCard:\n${JSON.stringify(project.specCard, null, 2)}`,
        systemPrompt,
        workingDir: project.workingDir || ".",
      });

      // JSON 추출
      const jsonMatch = response.match(/\{[\s\S]*"milestones"[\s\S]*\}/);
      if (!jsonMatch) return { error: "PM이 유효한 JSON을 생성하지 못했습니다." };

      const plan = JSON.parse(jsonMatch[0]);
      memoryManager.savePlan(projectId, plan);
      memoryManager.updateProjectStatus(projectId, "planning");

      return { success: true, plan };
    } catch (err) {
      return { error: `계획 생성 실패: ${String(err).slice(0, 300)}` };
    }
  });

  ipcMain.handle("planning:save", (_event, { projectId, plan }: { projectId: string; plan: any }) => {
    memoryManager.savePlan(projectId, plan);
    return { success: true };
  });

  ipcMain.handle("planning:approve", (_event, { projectId }: { projectId: string }) => {
    memoryManager.updateProjectStatus(projectId, "active");
    // 첫 번째 마일스톤과 스프린트를 active로
    const milestones = memoryManager.getMilestones(projectId);
    if (milestones.length > 0) {
      memoryManager.updateMilestoneStatus(milestones[0].id, "active");
      const sprints = memoryManager.getSprints(milestones[0].id);
      if (sprints.length > 0) {
        memoryManager.updateSprintStatus(sprints[0].id, "active");
      }
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
  // Execution
  // ══════════════════════════════════

  ipcMain.handle("execution:start", async (_event, { projectId }: { projectId: string }) => {
    if (executionRunning) return { error: "이미 실행 중입니다." };

    executionRunning = true;
    executionPaused = false;

    // 비동기로 태스크 루프 시작
    runExecutionLoop(projectId).catch((err) => {
      console.error("[Execution] loop error:", err);
      executionRunning = false;
      mainWindow?.webContents.send("execution:error", { message: String(err) });
    });

    return { success: true };
  });

  ipcMain.handle("execution:pause", () => {
    executionPaused = true;
    return { success: true };
  });

  ipcMain.handle("execution:resume", () => {
    executionPaused = false;
    return { success: true };
  });

  ipcMain.handle("execution:stop", () => {
    executionRunning = false;
    executionPaused = false;
    return { success: true };
  });

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

  ipcMain.handle("data:get-project-tree", (_event, { projectId }: { projectId: string }) => {
    return memoryManager.getProjectTree(projectId);
  });

  ipcMain.handle("data:get-task-detail", (_event, { taskId }: { taskId: string }) => {
    const task = memoryManager.getTask(taskId);
    if (!task) return null;
    const handoff = memoryManager.getHandoff(taskId);
    const validation = memoryManager.getValidation("task", taskId);
    const logs = memoryManager.getTaskLogs(taskId);
    return { task, handoff, validation, logs };
  });

  ipcMain.handle("data:get-handoff", (_event, { taskId }: { taskId: string }) => {
    return memoryManager.getHandoff(taskId);
  });

  ipcMain.handle("data:get-project-stats", (_event, { projectId }: { projectId: string }) => {
    return memoryManager.getProjectStats(projectId);
  });

  // ══════════════════════════════════
  // Git
  // ══════════════════════════════════

  ipcMain.handle("git:status", (_event, { workingDir }: { workingDir: string }) => {
    const git = new GitManager(workingDir);
    if (!git.isGitRepo()) return { isRepo: false };
    return { isRepo: true, ...git.getStatus() };
  });

  ipcMain.handle("git:init", (_event, { workingDir }: { workingDir: string }) => {
    const git = new GitManager(workingDir);
    git.init();
    return { ok: true };
  });

  ipcMain.handle("git:commit", (_event, { workingDir, featureName, summary }: {
    workingDir: string; featureName: string; summary: string;
  }) => {
    const git = new GitManager(workingDir);
    return git.autoCommit(featureName, summary);
  });

  ipcMain.handle("git:log", (_event, { workingDir, count }: { workingDir: string; count?: number }) => {
    const git = new GitManager(workingDir);
    if (!git.isGitRepo()) return [];
    return git.getRecentCommits(count ?? 10);
  });

  ipcMain.handle("git:diff", (_event, { workingDir }: { workingDir: string }) => {
    const git = new GitManager(workingDir);
    if (!git.isGitRepo()) return "";
    return git.getDiff();
  });
}

// ══════════════════════════════════
// Task Execution Loop
// ══════════════════════════════════

async function runExecutionLoop(projectId: string): Promise<void> {
  while (executionRunning) {
    if (executionPaused) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    const task = memoryManager.getNextPendingTask(projectId);
    if (!task) {
      executionRunning = false;
      mainWindow?.webContents.send("execution:all-complete", { projectId });
      break;
    }

    // 의존성 체크
    if (task.dependencies.length > 0) {
      const allDepsComplete = task.dependencies.every((depId) => {
        const depTask = memoryManager.getTask(depId);
        return depTask?.status === "completed" || depTask?.status === "skipped";
      });
      if (!allDepsComplete) {
        // 의존성 미충족 → 건너뛰고 다음 찾기
        memoryManager.updateTaskStatus(task.id, "queued");
        continue;
      }
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
  const relatedHandoffs: string[] = [];
  for (const depId of task.dependencies) {
    const handoff = memoryManager.getHandoff(depId);
    if (handoff) {
      relatedHandoffs.push(`## ${depId} Handoff\n${handoff.summary}\nFiles: ${handoff.filesChanged.join(", ")}\nDecisions: ${handoff.designDecisions.join("; ")}`);
    }
  }

  const systemPrompt = `너는 소프트웨어 개발자다. 아래 태스크를 완료하라.
완료 후 반드시 아래 JSON 형식으로 handoff를 출력하라:
{"handoff":{"summary":"무엇을 했는지","filesChanged":["파일"],"designDecisions":["결정"],"knownIssues":["이슈"],"nextTaskNotes":"다음 태스크 참고사항"}}`;

  const taskPrompt = `# 태스크: ${task.name}

## 설명
${task.description}

## 계획
${task.plan}

## 예상 변경 파일
${task.estimatedFiles.join(", ") || "없음"}

${relatedHandoffs.length > 0 ? `## 이전 태스크 Handoff\n${relatedHandoffs.join("\n\n")}` : ""}

## 검증 조건
${task.validation.auto.join(", ")}
${task.validation.manual ? `수동 확인: ${task.validation.manual}` : ""}`;

  try {
    const sdkChat = new SdkChat();

    sdkChat.on("stream", (data: { text: string }) => {
      mainWindow?.webContents.send("execution:task-progress", {
        taskId: task.id, eventType: "output", message: data.text,
      });
    });
    sdkChat.on("activity", (data: any) => {
      const eventType = data.type === "tool_use" ? "tool_call" : "thinking";
      memoryManager.addTaskLog(task.id, eventType, JSON.stringify(data).slice(0, 500));
      mainWindow?.webContents.send("execution:task-progress", {
        taskId: task.id, eventType, message: data.tool ?? data.type,
      });
    });

    const { response } = await sdkChat.send({
      message: taskPrompt,
      systemPrompt,
      workingDir: project.workingDir || ".",
    });

    const durationMs = Date.now() - startTime;

    // Handoff 추출
    let handoffData = null;
    try {
      const handoffMatch = response.match(/\{[\s\S]*"handoff"[\s\S]*\}/);
      if (handoffMatch) {
        const parsed = JSON.parse(handoffMatch[0]);
        handoffData = parsed.handoff;
      }
    } catch { /* 파싱 실패 */ }

    if (handoffData) {
      const { v4: uuid } = require("uuid");
      memoryManager.createHandoff({
        id: uuid(),
        taskId: task.id,
        projectId,
        summary: handoffData.summary ?? "",
        filesChanged: handoffData.filesChanged ?? [],
        designDecisions: handoffData.designDecisions ?? [],
        knownIssues: handoffData.knownIssues ?? [],
        nextTaskNotes: handoffData.nextTaskNotes,
      });
    }

    memoryManager.updateTaskCost(task.id, 0, durationMs);
    memoryManager.updateTaskStatus(task.id, "completed");
    memoryManager.addTaskLog(task.id, "complete", `완료 (${Math.round(durationMs / 1000)}초)`);

    mainWindow?.webContents.send("execution:task-completed", {
      taskId: task.id, handoff: handoffData, durationMs,
    });

    // 스프린트 완료 체크
    checkSprintCompletion(task.sprintId, projectId);

  } catch (err) {
    const durationMs = Date.now() - startTime;
    memoryManager.updateTaskCost(task.id, 0, durationMs);
    memoryManager.addTaskLog(task.id, "error", String(err).slice(0, 500));

    if (task.retryCount < 2) {
      memoryManager.incrementTaskRetry(task.id);
      memoryManager.updateTaskStatus(task.id, "pending");
      mainWindow?.webContents.send("execution:task-failed", {
        taskId: task.id, error: String(err).slice(0, 300), retryCount: task.retryCount + 1,
      });
    } else {
      memoryManager.updateTaskStatus(task.id, "failed");
      mainWindow?.webContents.send("execution:task-failed", {
        taskId: task.id, error: String(err).slice(0, 300), retryCount: task.retryCount + 1,
      });
    }
  }
}

function checkSprintCompletion(sprintId: string, projectId: string): void {
  const tasks = memoryManager.getTasks(sprintId);
  const allDone = tasks.every((t) => t.status === "completed" || t.status === "skipped");
  if (allDone) {
    memoryManager.updateSprintStatus(sprintId, "completed");
    mainWindow?.webContents.send("execution:sprint-completed", { sprintId });

    // 마일스톤 완료 체크
    const sprint = memoryManager.getSprintsByProject(projectId).find((s) => s.id === sprintId);
    if (sprint) {
      const milestoneId = sprint.milestoneId;
      const sprints = memoryManager.getSprints(milestoneId);
      const allSprintsDone = sprints.every((s) => s.status === "completed");
      if (allSprintsDone) {
        memoryManager.updateMilestoneStatus(milestoneId, "completed");
        mainWindow?.webContents.send("execution:milestone-completed", { milestoneId });

        // 다음 마일스톤 활성화
        const milestones = memoryManager.getMilestones(projectId);
        const nextMilestone = milestones.find((m) => m.status === "pending");
        if (nextMilestone) {
          memoryManager.updateMilestoneStatus(nextMilestone.id, "active");
          const nextSprints = memoryManager.getSprints(nextMilestone.id);
          if (nextSprints.length > 0) {
            memoryManager.updateSprintStatus(nextSprints[0].id, "active");
          }
        }
      } else {
        // 다음 스프린트 활성화
        const nextSprint = sprints.find((s) => s.status === "pending");
        if (nextSprint) {
          memoryManager.updateSprintStatus(nextSprint.id, "active");
        }
      }
    }
  }
}

// ── App Lifecycle ──

app.whenReady().then(async () => {
  initServices();
  registerIpcHandlers();
  createWindow();

  // Claude Code 설치 확인
  try {
    const { execSync } = require("child_process");
    const version = execSync("claude --version", { encoding: "utf-8", timeout: 5000, shell: true, windowsHide: true }).trim();
    mainWindow?.webContents.once("did-finish-load", () => {
      mainWindow?.webContents.send("system:claude-status", { installed: true, version });
    });
  } catch {
    mainWindow?.webContents.once("did-finish-load", () => {
      mainWindow?.webContents.send("system:claude-status", { installed: false });
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
