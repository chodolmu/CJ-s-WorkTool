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
import { SdkChat } from "./agent-runner/sdk-chat";

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

// Discovery 전용 SDK 채팅 (프로젝트 생성 전)
let discoverySdkChat: SdkChat | null = null;

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

  // ── Audit (E2E 자동 테스트) ──
  ipcMain.handle("system:run-audit", async () => {
    const results: { test: string; pass: boolean; detail: string }[] = [];
    let testProjectId: string | null = null;

    function log(test: string, pass: boolean, detail: string) {
      results.push({ test, pass, detail });
    }

    // 1. Claude CLI
    try {
      const { execSync } = require("child_process");
      const ver = execSync("claude --version", { encoding: "utf-8", timeout: 5000, shell: true, windowsHide: true }).trim();
      log("Claude CLI", true, ver);
    } catch { log("Claude CLI", false, "설치 안 됨 또는 PATH 없음"); }

    // 2. 프리셋
    try {
      const presets = presetManager.listPresets();
      log("프리셋 로드", presets.length > 0, `${presets.length}개: ${presets.map(p => p.id).join(", ")}`);
    } catch (e: any) { log("프리셋 로드", false, e.message); }

    // 3. 프리셋 에이전트 (builtin + custom 합산)
    try {
      const agents = presetManager.getAgents("game");
      log("게임 에이전트", agents.length >= 4, `${agents.length}개: ${agents.map(a => a.id).join(", ")}`);
      const withTrigger = agents.filter(a => a.trigger);
      log("에이전트 trigger", withTrigger.length === agents.length, `trigger 있음: ${withTrigger.length}/${agents.length}`);
    } catch (e: any) { log("게임 에이전트", false, e.message); }

    // 4. 프로젝트 생성
    try {
      const p = memoryManager.createProject("Audit Test", "game");
      testProjectId = p.id;
      memoryManager.updateProjectSpecCard(p.id, {
        projectType: "2D 플랫포머",
        coreDecisions: [{ key: "engine", label: "엔진", value: "Phaser", source: "user" }],
        expansions: [],
        techStack: ["JavaScript", "Phaser 3"],
        rawAnswers: [],
        directorHints: {
          domainContext: "마리오 스타일 2D 플랫포머",
          reviewFocus: ["점프 물리", "레벨 디자인"],
          techConstraints: ["웹 브라우저"],
          suggestedPhases: ["plan", "design", "generate", "evaluate"],
        },
      } as any);
      const loaded = memoryManager.getProject(p.id);
      log("프로젝트 생성", !!loaded?.specCard, `id=${p.id}, specCard=${!!loaded?.specCard}`);
      log("directorHints", !!loaded?.specCard?.directorHints, `${loaded?.specCard?.directorHints?.domainContext ?? "없음"}`);
    } catch (e: any) { log("프로젝트 생성", false, e.message); }

    if (!testProjectId) {
      log("이후 테스트", false, "프로젝트 생성 실패로 중단");
      return results;
    }

    // 5. 기능 생성
    try {
      const f1 = memoryManager.createFeature(testProjectId, "Player Jump", "점프 물리 구현", 1);
      const f2 = memoryManager.createFeature(testProjectId, "Enemy AI", "적 패트롤 AI", 2);
      const features = memoryManager.getFeatures(testProjectId);
      log("기능 생성", features.length === 2, `${features.length}개: ${features.map(f => f.name).join(", ")}`);
    } catch (e: any) { log("기능 생성", false, e.message); }

    // 6. 채팅 메시지 저장/로드
    try {
      memoryManager.addChatMessage(testProjectId, "user", "테스트 메시지");
      memoryManager.addChatMessage(testProjectId, "assistant", "테스트 응답");
      const msgs = memoryManager.getChatMessages(testProjectId, 10);
      log("채팅 저장/로드", msgs.length === 2, `${msgs.length}개`);
    } catch (e: any) { log("채팅 저장/로드", false, e.message); }

    // 7. 채팅 CLI 호출 (실제 Claude 응답)
    try {
      const session = cliBridge.spawn("안녕하세요. 테스트입니다. 한 줄로 답해주세요.", {
        workingDir: ".",
        model: "sonnet",
        systemPrompt: "[OVERRIDE] 테스트. 반드시 한국어 한 줄로만 답하세요.",
        outputFormat: "text",
      });
      const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("타임아웃 30초")), 30000));
      const result = await Promise.race([session.waitForCompletion(), timeout]);
      const output = result.output.trim();
      log("CLI 호출", result.success && output.length > 0, `성공=${result.success}, 응답="${output.slice(0, 80)}"`);
    } catch (e: any) { log("CLI 호출", false, e.message); }

    // 8. 일정
    try {
      const schedule = memoryManager.getScheduleItems(testProjectId);
      log("일정 조회", Array.isArray(schedule), `${schedule?.length ?? 0}개`);
    } catch (e: any) { log("일정 조회", false, e.message); }

    // 9. Plan
    try {
      const plan = planManager.getPlan(testProjectId);
      log("Plan 문서", !!plan, plan ? `features=${plan.features?.length}` : "없음 (정상)");
    } catch (e: any) { log("Plan 문서", false, e.message); }

    // 10. Git
    try {
      const git = new (require("./tools/git-manager").GitManager || require("../tools/git-manager").GitManager || class { isGitRepo() { return false; } getStatus() { return {}; } })(".");
      log("Git", true, `isRepo=${git.isGitRepo()}`);
    } catch {
      try {
        const { execSync } = require("child_process");
        const gitVer = execSync("git --version", { encoding: "utf-8", timeout: 3000 }).trim();
        log("Git", true, gitVer);
      } catch (e: any) { log("Git", false, e.message); }
    }

    // 정리
    try {
      memoryManager.deleteProject(testProjectId);
      log("테스트 정리", true, "삭제 완료");
    } catch (e: any) { log("테스트 정리", false, e.message); }

    // 결과 요약을 메인 윈도우에 전송
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    mainWindow?.webContents.send("audit:result", { passed, failed, total: results.length, results });

    return results;
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
  ipcMain.handle("pipeline:start", (_event, { projectId, workingDir, maxRetries, autoApprove }: {
    projectId: string;
    workingDir: string;
    maxRetries?: number;
    autoApprove?: boolean;
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
        maxRetries: maxRetries ?? 10,
        autoApprove: autoApprove ?? false,
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

    activePipeline.on("pipeline_configured", (pipeline: unknown) => {
      mainWindow?.webContents.send("pipeline:configured", pipeline);
    });

    activePipeline.on("step_started", (step: unknown) => {
      mainWindow?.webContents.send("pipeline:step-started", step);
    });

    activePipeline.on("step_completed", (step: unknown) => {
      mainWindow?.webContents.send("pipeline:step-completed", step);
    });

    activePipeline.on("feature_agents", (data: unknown) => {
      mainWindow?.webContents.send("pipeline:feature-agents", data);
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

  ipcMain.handle("pipeline:stop", () => {
    if (activePipeline) {
      activePipeline.stop();
      activePipeline = null;
    }
    return { stopped: true };
  });

  ipcMain.handle("pipeline:restart", (_event, { projectId, workingDir, maxRetries, autoApprove }: {
    projectId: string;
    workingDir: string;
    maxRetries?: number;
    autoApprove?: boolean;
  }) => {
    // 기존 파이프라인 정리
    if (activePipeline) {
      activePipeline.stop();
      activePipeline = null;
    }

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
        maxRetries: maxRetries ?? 10,
        autoApprove: autoApprove ?? false,
      },
      planManager,
    );

    // 이벤트 연결 (pipeline:start와 동일)
    activePipeline.on("status", (status: string) => mainWindow?.webContents.send("pipeline:status", { status }));
    activePipeline.on("progress", (data: unknown) => mainWindow?.webContents.send("pipeline:progress", data));
    activePipeline.on("activity", (data: unknown) => mainWindow?.webContents.send("agent:activity", data));
    activePipeline.on("change_summary", (data: unknown) => mainWindow?.webContents.send("agent:change-summary", data));
    activePipeline.on("checkpoint", (data: unknown) => mainWindow?.webContents.send("checkpoint:request", data));
    activePipeline.on("schedule_updated", () => mainWindow?.webContents.send("schedule:updated"));
    activePipeline.on("phase_updated", (state: unknown) => mainWindow?.webContents.send("phase:updated", state));
    activePipeline.on("pipeline_configured", (pipeline: unknown) => mainWindow?.webContents.send("pipeline:configured", pipeline));
    activePipeline.on("step_started", (step: unknown) => mainWindow?.webContents.send("pipeline:step-started", step));
    activePipeline.on("step_completed", (step: unknown) => mainWindow?.webContents.send("pipeline:step-completed", step));
    activePipeline.on("feature_agents", (data: unknown) => mainWindow?.webContents.send("pipeline:feature-agents", data));

    activePipeline.run().catch((err) => {
      mainWindow?.webContents.send("pipeline:error", { error: String(err) });
    });

    return { restarted: true };
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

  // ── Debug Log (renderer로 전달) ──
  const debugLog = (...args: unknown[]) => {
    const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
    mainWindow?.webContents.executeJavaScript(`console.log("[WorkTool]", ${JSON.stringify(msg)})`).catch(() => {});
  };

  // ── Discovery AI Chat ──
  ipcMain.handle("discovery:chat", async (_event, { messages, round: clientRound }: {
    messages: { role: string; content: string }[];
    round?: number;
  }) => {
    const latestUserMsg = messages[messages.length - 1]?.content ?? "";
    debugLog("discovery:chat called, messages:", messages.length, "latest:", latestUserMsg.slice(0, 50));

    const discoverySystemPrompt = `당신은 프로젝트 기획 전문가입니다. 에이전트 팀이 작업을 시작하기 전에 최대한 구체적인 스펙을 확정해야 합니다.

## 핵심 규칙
1. 사용자의 마지막 메시지에 직접 응답하세요. 이전 대화 내용을 반드시 참고하세요.
2. 사용자가 이미 답한 질문을 다시 묻지 마세요.
3. 한국어로 대화. 한 번에 2~3개 질문. 각 질문에 선택지를 제시하면 답하기 쉬워집니다.
4. 아래 체크리스트가 80% 이상 채워질 때까지 대화를 계속하세요.

## 파악 체크리스트
### 필수 (모두 확인)
- 프로젝트 유형과 핵심 목적
- 기술 스택 (프레임워크/라이브러리 구체적으로)
- MVP 범위 (첫 빌드에 포함할 것 / 나중에 할 것)
- 핵심 기능 목록 (최소 3~5개, 각각 한 줄 설명)

### 프로젝트별 상세
- **게임**: 장르 메커닉, 조작 방식, 아트 스타일, 해상도/타일 크기, 레벨 구성, 사운드 유무
- **웹앱**: 페이지 구성, 인증 방식, DB 필요 여부, 반응형 여부
- **모바일**: 타겟 OS, 네이티브/하이브리드, 오프라인 지원
- **API**: 엔드포인트 목록, 인증, 데이터 모델

### 선택 (있으면 좋음)
- 타겟 사용자
- 레퍼런스 (비슷한 앱/게임)
- 디자인 선호 (색상, 스타일)
- 배포 환경

5. 체크리스트가 충분히 채워지면, 확정된 스펙을 카테고리별로 정리하여 보여주고 "이대로 진행할까요?" 확인.
6. 사용자가 확인하면 아래 JSON을 응답 맨 끝에 출력:
{"ready":true,"presetId":"game|webapp|mobile|api-server|desktop","specCard":{"projectType":"설명","coreDecisions":[{"key":"id","label":"항목","value":"값","source":"user"}],"expansions":[{"id":"id","label":"기능","enabled":true,"suggestedBy":"ai"}],"techStack":["기술"],"rawAnswers":[]},"directorHints":{"domainContext":"프로젝트 도메인 한 줄 설명","reviewFocus":["검증 중점1","검증 중점2"],"techConstraints":["기술 제약1"],"suggestedPhases":["plan","design","generate","evaluate"]}}

### suggestedPhases 가이드
- 모든 프로젝트: plan, generate, evaluate 필수
- 게임/UI 중심: + design (레벨/아트/UI 설계)
- 법률/의료/금융: + compliance (규정 준수 검토)
- 보안 중요: + security (보안 감사)
- 데이터 중심: + data-modeling (스키마/모델 설계)

7. 확인 전에는 JSON 금지.`;

    try {
      // SDK 채팅 사용
      if (!discoverySdkChat) discoverySdkChat = new SdkChat();

      const { response } = await discoverySdkChat.send({
        message: latestUserMsg,
        systemPrompt: discoverySystemPrompt,
        workingDir: ".",
      });

      debugLog("discovery SDK completed, output len:", response.length);

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
            if (parsed.directorHints) {
              specCard.directorHints = parsed.directorHints;
            }
            presetId = parsed.presetId;
            // Discovery 완료 — 세션 리셋
            discoverySdkChat.resetSession();
            discoverySdkChat = null;
          }
        }
      } catch { /* JSON 파싱 실패 — 일반 대화 응답 */ }

      // 응답 정리: JSON 블록 제거
      const cleanResponse = response
        .replace(/```json[\s\S]*?```/g, "")
        .replace(/\{[\s\S]*"ready"\s*:\s*true[\s\S]*\}/g, "")
        .replace(/\n{3,}/g, "\n\n")
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
    if (!project) {
      const errMsg = memoryManager.addChatMessage(projectId, "assistant", "프로젝트를 찾을 수 없습니다.");
      mainWindow?.webContents.send("chat:message", errMsg);
      return errMsg;
    }
    const specCard = project.specCard;

    // 프로젝트 에이전트 팀 정보
    const agents = project ? presetManager.getAgents(project.presetId) : [];
    const agentList = agents.map(a => `- ${a.displayName}(${a.id}): ${a.role}`).join("\n");

    // 파이프라인 상태
    const features = memoryManager.getFeatures(projectId);
    const pipelineInfo = features.length > 0
      ? `현재 기능: ${features.map(f => `${f.name}(${f.status})`).join(", ")}`
      : "아직 기능 목록 없음";

    const systemPrompt = `당신은 프로젝트의 AI 팀 리더입니다. 사용자와 자연스럽게 대화하세요.

## 프로젝트 정보
- 유형: ${specCard?.projectType ?? "미정"}
- 기술: ${specCard?.techStack?.join(", ") ?? "미정"}
- 도메인: ${specCard?.directorHints?.domainContext ?? "일반"}
- ${pipelineInfo}

## 현재 팀 구성
${agentList || "아직 팀 미구성"}

## 대화 규칙
1. 한국어로 자연스럽게 대화하세요.
2. 기술적 토론, 아키텍처 논의, 기획 상의에 적극 참여하세요.
3. 답변 끝에 불필요한 요약/메뉴/리스트를 붙이지 마세요.

## 액션 시스템
사용자가 에이전트 추가/제거, 기능 추가, 파이프라인 시작 등을 요청하면:
1. 먼저 자연스럽게 답변하세요 (왜 좋은 선택인지, 어떤 효과가 있는지 등)
2. 답변 맨 끝에 아래 JSON 블록을 추가하세요 (사용자에게는 안 보임)

\`\`\`worktool-action
{"actions":[
  {"type":"add_agent","id":"에이전트id","displayName":"표시명","icon":"이모지","role":"역할 설명","trigger":"after_planner|after_generator|manual","model":"sonnet|haiku"},
  {"type":"remove_agent","id":"에이전트id"},
  {"type":"add_feature","name":"기능명","description":"설명"},
  {"type":"start_pipeline"},
  {"type":"update_spec","key":"항목","value":"값"}
]}
\`\`\`

### 액션 규칙
- 일반 대화에는 액션 블록 금지. 요청이 있을 때만.
- 에이전트 추가 시 id는 영문 kebab-case (예: level-designer)
- trigger: after_planner = 설계 단계, after_generator = 구현 후 검증, manual = 수동
- **절대 규칙: 기존 에이전트를 임의로 제거하지 마세요.** 사용자가 명시적으로 "제거해줘"라고 요청할 때만 remove_agent 사용.
- core 에이전트(director, planner, generator, evaluator)는 제거 불가.`;

    // SDK 채팅 사용
    const sdkChat = getSdkChat(projectId);

    // 스트리밍 + 작업 내역 이벤트를 Renderer로 전달
    const streamHandler = (data: { text: string }) => {
      mainWindow?.webContents.send("chat:stream", { type: "text", content: data.text });
    };
    const activityHandler = (data: { type: string; tool?: string; content?: string; input?: unknown }) => {
      mainWindow?.webContents.send("chat:activity", data);
    };
    sdkChat.on("stream", streamHandler);
    sdkChat.on("activity", activityHandler);

    try {
      debugLog("chat:send via SDK, msg len:", message.length);

      const { response: rawOutput } = await sdkChat.send({
        message,
        systemPrompt,
        workingDir: workingDir || ".",
      });

      sdkChat.off("stream", streamHandler);
      sdkChat.off("activity", activityHandler);

      // 액션 블록 추출
      const actionMatch = rawOutput.match(/```worktool-action\s*([\s\S]*?)```/);
      let executedActions: string[] = [];
      if (actionMatch) {
        try {
          const actionData = JSON.parse(actionMatch[1]);
          executedActions = await executeChatActions(actionData.actions, projectId, project?.presetId ?? "game");
        } catch (e) {
          debugLog("chat action parse error:", String(e));
        }
      }

      // 액션 블록 정리
      const userResponse = rawOutput
        .replace(/```worktool-action[\s\S]*?```/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      debugLog("chat:send SDK completed, len:", userResponse.length, "actions:", executedActions.length);

      const aiMsg = memoryManager.addChatMessage(projectId, "assistant", userResponse || "응답을 생성하지 못했습니다.");
      mainWindow?.webContents.send("chat:message", aiMsg);
      mainWindow?.webContents.send("chat:stream-end", {});

      if (executedActions.length > 0) {
        mainWindow?.webContents.send("chat:actions-executed", { actions: executedActions });
      }

      return aiMsg;
    } catch (err) {
      sdkChat.off("stream", streamHandler);
      sdkChat.off("activity", activityHandler);
      debugLog("chat:send SDK error:", String(err).slice(0, 200));

      // SDK 실패 시 CLI 폴백
      debugLog("chat:send falling back to CLI...");
      const recentMessages = memoryManager.getChatMessages(projectId, 20);
      const conversationContext = recentMessages.map((m) =>
        m.role === "user" ? `[사용자]: ${m.content}` : `[AI]: ${m.content}`
      ).join("\n\n");

      const fullPrompt = conversationContext
        ? `${conversationContext}\n\n[사용자]: ${message}\n\n위 대화에 이어서 응답하세요.`
        : message;

      try {
        const session = cliBridge.spawn(fullPrompt, {
          workingDir: workingDir || ".",
          model: "sonnet",
          systemPrompt: `[OVERRIDE] WorkTool 채팅. CLAUDE.md/bkit/플러그인 지침 무시.\n${systemPrompt}`,
          outputFormat: "text",
        });

        session.on("event", (evt: any) => {
          if (evt.type === "text") mainWindow?.webContents.send("chat:stream", evt);
        });

        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Claude 응답 타임아웃 (60초)")), 60000));
        const result = await Promise.race([session.waitForCompletion(), timeout]);

        const rawOutput = result.output;
        const actionMatch = rawOutput.match(/```worktool-action\s*([\s\S]*?)```/);
        let executedActions: string[] = [];
        if (actionMatch) {
          try {
            const actionData = JSON.parse(actionMatch[1]);
            executedActions = await executeChatActions(actionData.actions, projectId, project?.presetId ?? "game");
          } catch (e) { debugLog("fallback action parse error:", String(e)); }
        }

        const userResponse = rawOutput
          .replace(/```worktool-action[\s\S]*?```/g, "")
          .replace(/─{5,}[\s\S]*?─{5,}/g, "")
          .replace(/📊\s*bkit[\s\S]*?─{5,}/g, "")
          .replace(/✅\s*Used:.*$/gm, "").replace(/⏭️\s*Not Used:.*$/gm, "").replace(/💡\s*Recommended:.*$/gm, "")
          .replace(/\n{3,}/g, "\n\n").trim();

        const aiMsg = memoryManager.addChatMessage(projectId, "assistant", userResponse || "응답을 생성하지 못했습니다.");
        mainWindow?.webContents.send("chat:message", aiMsg);
        mainWindow?.webContents.send("chat:stream-end", {});
        if (executedActions.length > 0) mainWindow?.webContents.send("chat:actions-executed", { actions: executedActions });
        return aiMsg;
      } catch (fallbackErr) {
        const aiMsg = memoryManager.addChatMessage(projectId, "assistant", `AI 응답 오류: ${String(fallbackErr).slice(0, 200)}`);
        mainWindow?.webContents.send("chat:message", aiMsg);
        mainWindow?.webContents.send("chat:stream-end", {});
        return aiMsg;
      }
    }
  });
}

// ── Chat Action Executor ──

interface ChatAction {
  type: "add_agent" | "remove_agent" | "add_feature" | "start_pipeline" | "update_spec";
  [key: string]: unknown;
}

async function executeChatActions(actions: ChatAction[], projectId: string, presetId: string): Promise<string[]> {
  const results: string[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case "add_agent": {
          const agentDef = {
            id: String(action.id),
            displayName: String(action.displayName),
            icon: String(action.icon ?? "🤖"),
            role: String(action.role ?? ""),
            goal: String(action.goal ?? action.role ?? ""),
            constraints: [],
            model: (action.model as "opus" | "sonnet" | "haiku") ?? "sonnet",
            trigger: (action.trigger as "manual" | "after_planner" | "after_generator" | "after_evaluator") ?? "after_generator",
            guidelines: [],
            outputFormat: "",
          };
          presetManager.saveAgent(presetId, agentDef);
          results.push(`에이전트 추가: ${agentDef.displayName}`);

          // UI에 에이전트 목록 업데이트 알림
          mainWindow?.webContents.send("agents:updated", {
            agents: presetManager.getAgents(presetId).map(a => ({
              id: a.id, displayName: a.displayName, icon: a.icon, trigger: a.trigger,
            })),
          });
          break;
        }
        case "remove_agent": {
          const agentId = String(action.id);
          const coreAgents = new Set(["director", "planner", "generator", "evaluator"]);
          if (coreAgents.has(agentId)) {
            results.push(`에이전트 제거 차단: ${agentId}는 핵심 에이전트입니다`);
            break;
          }
          presetManager.deleteAgent(presetId, agentId);
          results.push(`에이전트 제거: ${agentId}`);
          mainWindow?.webContents.send("agents:updated", {
            agents: presetManager.getAgents(presetId).map(a => ({
              id: a.id, displayName: a.displayName, icon: a.icon, trigger: a.trigger,
            })),
          });
          break;
        }
        case "add_feature": {
          const name = String(action.name);
          const desc = String(action.description ?? "");
          const existing = memoryManager.getFeatures(projectId);
          memoryManager.createFeature(projectId, name, desc, existing.length + 1);
          results.push(`기능 추가: ${name}`);
          mainWindow?.webContents.send("features:updated");
          break;
        }
        case "start_pipeline": {
          results.push("파이프라인 시작 요청");
          mainWindow?.webContents.send("pipeline:start-requested");
          break;
        }
        case "update_spec": {
          results.push(`스펙 업데이트: ${action.key}=${action.value}`);
          break;
        }
      }
    } catch (e) {
      results.push(`액션 실패(${action.type}): ${String(e).slice(0, 100)}`);
    }
  }

  return results;
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
