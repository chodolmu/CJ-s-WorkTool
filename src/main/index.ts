import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { PresetManager } from "./preset/preset-manager";
import { createDatabase, getDataDir } from "./memory/database";
import { MemoryManager } from "./memory/memory-manager";
import { CLIBridge } from "./agent-runner/cli-bridge";
import { PromptAssembler } from "./agent-runner/prompt-assembler";
import { Pipeline } from "./orchestrator/pipeline";
import { SessionManager } from "./memory/session-manager";
import { GuidelineGenerator } from "./agent-runner/guideline-generator";
import { classifyTask, type ExecutionMode } from "./orchestrator/task-router";
import { SmartOrchestrator } from "./orchestrator/smart-orchestrator";
import { GitManager } from "./tools/git-manager";

let mainWindow: BrowserWindow | null = null;
let presetManager: PresetManager;
let memoryManager: MemoryManager;
let cliBridge: CLIBridge;
let promptAssembler: PromptAssembler;
let activePipeline: Pipeline | null = null;
let sessionManager: SessionManager;
let guidelineGenerator: GuidelineGenerator;
let orchestrator: SmartOrchestrator;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: "#0a0a0a",
    titleBarStyle: "hiddenInset",
    frame: process.platform === "darwin" ? false : true,
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
  // Preset Manager
  const builtinPresetsDir = app.isPackaged
    ? path.join(process.resourcesPath, "presets")
    : path.join(__dirname, "../../resources/presets");
  const customPresetsDir = path.join(getDataDir(), "presets", "custom");

  presetManager = new PresetManager(builtinPresetsDir, customPresetsDir);

  // Database + Memory Manager
  const db = createDatabase();
  memoryManager = new MemoryManager(db);

  // Agent Runner
  cliBridge = new CLIBridge();
  promptAssembler = new PromptAssembler(presetManager, memoryManager);

  // Session Manager
  sessionManager = new SessionManager(memoryManager, cliBridge);

  // Guideline Generator
  guidelineGenerator = new GuidelineGenerator(cliBridge, memoryManager, presetManager);

  // Smart Orchestrator
  orchestrator = new SmartOrchestrator(cliBridge, promptAssembler, memoryManager, presetManager);
}

