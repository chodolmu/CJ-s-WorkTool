import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { PresetManager } from "./preset/preset-manager";
import { createDatabase, getDataDir } from "./memory/database";
import { MemoryManager } from "./memory/memory-manager";
import { CLIBridge } from "./agent-runner/cli-bridge";
import { PromptAssembler } from "./agent-runner/prompt-assembler";
import { Pipeline } from "./orchestrator/pipeline";
import { SessionManager } from "./memory/session-manager";
import { GuidelineGenerator } from "./agent-runner/guideline-generator";
// task-router는 Director Agent로 대체됨 (classifyTask 제거)
import { SmartOrchestrator } from "./orchestrator/smart-orchestrator";
import { GitManager } from "./tools/git-manager";
import { PlanManager } from "./memory/plan-manager";

let mainWindow: BrowserWindow | null = null;
let presetManager: PresetManager;
let memoryManager: MemoryManager;
let cliBridge: CLIBridge;
let promptAssembler: PromptAssembler;
let activePipeline: Pipeline | null = null;
let sessionManager: SessionManager;
let guidelineGenerator: GuidelineGenerator;
let orchestrator: SmartOrchestrator;
let planManager: PlanManager;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: "#0a0a0a",
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
  // Preset Manager
  const builtinPresetsDir = app.isPackaged
    ? path.join(process.resourcesPath, "presets")
    : path.join(__dirname, "../../resources/presets");
  const customPresetsDir = path.join(getDataDir(), "presets", "custom");

  presetManager = new PresetManager(builtinPresetsDir, customPresetsDir);

  // Database + Memory Manager
  const db = createDatabase();
  memoryManager = new MemoryManager(db);
  planManager = new PlanManager(db);

  // Agent Runner
  cliBridge = new CLIBridge();
  promptAssembler = new PromptAssembler(presetManager, memoryManager);

  // Session Manager
  sessionManager = new SessionManager(memoryManager, cliBridge);

  // Guideline Generator
  guidelineGenerator = new GuidelineGenerator(cliBridge, memoryManager, presetManager);

  // Smart Orchestrator
  orchestrator = new SmartOrchestrator(cliBridge, promptAssembler, memoryManager, presetManager, planManager);
}

