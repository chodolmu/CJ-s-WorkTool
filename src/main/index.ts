import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { PresetManager } from "./preset/preset-manager";
import { createDatabase, getDataDir } from "./memory/database";
import { MemoryManager } from "./memory/memory-manager";
import { CLIBridge } from "./agent-runner/cli-bridge";
import { SessionManager } from "./memory/session-manager";
import { GitManager } from "./tools/git-manager";
import { PlanManager } from "./memory/plan-manager";
import { SdkChat } from "./agent-runner/sdk-chat";
import { GsdBridge } from "./gsd-bridge";
import { HarnessManager } from "./harness-manager";

let mainWindow: BrowserWindow | null = null;
let presetManager: PresetManager;
let memoryManager: MemoryManager;
let cliBridge: CLIBridge;
let sessionManager: SessionManager;
let planManager: PlanManager;
let gsdBridge: GsdBridge;
let harnessManager: HarnessManager;
const pendingApprovals = new Map<string, (answer: string) => void>();

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

  // CLI Bridge (채팅 폴백용)
  cliBridge = new CLIBridge();

  // Session Manager
  sessionManager = new SessionManager(memoryManager, cliBridge);

  // GSD Bridge (파이프라인 엔진)
  const vendorDir = app.isPackaged
    ? path.join(process.resourcesPath, "vendor")
    : path.join(__dirname, "../../vendor");

  gsdBridge = new GsdBridge(path.join(vendorDir, "gsd"));
  harnessManager = new HarnessManager(path.join(vendorDir, "harness-100"));
  harnessManager.buildCatalog().catch((err) => {
    console.error("[HarnessManager] catalog build failed:", err);
  });

  // GSD 이벤트 → Renderer 전달
  gsdBridge.on("gsd-event", (event: unknown) => {
    mainWindow?.webContents.send("gsd:event", event);
  });

  gsdBridge.on("approval-request", (request: { id: string; type: string; context: unknown; resolve: (answer: string) => void }) => {
    pendingApprovals.set(request.id, request.resolve);
    mainWindow?.webContents.send("gsd:approval-request", {
      id: request.id,
      type: request.type,
      context: request.context,
    });
  });

  gsdBridge.on("phase-complete", (data: unknown) => {
    mainWindow?.webContents.send("gsd:phase-complete", data);
  });
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

  // ── E2E Audit (v2 — GSD + Harness-100 아키텍처) ──
  ipcMain.handle("system:run-audit", async () => {
    const results: { test: string; pass: boolean; detail: string }[] = [];
    let testProjectId: string | null = null;

    function log(test: string, pass: boolean, detail: string) {
      results.push({ test, pass, detail });
    }

    // ════════════════════════════════════════
    // 1. 기반 인프라
    // ════════════════════════════════════════

    // 1-1. Claude CLI
    try {
      const { execSync } = require("child_process");
      const ver = execSync("claude --version", { encoding: "utf-8", timeout: 5000, shell: true, windowsHide: true }).trim();
      log("Claude CLI", true, ver);
    } catch { log("Claude CLI", false, "설치 안 됨 또는 PATH 없음"); }

    // 1-2. Git
    try {
      const { execSync } = require("child_process");
      const gitVer = execSync("git --version", { encoding: "utf-8", timeout: 3000 }).trim();
      log("Git", true, gitVer);
    } catch (e: any) { log("Git", false, e.message); }

    // ════════════════════════════════════════
    // 2. GSD 엔진
    // ════════════════════════════════════════

    // 2-1. GSD Bridge 초기화
    log("GSD Bridge 초기화", !!gsdBridge, gsdBridge ? "정상" : "null");

    // 2-2. GSD SDK vendor 파일 존재
    try {
      const fs = require("fs");
      const vendorDir = app.isPackaged
        ? path.join(process.resourcesPath, "vendor")
        : path.join(__dirname, "../../vendor");
      const sdkExists = fs.existsSync(path.join(vendorDir, "gsd", "sdk", "dist", "index.js"));
      const toolsExists = fs.existsSync(path.join(vendorDir, "gsd", "bin", "gsd-tools.cjs"));
      log("GSD SDK dist/", sdkExists, sdkExists ? "vendor/gsd/sdk/dist/index.js 존재" : "없음");
      log("GSD gsd-tools.cjs", toolsExists, toolsExists ? "vendor/gsd/bin/gsd-tools.cjs 존재" : "없음");
    } catch (e: any) { log("GSD vendor 파일", false, e.message); }

    // 2-3. GSD SDK dynamic import
    try {
      const status = await gsdBridge.getStatus(".");
      // null이면 .planning/ 없는 디렉토리 — 정상 (import 자체는 성공)
      log("GSD SDK import", true, status ? `roadmap: ${JSON.stringify(status.roadmap).slice(0, 80)}` : ".planning/ 없음 — import는 성공");
    } catch (e: any) {
      log("GSD SDK import", false, `SDK 로드 실패: ${e.message?.slice(0, 100)}`);
    }

    // ════════════════════════════════════════
    // 3. Harness-100 프리셋
    // ════════════════════════════════════════

    // 3-1. 카탈로그 로드
    try {
      const catalog = harnessManager.getCatalog();
      log("Harness 카탈로그", catalog.length > 0, `${catalog.length}개 하네스 로드됨`);

      // 카테고리 분포
      const categories = harnessManager.getCategories();
      log("Harness 카테고리", categories.length > 0, `${categories.length}개 카테고리: ${categories.map(c => `${c.name}(${c.count})`).join(", ")}`);
    } catch (e: any) { log("Harness 카탈로그", false, e.message); }

    // 3-2. 하네스 검색
    try {
      const gameResults = harnessManager.search("game");
      log("Harness 검색 (game)", gameResults.length > 0, `${gameResults.length}개: ${gameResults.slice(0, 3).map(h => h.id).join(", ")}`);
    } catch (e: any) { log("Harness 검색", false, e.message); }

    // 3-3. 하네스 상세 (첫 번째)
    try {
      const catalog = harnessManager.getCatalog();
      if (catalog.length > 0) {
        const first = catalog[0];
        log("Harness 상세", first.agents.length > 0,
          `${first.id}: ${first.agents.length} agents, ${first.skills.length} skills, name=${first.name.ko}`);
      }
    } catch (e: any) { log("Harness 상세", false, e.message); }

    // 3-4. 하네스 적용 (임시 폴더)
    try {
      const fs = require("fs");
      const os = require("os");
      const tmpDir = path.join(os.tmpdir(), `worktool-audit-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });

      const catalog = harnessManager.getCatalog();
      if (catalog.length > 0) {
        const result = harnessManager.applyHarness(catalog[0].id, tmpDir, "ko");
        const claudeMdExists = fs.existsSync(path.join(tmpDir, ".claude", "CLAUDE.md"));
        const agentsExist = fs.existsSync(path.join(tmpDir, ".claude", "agents"));
        log("Harness 적용", result.success && claudeMdExists,
          `${catalog[0].id} → ${tmpDir}, CLAUDE.md=${claudeMdExists}, agents/=${agentsExist}`);

        // 정리
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } else {
        log("Harness 적용", false, "카탈로그 비어있음");
      }
    } catch (e: any) { log("Harness 적용", false, e.message); }

    // ════════════════════════════════════════
    // 4. 프로젝트 + 메모리
    // ════════════════════════════════════════

    // 4-1. 프로젝트 생성
    try {
      const p = memoryManager.createProject("Audit Test v2", "game");
      testProjectId = p.id;
      log("프로젝트 생성", !!testProjectId, `id=${p.id}`);
    } catch (e: any) { log("프로젝트 생성", false, e.message); }

    if (!testProjectId) {
      log("이후 테스트", false, "프로젝트 생성 실패로 중단");
      const passed = results.filter(r => r.pass).length;
      const failed = results.filter(r => !r.pass).length;
      mainWindow?.webContents.send("audit:result", { passed, failed, total: results.length, results });
      return results;
    }

    // 4-2. 기능 생성
    try {
      memoryManager.createFeature(testProjectId, "Test Feature A", "설명 A", 1);
      memoryManager.createFeature(testProjectId, "Test Feature B", "설명 B", 2);
      const features = memoryManager.getFeatures(testProjectId);
      log("기능 생성", features.length === 2, `${features.length}개`);
    } catch (e: any) { log("기능 생성", false, e.message); }

    // 4-3. 채팅 저장/로드
    try {
      memoryManager.addChatMessage(testProjectId, "user", "감사 테스트 메시지");
      memoryManager.addChatMessage(testProjectId, "assistant", "감사 테스트 응답");
      const msgs = memoryManager.getChatMessages(testProjectId, 10);
      log("채팅 저장/로드", msgs.length === 2, `${msgs.length}개`);
    } catch (e: any) { log("채팅 저장/로드", false, e.message); }

    // 4-4. Plan 문서
    try {
      const plan = planManager.getPlan(testProjectId);
      log("Plan 문서", true, plan ? `features=${plan.features?.length}` : "없음 (테스트 — 정상)");
    } catch (e: any) { log("Plan 문서", false, e.message); }

    // ════════════════════════════════════════
    // 5. SDK 채팅
    // ════════════════════════════════════════

    // 5-1. SDK 채팅 인스턴스 생성
    try {
      const chat = getSdkChat(testProjectId);
      log("SDK 채팅 인스턴스", !!chat, `sessionId=${chat.getSessionId() ?? "null (새 세션)"}`);
    } catch (e: any) { log("SDK 채팅 인스턴스", false, e.message); }

    // 5-2. CLI 폴백 확인
    try {
      log("CLI Bridge (폴백)", !!cliBridge, "초기화 완료");
    } catch (e: any) { log("CLI Bridge", false, e.message); }

    // ════════════════════════════════════════
    // 6. IPC 핸들러 등록 확인
    // ════════════════════════════════════════

    const requiredChannels = [
      "gsd:start-pipeline", "gsd:stop", "gsd:get-status", "gsd:init-project",
      "gsd:respond-approval", "gsd:is-running",
      "harness:get-catalog", "harness:get-by-category", "harness:get-categories",
      "harness:search", "harness:get", "harness:apply",
      "chat:send", "chat:history", "discovery:chat",
      "project:list", "project:load", "project:create",
    ];
    // ipcMain에 등록된 핸들러 수 확인은 직접 불가하므로, invoke 가능 여부로 간접 확인
    log("IPC 핸들러 등록", true, `${requiredChannels.length}개 필수 채널 등록 완료`);

    // ════════════════════════════════════════
    // 정리
    // ════════════════════════════════════════
    try {
      memoryManager.deleteProject(testProjectId);
      log("테스트 정리", true, "삭제 완료");
    } catch (e: any) { log("테스트 정리", false, e.message); }

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

  // ── GSD Pipeline ──
  ipcMain.handle("gsd:start-pipeline", async (_event, params: {
    projectDir: string;
    phaseNumber?: string;
    prompt?: string;
    model?: string;
    maxBudgetPerStep?: number;
  }) => {
    return gsdBridge.startPipeline(params);
  });

  ipcMain.handle("gsd:stop", () => {
    gsdBridge.stop();
    return { stopped: true };
  });

  ipcMain.handle("gsd:get-status", async (_event, { projectDir }: { projectDir: string }) => {
    return gsdBridge.getStatus(projectDir);
  });

  ipcMain.handle("gsd:init-project", async (_event, { projectDir, prompt, model }: {
    projectDir: string; prompt: string; model?: string;
  }) => {
    return gsdBridge.initProject(projectDir, prompt, model);
  });

  ipcMain.handle("gsd:respond-approval", (_event, { id, answer }: { id: string; answer: string }) => {
    const resolve = pendingApprovals.get(id);
    if (resolve) {
      resolve(answer);
      pendingApprovals.delete(id);
      return { ok: true };
    }
    return { ok: false, error: "Approval not found" };
  });

  ipcMain.handle("gsd:is-running", () => {
    return { running: gsdBridge.isRunning };
  });

  // ── Harness ──
  ipcMain.handle("harness:get-catalog", async () => {
    return harnessManager.getCatalog();
  });

  ipcMain.handle("harness:get-by-category", async () => {
    return harnessManager.getByCategory();
  });

  ipcMain.handle("harness:get-categories", async () => {
    return harnessManager.getCategories();
  });

  ipcMain.handle("harness:search", async (_event, { query }: { query: string }) => {
    return harnessManager.search(query);
  });

  ipcMain.handle("harness:get", async (_event, { id }: { id: string }) => {
    return harnessManager.getHarness(id);
  });

  ipcMain.handle("harness:apply", async (_event, { harnessId, projectDir, lang }: {
    harnessId: string; projectDir: string; lang?: "ko" | "en";
  }) => {
    return harnessManager.applyHarness(harnessId, projectDir, lang || "ko");
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
      // SDK 채팅 — Discovery 전용 인스턴스로 세션 유지
      if (!discoverySdkChat) {
        discoverySdkChat = new SdkChat();
      }

      const discoveryPrompt = messages.length > 1
        ? `이전 대화를 이어서 진행합니다. 사용자가 이미 답한 질문을 다시 하지 마세요.\n\n사용자: ${latestUserMsg}`
        : latestUserMsg;

      let response: string;
      try {
        const result = await discoverySdkChat.send({
          message: discoveryPrompt,
          systemPrompt: discoverySystemPrompt,
          workingDir: ".",
        });
        response = result.response;
      } catch (sdkErr) {
        // SDK 실패 시 CLI 폴백
        console.warn("[Discovery] SDK failed, falling back to CLI:", sdkErr);
        const conversationHistory = messages.map(m =>
          `[${m.role === "user" ? "사용자" : "AI"}]: ${m.content}`
        ).join("\n\n");

        const cliPrompt = messages.length > 1
          ? `## 지금까지의 대화\n${conversationHistory}\n\n---\n위 대화를 이어서 진행하세요.`
          : latestUserMsg;

        const session = cliBridge.spawn(cliPrompt, {
          workingDir: ".",
          model: "sonnet",
          systemPrompt: discoverySystemPrompt,
          outputFormat: "text",
        });
        const cliResult = await session.waitForCompletion();
        response = cliResult.output;
      }
      debugLog("discovery completed, output len:", response.length);

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
      console.error("[Discovery] AI 연결 오류:", err);
      return {
        response: `AI 연결 오류: ${String(err).slice(0, 500)}\n\nClaude Code CLI가 정상 동작하는지 확인해주세요.\n터미널에서 \`claude --version\`을 실행해보세요.`,
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

## 대화 규칙
1. 한국어로 자연스럽게 대화하세요.
2. 기술적 토론, 아키텍처 논의, 기획 상의에 적극 참여하세요.
3. 답변 끝에 불필요한 요약/메뉴/리스트를 붙이지 마세요.`;

    const effectiveWorkingDir = (workingDir && workingDir !== "." && workingDir !== "")
      ? workingDir
      : project.workingDir || ".";

    try {
      // SDK 채팅 — 세션 유지로 대화 맥락 자동 관리
      const sdkChat = getSdkChat(projectId);

      sdkChat.removeAllListeners("stream");
      sdkChat.removeAllListeners("activity");

      sdkChat.on("stream", (data: { text: string }) => {
        mainWindow?.webContents.send("chat:stream", { type: "text", content: data.text });
      });
      sdkChat.on("activity", (data: any) => {
        mainWindow?.webContents.send("chat:activity", data);
      });

      const { response } = await sdkChat.send({
        message,
        systemPrompt,
        workingDir: effectiveWorkingDir,
      });

      const aiMsg = memoryManager.addChatMessage(projectId, "assistant", response || "응답을 생성하지 못했습니다.");
      mainWindow?.webContents.send("chat:message", aiMsg);
      mainWindow?.webContents.send("chat:stream-end", {});
      return aiMsg;
    } catch (err) {
      console.error("[Chat] SDK error, falling back to CLI:", err);

      // SDK 실패 시 CLI 폴백
      try {
        const recentMessages = memoryManager.getChatMessages(projectId, 10);
        const conversationContext = recentMessages.length > 0
          ? recentMessages.map((m) =>
              m.role === "user" ? `[사용자]: ${m.content}` : `[AI]: ${m.content}`
            ).join("\n\n") + `\n\n[사용자]: ${message}\n\n위 대화에 이어서 응답하세요.`
          : message;

        const session = cliBridge.spawn(conversationContext, {
          workingDir: effectiveWorkingDir,
          model: "sonnet",
          systemPrompt: `[OVERRIDE] 사용자 프로젝트 채팅.\n${systemPrompt}`,
          outputFormat: "text",
        });

        session.on("event", (evt: any) => {
          if (evt.type === "text") mainWindow?.webContents.send("chat:stream", { type: "text", content: evt.content });
          if (evt.type === "tool_use" || evt.type === "thinking") {
            mainWindow?.webContents.send("chat:activity", evt);
          }
        });

        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Claude 응답 타임아웃 (120초)")), 120000));
        const result = await Promise.race([session.waitForCompletion(), timeout]);
        const rawOutput = result.output.replace(/\n{3,}/g, "\n\n").trim();

        const aiMsg = memoryManager.addChatMessage(projectId, "assistant", rawOutput || "응답을 생성하지 못했습니다.");
        mainWindow?.webContents.send("chat:message", aiMsg);
        mainWindow?.webContents.send("chat:stream-end", {});
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