function registerIpcHandlers(): void {
  // ── App ──
  ipcMain.handle("app:get-version", () => app.getVersion());

  // ── System Check ──
  ipcMain.handle("system:check-claude-code", async () => {
    try {
      const { execSync } = require("child_process");
      const version = execSync("claude --version", {
        encoding: "utf-8",
        timeout: 5000,
        shell: true,
        windowsHide: true,
      }).trim();
      return { installed: true, version };
    } catch {
      return { installed: false, version: null, message: "Claude Code is not installed or not in PATH. Install it from https://docs.anthropic.com/en/docs/claude-code" };
    }
  });

  // ── Presets ──
  ipcMain.handle("preset:list", () => {
    return presetManager.listPresets();
  });

  ipcMain.handle("preset:get", (_event, { presetId }: { presetId: string }) => {
    return presetManager.getPreset(presetId);
  });

  ipcMain.handle("preset:save", (_event, { preset }: { preset: unknown }) => {
    // Preset-level save는 현재 미지원 (에이전트 단위 저장만 지원)
    return { ok: true };
  });

  // ── Discovery ──
  ipcMain.handle("discovery:start", (_event, { presetId }: { presetId: string }) => {
    const preset = presetManager.getPreset(presetId);
    if (!preset) return { error: "Preset not found" };
    return {
      preset,
      questions: preset.discoveryQuestions,
    };
  });

  ipcMain.handle("discovery:answer", (_event, { questionId, answer }: { questionId: string; answer: string }) => {
    // Discovery 답변은 Renderer의 Zustand 스토어에서 관리
    // 이 핸들러는 조건부 질문 로직이 필요할 때 사용
    return { ok: true };
  });

  ipcMain.handle("discovery:complete", (_event, { projectName, presetId, specCard, workingDir, agents }: {
    projectName: string;
    presetId: string;
    specCard: unknown;
    workingDir?: string;
    agents?: unknown[];
  }) => {
    const project = memoryManager.createProject(projectName, presetId, workingDir, agents);
    memoryManager.updateProjectSpecCard(project.id, specCard as Parameters<typeof memoryManager.updateProjectSpecCard>[1]);
    memoryManager.updateProjectStatus(project.id, "planning");
    return project;
  });

  // ── Projects ──
  ipcMain.handle("project:list", () => {
    return memoryManager.listProjects();
  });

  ipcMain.handle("project:load", (_event, { projectId }: { projectId: string }) => {
    return memoryManager.getProject(projectId);
  });

  ipcMain.handle("project:create", (_event, { name, presetId }: { name: string; presetId: string }) => {
    return memoryManager.createProject(name, presetId);
  });

  // 앱 시작 시 마지막 프로젝트 자동 로드
  ipcMain.handle("project:load-last", () => {
    const project = memoryManager.getLastProject();
    if (!project) return null;

    const features = memoryManager.getFeatures(project.id);
    const lastSession = memoryManager.getLastSessionSummary(project.id);

    return {
      project,
      features,
      lastSessionSummary: lastSession,
    };
  });

  // ── Sessions ──
  ipcMain.handle("session:start", (_event, { projectId }: { projectId: string }) => {
    const sessionId = sessionManager.startSession(projectId);
    return { sessionId };
  });

  ipcMain.handle("session:end", async () => {
    await sessionManager.endSession();
    return { ok: true };
  });

  // ── Agent CRUD ──
  ipcMain.handle("agent:save", (_event, { presetId, agent }: { presetId: string; agent: unknown }) => {
    presetManager.saveAgent(presetId, agent as Parameters<typeof presetManager.saveAgent>[1]);
    return { ok: true };
  });

  ipcMain.handle("agent:delete", (_event, { presetId, agentId }: { presetId: string; agentId: string }) => {
    const deleted = presetManager.deleteAgent(presetId, agentId);
    return { ok: deleted };
  });

  // ── Activities ──
  ipcMain.handle("activities:list", (_event, { projectId, limit, offset }: {
    projectId: string;
    limit?: number;
    offset?: number;
  }) => {
    return memoryManager.getActivities(projectId, limit ?? 100, offset ?? 0);
  });

  // ── Agent Guidelines ──
  ipcMain.handle("agent:generate-guidelines", async (_event, { projectId, presetId, description }: {
    projectId: string;
    presetId: string;
    description: string;
  }) => {
    return guidelineGenerator.generate({ projectId, presetId, roughDescription: description });
  });

  // ── Pipeline ──
  ipcMain.handle("pipeline:start", (_event, { projectId, workingDir }: {
    projectId: string;
    workingDir: string;
  }) => {
    const project = memoryManager.getProject(projectId);
    if (!project || !project.specCard) return { error: "Project or spec not found" };

    activePipeline = new Pipeline(
      cliBridge,
      promptAssembler,
      memoryManager,
      presetManager,
      {
        projectId,
        presetId: project.presetId,
        workingDir,
        specCard: project.specCard,
        maxRetries: 3,
      },
    );

    // 이벤트를 Renderer로 전달
    activePipeline.on("status", (status: string) => {
      mainWindow?.webContents.send("pipeline:status", { status });
    });

    activePipeline.on("progress", (data: unknown) => {
      mainWindow?.webContents.send("pipeline:progress", data);
    });

    activePipeline.on("activity", (data: unknown) => {
      mainWindow?.webContents.send("agent:activity", data);
    });

    activePipeline.on("change_summary", (data: unknown) => {
      mainWindow?.webContents.send("agent:change-summary", data);
    });

    activePipeline.on("checkpoint", (data: unknown) => {
      mainWindow?.webContents.send("checkpoint:request", data);
    });

    // 비동기 실행 시작
    activePipeline.run().catch((err) => {
      mainWindow?.webContents.send("pipeline:error", { error: String(err) });
    });

    return { started: true };
  });

  ipcMain.handle("pipeline:pause", () => {
    activePipeline?.pause();
    return { paused: true };
  });

  ipcMain.handle("pipeline:resume", () => {
    if (activePipeline && activePipeline.status === "paused") {
      activePipeline.resume();
    }
    return { resumed: true };
  });

  ipcMain.handle("checkpoint:respond", (_event, { action }: { action: string }) => {
    activePipeline?.respondToCheckpoint(action);
    return { ok: true };
  });

  ipcMain.handle("decision:respond", (_event, { answer }: { answer: string }) => {
    orchestrator?.respondToDecision(answer);
    return { ok: true };
  });

  // ── Project Delete ──
  ipcMain.handle("project:delete", (_event, { projectId }: { projectId: string }) => {
    memoryManager.deleteProject(projectId);
    return { ok: true };
  });

  // ── Chat ──
  ipcMain.handle("chat:history", (_event, { projectId, limit, offset }: {
    projectId: string;
    limit?: number;
    offset?: number;
  }) => {
    return memoryManager.getChatMessages(projectId, limit ?? 100, offset ?? 0);
  });

  // ── Discovery AI Chat ──
  ipcMain.handle("discovery:chat", async (_event, { messages, specContext }: {
    messages: { role: string; content: string }[];
    specContext?: string;
  }) => {
    // 전체 대화 히스토리를 Claude에게 보내서 프로젝트 분석 요청
    const conversationText = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
    const round = messages.filter((m) => m.role === "user").length;

    const systemPrompt = `당신은 소프트웨어 프로젝트 기획 전문가입니다. 사용자가 만들고 싶은 프로젝트를 대화를 통해 파악하세요.

규칙:
- 한국어로 대화하세요
- 친근하고 구체적으로 질문하세요
- 한 번에 1~2개 질문만 하세요
- 사용자가 충분한 정보를 제공했다고 판단되면 (보통 3~4번 대화 후) JSON 형태의 스펙 카드를 생성하세요

${round >= 3 ? `사용자가 충분한 정보를 주었습니다. 다음 JSON 형식으로 스펙 카드를 생성하세요:
\`\`\`json
{
  "ready": true,
  "presetId": "game" 또는 "webapp",
  "specCard": {
    "projectType": "프로젝트 유형",
    "coreDecisions": [{"key": "id", "label": "질문", "value": "답변", "source": "user"}],
    "expansions": [{"id": "id", "label": "기능명", "enabled": true/false, "suggestedBy": "ai"}],
    "techStack": ["기술1", "기술2"]
  }
}
\`\`\`
스펙 카드 JSON과 함께 "프로젝트를 정리했습니다!" 라는 메시지를 포함하세요.` : "아직 정보가 부족합니다. 추가 질문을 하세요."}`;

    try {
      const session = cliBridge.spawn(conversationText, {
        workingDir: ".",
        model: "sonnet",
        systemPrompt,
      });

      let output = "";
      session.on("event", (event: { type: string; content: string }) => {
        if (event.type === "text") output += event.content;
      });

      const result = await session.waitForCompletion();
      const response = output || result.output;

      // JSON 스펙 카드 추출 시도
      let specCard = null;
      let presetId = null;
      try {
        const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/\{[\s\S]*"ready"\s*:\s*true[\s\S]*\}/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          const parsed = JSON.parse(jsonStr);
          if (parsed.ready && parsed.specCard) {
            specCard = parsed.specCard;
            presetId = parsed.presetId;
          }
        }
      } catch { /* JSON 파싱 실패 — 일반 대화 응답 */ }

      // 응답에서 JSON 블록 제거 (사용자에게는 대화만 보여줌)
      const cleanResponse = response
        .replace(/```json[\s\S]*?```/g, "")
        .replace(/\{[\s\S]*"ready"\s*:\s*true[\s\S]*\}/g, "")
        .trim();

      return {
        response: cleanResponse || "프로젝트를 정리했습니다! 다음 화면에서 확인해주세요.",
        specCard,
        presetId,
      };
    } catch (err) {
      return {
        response: null,
        error: String(err),
      };
    }
  });

  // ── Phase State ──
  ipcMain.handle("phase:get", (_event, { projectId }: { projectId: string }) => {
    return memoryManager.getProjectPhaseState(projectId);
  });

  ipcMain.handle("phase:update", (_event, { projectId, phaseState }: { projectId: string; phaseState: unknown }) => {
    memoryManager.updateProjectPhaseState(projectId, phaseState);
    return { ok: true };
  });

  // ── Agent Learnings ──
  ipcMain.handle("learning:list", (_event, { projectId, agentId }: { projectId: string; agentId?: string }) => {
    return memoryManager.getLearnings(projectId, agentId);
  });

  ipcMain.handle("learning:add", (_event, { projectId, agentId, pattern, lesson, source }: {
    projectId: string; agentId: string; pattern: string; lesson: string; source: string;
  }) => {
    return memoryManager.addLearning(projectId, agentId, pattern, lesson, source);
  });

  // ── Project Skills ──
  ipcMain.handle("skill:list", (_event, { projectId }: { projectId: string }) => {
    return memoryManager.getSkills(projectId);
  });

  ipcMain.handle("skill:add", (_event, { projectId, name, description, pattern, template }: {
    projectId: string; name: string; description: string; pattern: string; template: string;
  }) => {
    return memoryManager.addSkill(projectId, name, description, pattern, template);
  });

  ipcMain.handle("skill:delete", (_event, { skillId }: { skillId: string }) => {
    memoryManager.deleteSkill(skillId);
    return { ok: true };
  });

  // ── Git ──
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

  // 작업 크기 분류 (UI에서 미리보기용)
  ipcMain.handle("chat:classify", (_event, { message }: { message: string }) => {
    return classifyTask(message);
  });

  ipcMain.handle("chat:send", async (_event, { projectId, message, workingDir, mode: forceMode }: {
    projectId: string;
    message: string;
    workingDir: string;
    mode?: ExecutionMode;
  }) => {
    // 사용자 메시지 저장
    const userMsg = memoryManager.addChatMessage(projectId, "user", message);
    mainWindow?.webContents.send("chat:message", userMsg);

    const project = memoryManager.getProject(projectId);

    // 모드 결정
    const classification = classifyTask(message);
    const mode = forceMode ?? classification.mode;

    mainWindow?.webContents.send("chat:mode", { mode, confidence: classification.confidence });

    if ((mode === "light" || mode === "full") && project?.specCard) {
      // ── Light/Full Mode: SmartOrchestrator 사용 ──
      const agents = presetManager.getAgents(project.presetId);

      orchestrator.on("activity", (data: unknown) => {
        mainWindow?.webContents.send("agent:activity", data);
      });

      orchestrator.on("stream", (data: unknown) => {
        mainWindow?.webContents.send("chat:stream", data);
      });

      orchestrator.on("decision-needed", (data: unknown) => {
        mainWindow?.webContents.send("decision:request", data);
      });

      orchestrator.on("status", (data: { phase: string; message: string }) => {
        mainWindow?.webContents.send("chat:stream", {
          type: "text",
          content: `\n**[${data.phase}]** ${data.message}\n`,
        });
      });

      const result = await orchestrator.handleRequest({
        projectId,
        presetId: project.presetId,
        workingDir,
        userMessage: message,
        specCard: project.specCard,
        agents,
        forceMode: mode,
      });

      // 리스너 정리
      orchestrator.removeAllListeners("activity");
      orchestrator.removeAllListeners("stream");
      orchestrator.removeAllListeners("status");
      orchestrator.removeAllListeners("decision-needed");

      const aiMsg = memoryManager.addChatMessage(projectId, "assistant",
        result.success
          ? `✅ Done (${result.mode} mode)\n\n${result.summary}`
          : `❌ Failed (${result.mode} mode)\n\n${result.summary}`,
      );
      mainWindow?.webContents.send("chat:message", aiMsg);
      mainWindow?.webContents.send("chat:stream-end", {});
      return aiMsg;

    } else {
      // ── Direct Mode: Claude 1회 호출 (채팅) ──

      // 이전 대화 히스토리를 컨텍스트로 포함 (최근 10개)
      const recentMessages = memoryManager.getChatMessages(projectId, 10);
      const historyContext = recentMessages.length > 0
        ? "\n\n## 이전 대화 히스토리:\n" + recentMessages.map((m) =>
            `${m.role === "user" ? "사용자" : "AI"}: ${m.content.slice(0, 300)}`
          ).join("\n")
        : "";

      // 최근 활동 로그 (에이전트가 뭘 했는지)
      const recentActivities = memoryManager.getActivities(projectId, 5);
      const activityContext = recentActivities.length > 0
        ? "\n\n## 최근 에이전트 활동:\n" + recentActivities.map((a) =>
            `- [${a.agentId}] ${a.message}`
          ).join("\n")
        : "";

      const systemPrompt = project?.specCard
        ? `당신은 "${project.name}" 프로젝트의 AI 어시스턴트입니다.
프로젝트 유형: ${project.specCard.projectType}
기술 스택: ${project.specCard.techStack.join(", ")}
작업 폴더: ${workingDir}

사용자와 한국어로 대화하세요. 이전 대화와 에이전트 활동을 참고하여 맥락에 맞는 답변을 하세요.
"아까 그거", "방금 만든 것" 같은 표현은 이전 대화/활동을 참조하여 이해하세요.${historyContext}${activityContext}`
        : undefined;

      const session = cliBridge.spawn(message, {
        workingDir,
        model: "sonnet",
        systemPrompt,
      });

      let fullOutput = "";

      session.on("event", (event: { type: string; content: string }) => {
        mainWindow?.webContents.send("chat:stream", {
          type: event.type,
          content: event.content,
        });
        if (event.type === "text") {
          fullOutput += event.content;
        }
      });

      const result = await session.waitForCompletion();
      const responseContent = fullOutput || result.output || "No response received.";

      const aiMsg = memoryManager.addChatMessage(projectId, "assistant", responseContent);
      mainWindow?.webContents.send("chat:message", aiMsg);
      mainWindow?.webContents.send("chat:stream-end", {});
      return aiMsg;
    }
  });
}

// ── App Lifecycle ──

app.whenReady().then(async () => {
  initServices();
  registerIpcHandlers();
  createWindow();

  // 앱 시작 시 Claude Code 설치 자동 체크
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

// 앱 종료 전 세션 자동 종료
app.on("before-quit", async () => {
  await sessionManager?.endSession();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