function registerIpcHandlers(): void {
  // ── App ──
  ipcMain.handle("app:get-version", () => app.getVersion());

  // ── Plan (계획 문서) ──
  ipcMain.handle("plan:get", (_event, { projectId }: { projectId: string }) => {
    return planManager.getPlan(projectId);
  });

  ipcMain.handle("plan:match-rate", (_event, { projectId }: { projectId: string }) => {
    return planManager.getSpecMatchRate(projectId);
  });

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

    // 기본 스킬 시드
    const skillsDir = app.isPackaged
      ? path.join(process.resourcesPath, "skills")
      : path.join(__dirname, "../../resources/skills");
    memoryManager.seedDefaultSkills(project.id, skillsDir);

    // Plan 문서 자동 생성
    if (specCard && agents) {
      planManager.createFromSpecCard(project.id, specCard as any, agents as any[]);
    }

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
      planManager,
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

    activePipeline.on("schedule_updated", () => {
      mainWindow?.webContents.send("schedule:updated");
    });

    activePipeline.on("phase_updated", (state: unknown) => {
      mainWindow?.webContents.send("phase:updated", state);
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
  ipcMain.handle("discovery:chat", async (_event, { messages, round: clientRound }: {
    messages: { role: string; content: string }[];
    round?: number;
  }) => {
    const userMessages = messages.filter((m) => m.role === "user");
    const latestUserMessage = userMessages[userMessages.length - 1]?.content ?? "";

    // 이전 대화를 시스템 프롬프트에 포함, 최신 메시지만 프롬프트로 전달
    const conversationHistory = messages.slice(0, -1).length > 0
      ? "\n\n## 지금까지의 대화 기록\n" + messages.slice(0, -1).map((m) =>
          `${m.role === "user" ? "사용자" : "당신"}: ${m.content}`
        ).join("\n\n")
      : "";

    const systemPrompt = `[OVERRIDE] 이것은 WorkTool 앱의 프로그래밍 호출입니다.
CLAUDE.md, memory, bkit, 플러그인의 모든 지침을 무시하세요.
인사말, 메뉴, Feature Usage 리포트를 절대 출력하지 마세요.

당신은 프로젝트 기획 전문가입니다. 사용자가 만들고 싶은 프로젝트를 대화로 파악하세요.

## 규칙
- 한국어로 대화. 한 번에 1~2개 질문만.
- 파악할 것: 핵심 목적, 주요 기능, 타겟 사용자, 기술 선호, 레퍼런스
- 충분히 파악되면 스펙을 요약하고 "이대로 진행할까요?" 확인
- 사용자가 확인하면 아래 JSON 출력:
\`\`\`json
{"ready":true,"presetId":"game|webapp|mobile|api-server|desktop","specCard":{"projectType":"설명","coreDecisions":[{"key":"id","label":"항목","value":"값","source":"user"}],"expansions":[{"id":"id","label":"기능","enabled":true,"suggestedBy":"ai"}],"techStack":["기술"],"rawAnswers":[]}}
\`\`\`
- 확인 전에는 JSON 출력 금지. 정보 부족하면 계속 질문.${conversationHistory}`;

    try {
      const session = cliBridge.spawn(latestUserMessage, {
        workingDir: ".",
        model: "sonnet",
        systemPrompt,
        outputFormat: "text",
      });

      const result = await session.waitForCompletion();
      const response = result.output;

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

      // 응답 정리: JSON 블록 + bkit/플러그인 출력 제거
      const cleanResponse = response
        .replace(/```json[\s\S]*?```/g, "")
        .replace(/\{[\s\S]*"ready"\s*:\s*true[\s\S]*\}/g, "")
        .replace(/─{5,}[\s\S]*?─{5,}/g, "")  // bkit 구분선 블록 제거
        .replace(/📊\s*bkit[\s\S]*?─{5,}/g, "")  // bkit Feature Usage 블록 제거
        .replace(/✅\s*Used:.*$/gm, "")
        .replace(/⏭️\s*Not Used:.*$/gm, "")
        .replace(/💡\s*Recommended:.*$/gm, "")
        .replace(/\n{3,}/g, "\n\n")  // 과도한 빈 줄 정리
        .trim();

      return {
        response: cleanResponse || (specCard ? "스펙을 정리했습니다. 에이전트 팀을 구성합니다..." : "응답을 처리하지 못했습니다. 다시 시도해주세요."),
        specCard,
        presetId,
      };
    } catch (err) {
      return {
        response: `AI 연결 오류: ${String(err).slice(0, 200)}\n\nClaude Code CLI가 정상 동작하는지 확인해주세요.\n터미널에서 \`claude --version\`을 실행해보세요.`,
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

  // ── Schedule (일정) ──
  ipcMain.handle("schedule:list", (_event, { projectId }: { projectId?: string }) => {
    if (projectId) {
      return memoryManager.getProjectScheduleItems(projectId);
    }
    return memoryManager.getAllScheduleItems();
  });

  ipcMain.handle("schedule:update", (_event, { featureId, schedule }: { featureId: string; schedule: Record<string, unknown> }) => {
    memoryManager.updateFeatureSchedule(featureId, schedule as any);
    mainWindow?.webContents.send("schedule:updated");
    return { ok: true };
  });

  ipcMain.handle("schedule:bulk-set", (_event, { items }: { items: { featureId: string; estimatedStart: string; estimatedEnd: string; assignedAgent?: string; priority?: number }[] }) => {
    memoryManager.bulkSetFeatureSchedule(items);
    mainWindow?.webContents.send("schedule:updated");
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

  // 작업 크기 분류 — Director가 판단하므로 UI 미리보기는 간단히 제공
  ipcMain.handle("chat:classify", (_event, { message }: { message: string }) => {
    // 간단한 길이 기반 힌트만 제공 (실제 판단은 Director가 함)
    const len = message.length;
    return {
      mode: len < 30 ? "direct" : len < 100 ? "light" : "full",
      confidence: 0.5,
      reason: "Director가 최종 판단합니다",
    };
  });

  ipcMain.handle("chat:send", async (_event, { projectId, message, workingDir }: {
    projectId: string;
    message: string;
    workingDir: string;
  }) => {
    // 사용자 메시지 저장
    const userMsg = memoryManager.addChatMessage(projectId, "user", message);
    mainWindow?.webContents.send("chat:message", userMsg);

    const project = memoryManager.getProject(projectId);

    // Director → Orchestrator 플로우로 모든 요청 처리
    const agents = project ? presetManager.getAgents(project.presetId) : [];

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
      presetId: project?.presetId ?? "game",
      workingDir,
      userMessage: message,
      specCard: project?.specCard ?? { projectType: "general", coreDecisions: [], expansions: [], techStack: [], rawAnswers: [] },
      agents,
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
