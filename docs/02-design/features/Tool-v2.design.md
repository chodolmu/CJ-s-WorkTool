# Tool-v2 Design Document — GSD + Harness-100 피벗

> **Summary**: 자체 오케스트레이션 엔진을 GSD SDK로 교체하고, Harness-100 프리셋 브라우저를 추가하는 기술 설계
>
> **Project**: WorkTool
> **Version**: 0.3.0
> **Author**: User + Claude
> **Date**: 2026-04-02
> **Status**: Draft
> **Plan Reference**: `docs/01-plan/features/Tool-v2.plan.md`

---

## 1. Design Overview

### 1.1 핵심 원칙

- **GUI는 유지, 엔진만 교체** — renderer/ 코드는 최소한으로 수정
- **삭제 > 추가** — 자체 엔진 ~2000줄 삭제, GSD 브릿지 ~300줄 추가
- **두 트랙 분리** — 채팅(sdk-chat.ts)과 파이프라인(gsd-bridge.ts)은 독립

### 1.2 변경 후 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Electron App                               │
├───────────────────────────┬─────────────────────────────────────────┤
│      Renderer (React)     │            Main Process                 │
│                           │                                         │
│  ChatPage.tsx ──IPC──────►│── sdk-chat.ts ──► claude-agent-sdk      │
│    (변경 없음)             │     (변경 없음)    (세션 유지)           │
│                           │                                         │
│  OrchestrationPage.tsx ──►│── gsd-bridge.ts ──► vendor/gsd/sdk/     │
│    (이벤트 소스 교체)       │     (신규)          ├─ runPhase()       │
│                           │                     ├─ onEvent()        │
│  HarnessBrowser.tsx ─────►│── harness-manager.ts  └─ callbacks      │
│    (신규)                  │     (신규) ──► vendor/harness-100/      │
│                           │                                         │
│  ProjectView.tsx ────────►│── memory/ (변경 없음)                    │
│  SettingsPage.tsx         │                                         │
│    (설정 연동)             │                                         │
├───────────────────────────┴─────────────────────────────────────────┤
│  vendor/ (앱에 내장, exe 설치 시 포함)                                │
│  ├── gsd/               ← GSD SDK 빌드 + gsd-tools.cjs             │
│  │   ├── sdk/dist/        (빌드된 SDK 모듈)                         │
│  │   └── bin/lib/         (gsd-tools.cjs 상태 관리)                 │
│  └── harness-100/       ← 200개 하네스 프리셋                       │
│      ├── ko/ (100종)                                                │
│      └── en/ (100종)                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Module Design

### 2.1 gsd-bridge.ts (신규)

GSD SDK 래퍼. 파이프라인 실행의 유일한 진입점.

```typescript
// src/main/gsd-bridge.ts
import { EventEmitter } from "events";

// GSD 이벤트 타입 (sdk/src/events/ 에서 정의)
interface GsdEvent {
  type: string;       // GSDEventType enum값
  timestamp: string;
  data: Record<string, unknown>;
}

// UI 승인 요청
interface ApprovalRequest {
  id: string;
  phase: string;
  type: "discuss" | "verify" | "blocker";
  context: Record<string, unknown>;
  resolve: (answer: string) => void;
}

export class GsdBridge extends EventEmitter {
  private gsd: any = null;  // GSD instance (dynamic import)
  private abortController: AbortController | null = null;
  private gsdBasePath: string;

  constructor(gsdBasePath: string) {
    super();
    this.gsdBasePath = gsdBasePath;  // vendor/gsd/
  }

  /**
   * GSD SDK dynamic import (ESM)
   * vendor 경로에서 직접 로드
   */
  private async loadGSD() {
    const sdkPath = path.join(this.gsdBasePath, "sdk", "dist", "index.js");
    const { GSD } = await import(sdkPath);
    return GSD;
  }

  /**
   * 파이프라인 실행
   */
  async startPipeline(params: {
    projectDir: string;
    phaseNumber?: string;
    prompt?: string;
    model?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const GSD = await this.loadGSD();
    const gsd = new GSD({ projectDir: params.projectDir });
    this.abortController = new AbortController();

    // 이벤트 구독 → IPC 전달
    gsd.onEvent((event: GsdEvent) => {
      this.emit("gsd-event", this.transformEvent(event));
    });

    try {
      if (params.phaseNumber) {
        // 특정 페이즈 실행
        await gsd.runPhase(params.phaseNumber, {
          callbacks: this.buildCallbacks(),
          model: params.model || "claude-sonnet-4-6",
          signal: this.abortController.signal,
        });
      } else if (params.prompt) {
        // 전체 마일스톤 실행
        await gsd.run(params.prompt, {
          onPhaseComplete: async (result: any) => {
            this.emit("phase-complete", result);
          },
        });
      }
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emit("gsd-event", {
        type: "error",
        message: msg,
        timestamp: new Date().toISOString(),
      });
      return { success: false, error: msg };
    }
  }

  /**
   * HumanGateCallbacks → UI 승인 다이얼로그
   * Promise를 열어두고, renderer에서 응답이 오면 resolve
   */
  private buildCallbacks() {
    return {
      onDiscussApproval: async (ctx: any) => {
        return this.requestApproval("discuss", ctx);
      },
      onVerificationReview: async (result: any) => {
        return this.requestApproval("verify", result);
      },
      onBlockerDecision: async (blocker: any) => {
        return this.requestApproval("blocker", blocker);
      },
    };
  }

  private requestApproval(type: string, context: any): Promise<string> {
    return new Promise((resolve) => {
      const id = `approval-${Date.now()}`;
      this.emit("approval-request", { id, type, context, resolve });
    });
  }

  /**
   * GSD 이벤트 → 기존 UI 이벤트 포맷 변환
   */
  private transformEvent(event: GsdEvent): Record<string, unknown> {
    // GSD 25종 이벤트를 기존 ActivityEntry/AgentStatusChangeEvent 호환 포맷으로 변환
    const typeMap: Record<string, string> = {
      "PhaseStart": "system",
      "PhaseStepStart": "system",
      "PhaseStepComplete": "complete",
      "PhaseComplete": "complete",
      "WaveStart": "system",
      "WaveComplete": "complete",
      "SessionInit": "system",
      "SessionComplete": "complete",
      "SessionError": "error",
      "AssistantText": "thinking",
      "ToolCall": "tool_call",
      "ToolProgress": "tool_call",
      "CostUpdate": "system",
      "RateLimit": "error",
      "TaskStarted": "system",
      "TaskProgress": "system",
    };

    return {
      type: typeMap[event.type] || "system",
      gsdType: event.type,
      message: this.describeEvent(event),
      timestamp: event.timestamp,
      data: event.data,
    };
  }

  private describeEvent(event: GsdEvent): string {
    switch (event.type) {
      case "PhaseStart":
        return `Phase ${event.data.phaseNumber}: ${event.data.phaseName} 시작`;
      case "PhaseStepStart":
        return `${event.data.step} 단계 진행 중...`;
      case "PhaseStepComplete":
        return `단계 완료 (${event.data.durationMs}ms)`;
      case "WaveStart":
        return `Wave ${event.data.waveNumber}: ${event.data.planCount}개 플랜 병렬 실행`;
      case "WaveComplete":
        return `Wave 완료: ${event.data.successCount} 성공, ${event.data.failureCount} 실패`;
      case "ToolCall":
        return `⚙️ ${event.data.toolName}`;
      case "CostUpdate":
        return `💰 $${event.data.cumulativeCostUsd}`;
      case "SessionError":
        return `❌ 에러: ${event.data.errors}`;
      default:
        return event.type;
    }
  }

  /**
   * 파이프라인 중단
   */
  stop(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  /**
   * GSD 상태 조회 (.planning/ 파일 기반)
   */
  async getStatus(projectDir: string): Promise<any> {
    const GSD = await this.loadGSD();
    const tools = GSD.createTools(projectDir);
    return {
      roadmap: await tools.roadmapAnalyze(),
      state: await tools.stateLoad(),
    };
  }
}
```

### 2.2 harness-manager.ts (신규)

Harness-100 카탈로그 관리 + 프로젝트 적용.

```typescript
// src/main/harness-manager.ts
import fs from "fs";
import path from "path";
import matter from "gray-matter";  // YAML frontmatter 파서

export interface HarnessEntry {
  id: string;              // "05-game-narrative"
  number: number;          // 5
  category: string;        // "Content Creation"
  name: { en: string; ko: string };
  description: { en: string; ko: string };
  agents: HarnessAgent[];
  skills: string[];
}

export interface HarnessAgent {
  id: string;           // "worldbuilder"
  name: string;         // frontmatter name
  description: string;  // frontmatter description
}

// 카테고리 매핑 (번호 범위 기반)
const CATEGORIES: { range: [number, number]; name: string }[] = [
  { range: [1, 15], name: "Content Creation" },
  { range: [16, 30], name: "Software Dev & DevOps" },
  { range: [31, 42], name: "Data & AI/ML" },
  { range: [43, 55], name: "Business & Strategy" },
  { range: [56, 65], name: "Education & Learning" },
  { range: [66, 72], name: "Legal & Compliance" },
  { range: [73, 80], name: "Health & Lifestyle" },
  { range: [81, 87], name: "Communication & Docs" },
  { range: [88, 95], name: "Operations & Process" },
  { range: [96, 100], name: "Specialized Domains" },
];

export class HarnessManager {
  private catalog: HarnessEntry[] = [];
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;  // C:/GameMaking/harness-100
  }

  /**
   * 카탈로그 빌드 — 첫 실행 시 디렉토리 스캔 + frontmatter 파싱
   * 결과를 JSON으로 캐시 (이후 빠른 로드)
   */
  async buildCatalog(): Promise<HarnessEntry[]> {
    const cachePath = path.join(this.basePath, ".catalog-cache.json");

    // 캐시 확인
    if (fs.existsSync(cachePath)) {
      this.catalog = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      return this.catalog;
    }

    // ko/ 디렉토리 스캔
    const koDir = path.join(this.basePath, "ko");
    const enDir = path.join(this.basePath, "en");
    const dirs = fs.readdirSync(koDir).filter(d => /^\d{2,3}-/.test(d)).sort();

    this.catalog = dirs.map((dirName) => {
      const num = parseInt(dirName.split("-")[0], 10);
      const category = CATEGORIES.find(c => num >= c.range[0] && num <= c.range[1])?.name || "Other";

      // 에이전트 frontmatter 파싱
      const agentsDir = path.join(koDir, dirName, ".claude", "agents");
      const agents: HarnessAgent[] = [];
      if (fs.existsSync(agentsDir)) {
        for (const file of fs.readdirSync(agentsDir).filter(f => f.endsWith(".md"))) {
          const content = fs.readFileSync(path.join(agentsDir, file), "utf-8");
          const { data } = matter(content);
          agents.push({
            id: file.replace(".md", ""),
            name: data.name || file.replace(".md", ""),
            description: data.description || "",
          });
        }
      }

      // 스킬 디렉토리 목록
      const skillsDir = path.join(koDir, dirName, ".claude", "skills");
      const skills = fs.existsSync(skillsDir)
        ? fs.readdirSync(skillsDir).filter(d => fs.statSync(path.join(skillsDir, d)).isDirectory())
        : [];

      // CLAUDE.md에서 이름/설명 추출
      const claudeMdKo = path.join(koDir, dirName, ".claude", "CLAUDE.md");
      const claudeMdEn = path.join(enDir, dirName, ".claude", "CLAUDE.md");
      const koName = this.extractTitle(claudeMdKo) || dirName;
      const enName = this.extractTitle(claudeMdEn) || dirName;
      const koDesc = this.extractDescription(claudeMdKo) || "";
      const enDesc = this.extractDescription(claudeMdEn) || "";

      return {
        id: dirName,
        number: num,
        category,
        name: { en: enName, ko: koName },
        description: { en: enDesc, ko: koDesc },
        agents,
        skills,
      };
    });

    // 캐시 저장
    fs.writeFileSync(cachePath, JSON.stringify(this.catalog, null, 2));
    return this.catalog;
  }

  private extractTitle(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/^#\s+(.+)/m);
    return match ? match[1].trim() : null;
  }

  private extractDescription(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, "utf-8");
    // 첫 번째 헤딩 이후 첫 번째 문단
    const match = content.match(/^#.+\n+(.+)/m);
    return match ? match[1].trim() : null;
  }

  /**
   * 하네스 적용 — .claude/ 폴더를 프로젝트에 복사
   */
  applyHarness(harnessId: string, projectDir: string, lang: "ko" | "en" = "ko"): void {
    const src = path.join(this.basePath, lang, harnessId, ".claude");
    const dest = path.join(projectDir, ".claude");

    if (!fs.existsSync(src)) {
      throw new Error(`Harness not found: ${harnessId}`);
    }

    // 기존 .claude/ 백업 (있으면)
    if (fs.existsSync(dest)) {
      const backupDir = path.join(projectDir, ".claude-backup-" + Date.now());
      fs.renameSync(dest, backupDir);
    }

    fs.cpSync(src, dest, { recursive: true });
  }

  /**
   * 카탈로그 검색
   */
  search(query: string): HarnessEntry[] {
    const q = query.toLowerCase();
    return this.catalog.filter(h =>
      h.name.ko.toLowerCase().includes(q) ||
      h.name.en.toLowerCase().includes(q) ||
      h.description.ko.toLowerCase().includes(q) ||
      h.description.en.toLowerCase().includes(q) ||
      h.category.toLowerCase().includes(q) ||
      h.agents.some(a => a.name.toLowerCase().includes(q))
    );
  }

  /**
   * 카테고리별 그룹
   */
  getByCategory(): Record<string, HarnessEntry[]> {
    const groups: Record<string, HarnessEntry[]> = {};
    for (const h of this.catalog) {
      if (!groups[h.category]) groups[h.category] = [];
      groups[h.category].push(h);
    }
    return groups;
  }

  /**
   * 전체 카탈로그
   */
  getCatalog(): HarnessEntry[] {
    return this.catalog;
  }
}
```

### 2.3 IPC 핸들러 변경 (index.ts)

```typescript
// 삭제되는 핸들러:
// - pipeline:start (자체 Pipeline 클래스 사용)
// - pipeline:checkpoint (자체 체크포인트)
// - orchestrator:handle-request (SmartOrchestrator)

// 추가되는 핸들러:
ipcMain.handle("gsd:start-pipeline", async (_event, params) => {
  return gsdBridge.startPipeline(params);
});

ipcMain.handle("gsd:stop", () => {
  gsdBridge.stop();
});

ipcMain.handle("gsd:get-status", async (_event, { projectDir }) => {
  return gsdBridge.getStatus(projectDir);
});

ipcMain.handle("gsd:respond-approval", (_event, { id, answer }) => {
  // approval-request 이벤트의 resolve 함수 호출
  pendingApprovals.get(id)?.(answer);
  pendingApprovals.delete(id);
});

ipcMain.handle("harness:get-catalog", async () => {
  return harnessManager.getCatalog();
});

ipcMain.handle("harness:search", async (_event, { query }) => {
  return harnessManager.search(query);
});

ipcMain.handle("harness:apply", async (_event, { harnessId, projectDir, lang }) => {
  harnessManager.applyHarness(harnessId, projectDir, lang);
});

ipcMain.handle("harness:get-by-category", async () => {
  return harnessManager.getByCategory();
});

// 유지되는 핸들러:
// - chat:send (sdk-chat.ts 그대로)
// - chat:discovery (sdk-chat.ts 그대로)
// - project:* (memory 그대로)
// - plan:* (planManager 그대로)
// - dialog:* (Electron dialog 그대로)
```

### 2.4 initServices 변경

```typescript
function initServices(): void {
  // ── 유지 ──
  const db = createDatabase();
  memoryManager = new MemoryManager(db);
  planManager = new PlanManager(db);
  sessionManager = new SessionManager(memoryManager, cliBridge);

  // ── 교체 ──
  // 삭제: presetManager, cliBridge, promptAssembler, orchestrator, guidelineGenerator
  // 추가:
  // vendor/ 경로 해석: 개발 시 프로젝트 루트, 패키징 후 resources/
  const vendorDir = app.isPackaged
    ? path.join(process.resourcesPath, "vendor")
    : path.join(__dirname, "../../vendor");

  gsdBridge = new GsdBridge(path.join(vendorDir, "gsd"));
  harnessManager = new HarnessManager(path.join(vendorDir, "harness-100"));
  await harnessManager.buildCatalog();

  // GSD 이벤트 → Renderer 전달
  gsdBridge.on("gsd-event", (event) => {
    mainWindow?.webContents.send("gsd:event", event);
  });

  gsdBridge.on("approval-request", (request) => {
    pendingApprovals.set(request.id, request.resolve);
    mainWindow?.webContents.send("gsd:approval-request", {
      id: request.id,
      type: request.type,
      context: request.context,
    });
  });

  // ── 유지: CLI Bridge (채팅 폴백용 최소 유지) ──
  cliBridge = new CLIBridge();
}
```

---

## 3. Renderer 변경

### 3.1 OrchestrationPage.tsx — 이벤트 소스 교체

```tsx
// 변경 전: 자체 파이프라인 이벤트
useEffect(() => {
  window.api.on("pipeline:step-update", handleStepUpdate);
  window.api.on("pipeline:agent_status", handleAgentStatus);
}, []);

// 변경 후: GSD 이벤트
useEffect(() => {
  window.api.on("gsd:event", (event) => {
    // GSD 이벤트를 기존 UI 상태에 매핑
    switch (event.gsdType) {
      case "PhaseStart":
        setCurrentPhase(event.data.phaseName);
        break;
      case "PhaseStepStart":
        setCurrentStep(event.data.step);
        break;
      case "WaveStart":
        setActiveWave(event.data.waveNumber);
        break;
      case "ToolCall":
        addActivityLog(event);
        break;
      case "CostUpdate":
        setCost(event.data.cumulativeCostUsd);
        break;
      case "PhaseComplete":
        setPhaseComplete(true);
        break;
    }
  });

  window.api.on("gsd:approval-request", (request) => {
    setApprovalDialog(request);
  });
}, []);
```

**파이프라인 시작 버튼:**
```tsx
// 변경 전
onClick={() => window.api.invoke("pipeline:start", config)}

// 변경 후
onClick={() => window.api.invoke("gsd:start-pipeline", {
  projectDir: project.workingDir,
  prompt: specCard.rawAnswers.map(a => a.freeText).join("\n"),
  model: settings.model,
})}
```

### 3.2 HarnessBrowser.tsx (신규)

```tsx
// src/renderer/components/HarnessBrowser.tsx
interface Props {
  onSelect: (harnessId: string) => void;
}

export function HarnessBrowser({ onSelect }: Props) {
  const [catalog, setCatalog] = useState<Record<string, HarnessEntry[]>>({});
  const [search, setSearch] = useState("");
  const [lang, setLang] = useState<"ko" | "en">("ko");

  useEffect(() => {
    window.api.invoke("harness:get-by-category").then(setCatalog);
  }, []);

  const filtered = search
    ? window.api.invoke("harness:search", { query: search })
    : null;

  return (
    <div className="harness-browser">
      {/* 검색바 + 언어 토글 */}
      <div className="harness-search-bar">
        <input placeholder="하네스 검색..." onChange={e => setSearch(e.target.value)} />
        <button onClick={() => setLang(l => l === "ko" ? "en" : "ko")}>
          {lang === "ko" ? "한국어" : "English"}
        </button>
      </div>

      {/* 카테고리별 카드 그리드 */}
      {Object.entries(catalog).map(([category, harnesses]) => (
        <div key={category} className="harness-category">
          <h3>{category}</h3>
          <div className="harness-grid">
            {harnesses.map(h => (
              <div key={h.id} className="harness-card" onClick={() => onSelect(h.id)}>
                <div className="harness-number">#{h.number}</div>
                <h4>{h.name[lang]}</h4>
                <p>{h.description[lang]}</p>
                <div className="harness-agents">
                  {h.agents.map(a => (
                    <span key={a.id} className="agent-badge">{a.name}</span>
                  ))}
                </div>
                <div className="harness-meta">
                  {h.agents.length} agents · {h.skills.length} skills
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 3.3 Preload API 변경

```typescript
// src/preload/index.ts — 추가
contextBridge.exposeInMainWorld("api", {
  // 기존 유지
  invoke: ipcRenderer.invoke,
  on: (channel: string, callback: Function) => { ... },

  // GSD 전용 (타입 안전)
  gsd: {
    startPipeline: (params) => ipcRenderer.invoke("gsd:start-pipeline", params),
    stop: () => ipcRenderer.invoke("gsd:stop"),
    getStatus: (dir) => ipcRenderer.invoke("gsd:get-status", { projectDir: dir }),
    respondApproval: (id, answer) => ipcRenderer.invoke("gsd:respond-approval", { id, answer }),
  },
  harness: {
    getCatalog: () => ipcRenderer.invoke("harness:get-catalog"),
    search: (query) => ipcRenderer.invoke("harness:search", { query }),
    apply: (id, dir, lang) => ipcRenderer.invoke("harness:apply", { harnessId: id, projectDir: dir, lang }),
    getByCategory: () => ipcRenderer.invoke("harness:get-by-category"),
  },
});
```

---

## 4. 삭제 목록

### 4.1 삭제할 파일 (7개, ~2000줄)

| 파일 | 줄수 (추정) | 대체 |
|------|------------|------|
| `src/main/orchestrator/pipeline.ts` | ~500 | gsd-bridge.ts `runPhase()` |
| `src/main/orchestrator/director-agent.ts` | ~400 | GSD 내부 orchestrator |
| `src/main/orchestrator/smart-orchestrator.ts` | ~300 | GSD PhaseRunner |
| `src/main/orchestrator/phase-coach.ts` | ~150 | GSD 단계 관리 |
| `src/main/agent-runner/prompt-assembler.ts` | ~200 | 하네스 .md 파일 |
| `src/main/agent-runner/guideline-generator.ts` | ~150 | 하네스에 포함 |
| `src/main/agent-runner/error-handler.ts` | ~100 | GSD 내부 에러 처리 |

### 4.2 삭제할 디렉토리

| 디렉토리 | 대체 |
|----------|------|
| `resources/presets/` (5종) | Harness-100 (200종) |

### 4.3 수정할 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/main/index.ts` | initServices + IPC 핸들러 교체 |
| `src/main/orchestrator/decision-requester.ts` | GSD approval 연결 또는 삭제 |
| `src/renderer/pages/OrchestrationPage.tsx` | GSD 이벤트 구독 |
| `src/renderer/hooks/useIpcEvents.ts` | GSD 이벤트 채널 추가 |
| `src/renderer/stores/app-store.ts` | 파이프라인 상태 구조 변경 |
| `src/shared/types.ts` | GSD 이벤트 타입 + HarnessEntry 타입 추가 |
| `src/renderer/components/AgentCard.tsx` | 하네스 에이전트 정보 표시 |

### 4.4 추가 삭제/수정 대상 (갭 분석에서 발견)

| 파일/핸들러 | 액션 | 이유 |
|------------|------|------|
| `src/main/orchestrator/skill-detector.ts` | **삭제** | CLIBridge 의존, 하네스가 대체 |
| `src/main/orchestrator/research-agent.ts` | **삭제** | CLIBridge 의존, GSD research 단계가 대체 |
| `src/main/memory/learning-manager.ts` | **유지** | memory에서만 사용, pipeline 독립적 |
| `system:run-audit` 핸들러 (index.ts 153-475행) | **삭제 또는 재작성** | Pipeline/DirectorAgent/PhaseCoach 직접 참조 — 삭제 후 깨짐 |
| `preset:list/get/save` 핸들러 | **수정** | presetManager → harnessManager 위임 |
| `agent:save/delete` 핸들러 | **수정** | 커스텀 에이전트 추가는 하네스 .claude/agents/에 .md 파일 직접 생성으로 대체 |
| `discovery:chat` 핸들러 (index.ts 818-922행) | **수정** | CLIBridge → sdk-chat.ts로 전환 (세션 유지 + GSD discuss와 독립) |
| `chat:send` 핸들러 (index.ts 1024-1155행) | **수정** | CLIBridge → sdk-chat.ts로 전환 (현재 CLIBridge 사용 중) |
| `executeChatActions` (index.ts 1158-1236행) | **수정** | presetManager.saveAgent → 프로젝트 .claude/agents/에 .md 파일 생성으로 변경 |
| `discovery:complete` 핸들러 | **수정** | skills 시드 경로 변경 (resources/skills → vendor 또는 제거) |

### 4.5 유지 (변경 없음)

| 파일/디렉토리 | 이유 |
|--------------|------|
| `src/main/agent-runner/sdk-chat.ts` | 채팅 엔진 — 독립 |
| `src/main/agent-runner/cli-bridge.ts` | Discovery/채팅 폴백용 유지 (sdk-chat 전환 후 최종 삭제 후보) |
| `src/main/memory/` 전체 | 프로젝트/세션/플랜 관리 — GUI 고유 |
| `src/main/tools/git-manager.ts` | Git 관리 — GUI 고유 |
| `src/renderer/pages/ChatPage.tsx` | 채팅 UI — 독립 |
| `src/renderer/pages/SettingsPage.tsx` | 설정 — GSD 모델 선택 연동만 |
| `src/renderer/components/ActivityFeed.tsx` | 로그 — 이벤트 소스만 교체 |

---

## 5. 데이터 흐름

### 5.1 파이프라인 실행 흐름

```
사용자: "파이프라인 시작" 클릭
  │
  ├─► renderer: gsd:start-pipeline IPC 호출
  │     params: { projectDir, prompt, model }
  │
  ├─► main: GsdBridge.startPipeline()
  │     ├─ new GSD({ projectDir })
  │     ├─ gsd.onEvent() 구독
  │     └─ gsd.runPhase() 또는 gsd.run()
  │
  ├─► GSD SDK 내부:
  │     ├─ discuss → research → plan → execute → verify
  │     ├─ 각 단계에서 이벤트 emit (25종)
  │     └─ HumanGate에서 콜백 호출
  │
  ├─► main: gsd-event emit → IPC send
  │     └─ approval-request emit → IPC send (필요 시)
  │
  └─► renderer: gsd:event 수신
        ├─ OrchestrationPage 상태 업데이트
        ├─ ActivityFeed 로그 추가
        └─ 승인 다이얼로그 표시 (필요 시)
```

### 5.2 하네스 적용 흐름

```
사용자: HarnessBrowser에서 카드 클릭
  │
  ├─► renderer: harness:apply IPC 호출
  │     params: { harnessId: "05-game-narrative", projectDir, lang: "ko" }
  │
  ├─► main: HarnessManager.applyHarness()
  │     ├─ 기존 .claude/ 백업 (.claude-backup-{timestamp})
  │     └─ fs.cpSync(harness/.claude/, project/.claude/)
  │
  └─► renderer: 성공 토스트 + 에이전트 목록 갱신
```

### 5.3 채팅 흐름 (수정 필요)

**현재 문제**: chat:send와 discovery:chat 모두 CLIBridge(claude --print)를 사용 중.
sdk-chat.ts는 구현되어있지만 실제 핸들러에 연결되지 않은 상태.

```
[현재 — CLIBridge 사용, 세션 비유지]
사용자: 채팅 입력
  ├─► chat:send → CLIBridge.spawn() → claude --print (매번 새 프로세스)
  └─► 대화 맥락은 DB에서 최근 10개 읽어 프롬프트에 재주입 (토큰 낭비)

[변경 후 — sdk-chat.ts 전환, 세션 유지]
사용자: 채팅 입력
  ├─► chat:send → SdkChat.send()
  │     ├─ resume: sessionId (세션 유지, 맥락 재전송 불필요)
  │     ├─ stream 이벤트 → chat:stream IPC
  │     └─ activity 이벤트 → chat:activity IPC
  └─► renderer: stream + activity 수신

사용자: Discovery 대화
  ├─► discovery:chat → SdkChat.send() (별도 인스턴스)
  │     ├─ systemPrompt: Discovery 전용 프롬프트
  │     └─ JSON 스펙카드 추출 로직은 그대로
  └─► specCard 확정 시 → discovery:complete → 프로젝트 생성
```

**핵심 변경**: index.ts의 chat:send/discovery:chat 핸들러에서
`cliBridge.spawn()` → `getSdkChat(projectId).send()` 교체.
시스템 프롬프트와 액션 시스템은 sdk-chat의 systemPrompt 파라미터로 전달.

### 5.4 Chat Action 시스템 (수정)

현재 `executeChatActions`가 presetManager로 에이전트를 추가/삭제함.
하네스 기반으로 전환 후:

```
[현재]
AI 응답에 worktool-action JSON → presetManager.saveAgent() → YAML 파일 생성

[변경 후]
AI 응답에 worktool-action JSON → 프로젝트의 .claude/agents/에 .md 파일 직접 생성
  ├─ add_agent → .claude/agents/{id}.md 생성 (frontmatter + 역할 설명)
  ├─ remove_agent → .claude/agents/{id}.md 삭제 (core 에이전트는 하네스에서 온 것이므로 보호)
  └─ 하네스 원본은 vendor/에 있으므로 프로젝트 .claude/만 수정
```

---

## 6. 의존성 변경

### 6.1 추가

| 패키지 | 용도 |
|--------|------|
| `gray-matter` | Harness .md frontmatter 파싱 |

**GSD SDK**: npm 패키지가 아님 → 로컬 빌드 후 `file:` 경로 또는 직접 소스 포함

### 6.2 유지

| 패키지 | 용도 |
|--------|------|
| `@anthropic-ai/claude-agent-sdk` | sdk-chat.ts + GSD SDK 공통 |
| `electron` / `electron-vite` | 앱 프레임 |
| `better-sqlite3` | 메모리/세션 DB |
| `uuid` | ID 생성 |
| `zustand` | renderer 상태 관리 |

### 6.3 제거 가능

| 패키지 | 이유 |
|--------|------|
| (없음 — 현재 의존성이 최소한) | |

---

## 7. 번들링 전략 — vendor/ 내장

### 7.1 디렉토리 구조

```
Tool/
├── vendor/                          ← 앱에 내장되는 외부 의존성
│   ├── gsd/                         ← GSD (get-shit-done)
│   │   ├── sdk/dist/                  빌드된 SDK 모듈 (ESM)
│   │   ├── bin/lib/gsd-tools.cjs      상태 관리 도구
│   │   ├── agents/                    에이전트 정의 .md
│   │   └── commands/gsd/              슬래시 커맨드 (참조용)
│   └── harness-100/                 ← 하네스 프리셋
│       ├── ko/                        한국어 100종
│       │   ├── 01-youtube-production/
│       │   ├── 05-game-narrative/
│       │   └── ...
│       ├── en/                        영어 100종
│       └── .catalog-cache.json        빌드타임 생성 카탈로그 인덱스
├── src/
├── package.json
└── electron-builder.yml
```

### 7.2 vendor/ 준비 스크립트

```bash
# scripts/prepare-vendor.sh — 개발 환경 초기 셋업 시 1회 실행

#!/bin/bash
set -e

VENDOR_DIR="./vendor"
GSD_REPO="C:/GameMaking/get-shit-done"
HARNESS_REPO="C:/GameMaking/harness-100"

# 1. GSD SDK 빌드 + 필요 파일만 복사
echo "Building GSD SDK..."
cd "$GSD_REPO/sdk" && npm install && npm run build && cd -

mkdir -p "$VENDOR_DIR/gsd/sdk/dist"
cp -r "$GSD_REPO/sdk/dist/"* "$VENDOR_DIR/gsd/sdk/dist/"
cp "$GSD_REPO/sdk/package.json" "$VENDOR_DIR/gsd/sdk/"

mkdir -p "$VENDOR_DIR/gsd/bin/lib"
cp "$GSD_REPO/bin/lib/gsd-tools.cjs" "$VENDOR_DIR/gsd/bin/lib/"

mkdir -p "$VENDOR_DIR/gsd/agents"
cp "$GSD_REPO/agents/"*.md "$VENDOR_DIR/gsd/agents/"

# 2. Harness-100 복사 (ko/ + en/ 전체)
echo "Copying Harness-100..."
mkdir -p "$VENDOR_DIR/harness-100"
cp -r "$HARNESS_REPO/ko" "$VENDOR_DIR/harness-100/"
cp -r "$HARNESS_REPO/en" "$VENDOR_DIR/harness-100/"

echo "Done. vendor/ ready."
```

### 7.3 electron-builder 설정

```yaml
# electron-builder.yml
extraResources:
  - from: "vendor/gsd"
    to: "vendor/gsd"
    filter:
      - "**/*"
  - from: "vendor/harness-100"
    to: "vendor/harness-100"
    filter:
      - "**/*.md"
      - "**/.catalog-cache.json"
```

### 7.4 경로 해석 (런타임)

```typescript
// 개발 시: Tool/vendor/gsd/sdk/dist/
// 패키징 후: resources/vendor/gsd/sdk/dist/
const vendorDir = app.isPackaged
  ? path.join(process.resourcesPath, "vendor")
  : path.join(__dirname, "../../vendor");

const gsdSdkPath = path.join(vendorDir, "gsd", "sdk", "dist");
const harnessBasePath = path.join(vendorDir, "harness-100");
const gsdToolsPath = path.join(vendorDir, "gsd", "bin", "lib", "gsd-tools.cjs");
```

### 7.5 GSD SDK import 방식

```typescript
// gsd-bridge.ts에서 vendor 경로로 직접 import
private async loadGSD() {
  // vendor/gsd/sdk/dist/index.js를 dynamic import
  const sdkPath = path.join(this.gsdBasePath, "sdk", "dist", "index.js");
  const { GSD } = await import(sdkPath);
  return GSD;
}
```

### 7.6 .gitignore

```
# vendor/는 빌드 아티팩트이므로 git에 포함하지 않음
vendor/

# 대신 prepare-vendor.sh로 재생성
```

### 7.7 npm scripts

```json
{
  "scripts": {
    "prepare-vendor": "bash scripts/prepare-vendor.sh",
    "dev": "npm run prepare-vendor && electron-vite dev",
    "build": "npm run prepare-vendor && electron-vite build",
    "package": "npm run build && electron-builder"
  }
}
```

### 7.8 용량 추정

| 항목 | 크기 (추정) |
|------|------------|
| GSD SDK dist/ | ~500KB |
| gsd-tools.cjs | ~50KB |
| GSD agents/ | ~200KB |
| Harness-100 ko/ (100종 x ~20KB) | ~2MB |
| Harness-100 en/ (100종 x ~20KB) | ~2MB |
| **총 vendor/** | **~5MB** |

Electron 앱 자체가 ~150MB이므로 5MB 추가는 무시할 수준.

---

## 8. 구현 순서 (Phase별 파일)

### Phase 0: vendor/ 번들링 + 채팅 전환 (Day 0)

| 순서 | 파일 | 액션 |
|------|------|------|
| 0-1 | `scripts/prepare-vendor.sh` | 신규 생성 |
| 0-2 | GSD SDK 빌드 + vendor/ 복사 | `bash scripts/prepare-vendor.sh` |
| 0-3 | `electron-builder.yml` | extraResources 설정 |
| 0-4 | `.gitignore` | vendor/ 추가 |
| 0-5 | `src/main/index.ts` chat:send | CLIBridge → sdk-chat.ts 전환 |
| 0-6 | `src/main/index.ts` discovery:chat | CLIBridge → sdk-chat.ts 전환 |
| 0-7 | `src/main/index.ts` system:run-audit | 삭제 또는 최소화 |
| 0-8 | 테스트 | `npm run dev` → 채팅 세션 유지 확인 |

### Phase 1: GSD 연동 기반 (Day 1)

| 순서 | 파일 | 액션 |
|------|------|------|
| 1-1 | `src/main/gsd-bridge.ts` | 신규 생성 |
| 1-3 | `src/main/index.ts` | GSD IPC 핸들러 추가 |
| 1-4 | `src/shared/types.ts` | GSD 이벤트 타입 추가 |
| 1-5 | 테스트 | `npm run dev` → GSD 이벤트 수신 확인 |

### Phase 2: UI 연결 (Day 1-2)

| 순서 | 파일 | 액션 |
|------|------|------|
| 2-1 | `src/renderer/hooks/useIpcEvents.ts` | GSD 이벤트 채널 추가 |
| 2-2 | `src/renderer/pages/OrchestrationPage.tsx` | GSD 이벤트 구독 |
| 2-3 | `src/renderer/stores/app-store.ts` | 파이프라인 상태 구조 변경 |
| 2-4 | `src/preload/index.ts` | GSD/Harness API 추가 |
| 2-5 | 테스트 | 파이프라인 실행 → UI 표시 확인 |

### Phase 3: Harness 브라우저 (Day 2)

| 순서 | 파일 | 액션 |
|------|------|------|
| 3-1 | `src/main/harness-manager.ts` | 신규 생성 |
| 3-2 | `src/renderer/components/HarnessBrowser.tsx` | 신규 생성 |
| 3-3 | `src/main/index.ts` | Harness IPC 핸들러 추가 |
| 3-4 | 테스트 | 카탈로그 로드 + 하네스 적용 확인 |

### Phase 4: 정리 ✅ (Session 7 완료)

| 순서 | 파일 | 상태 |
|------|------|:----:|
| 4-1 | pipeline.ts, director-agent.ts, smart-orchestrator.ts, phase-coach.ts | ✅ 삭제 |
| 4-2 | prompt-assembler.ts, guideline-generator.ts, error-handler.ts | ✅ 삭제 |
| 4-3 | skill-detector.ts, research-agent.ts | ✅ 삭제 |
| 4-4 | resources/presets/ | ✅ 삭제 |
| 4-5 | index.ts 정리 | ✅ |
| 4-6 | E2E 감사 재작성 (17항목) | ✅ |
| 4-7 | 빌드 3/3 확인 | ✅ |

---

## 9. Phase 5~7: UI 플로우 재설계 (다음 세션)

### 9.1 핵심 UX 변경: 파이프라인 + 채팅 통합

**현재 (분리):**
```
[채팅 탭] [파이프라인 탭] [설정 탭]
```

**목표 (통합):**
```
┌─────────────────────────────────────────────────────┐
│  파이프라인 진행 (좌측 40%)  │  단계별 채팅 (우측 60%)  │
│                              │                         │
│  ✅ discuss                  │  ┌─────────────────┐    │
│  ✅ plan                     │  │ [execute 세션]   │    │
│  🔄 execute  ◄────────────  │  │                  │    │
│  ⏳ verify                   │  │ 이전 단계 문서   │    │
│                              │  │ 참조하여 진행    │    │
│  💰 $0.42                    │  │                  │    │
│                              │  └─────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 9.2 단계별 세션 설계

```typescript
// 각 GSD phase가 독립 SDK 세션을 가짐
interface PhaseSession {
  phaseNumber: string;       // "01"
  phaseName: string;         // "discuss"
  sdkChat: SdkChat;          // 독립 세션 인스턴스
  systemPrompt: string;      // 이전 단계 .planning/ 산출물 포함
  messages: ChatMessage[];   // 이 단계의 대화 히스토리
}

// 세션 시작 시 이전 단계 handoff
async function startPhaseSession(phaseNumber: string, projectDir: string) {
  // 1. .planning/ 에서 이전 단계 산출물 로드
  const context = await gsdBridge.getStatus(projectDir);
  const prevDocs = readPreviousPhaseOutputs(projectDir, phaseNumber);

  // 2. systemPrompt에 이전 단계 문서 주입
  const systemPrompt = buildPhasePrompt(phaseNumber, prevDocs);

  // 3. 새 SDK 세션 시작
  const session = new SdkChat();
  return { sdkChat: session, systemPrompt };
}
```

### 9.3 프로젝트 생성 플로우 변경

```
[기존]
대시보드 → "새 프로젝트" → 프리셋 선택 → Discovery 대화 → SpecCard → 팀 구성

[변경]
대시보드 → "새 프로젝트" → HarnessBrowser (200종 카드) → 선택
  → 프로젝트 폴더 선택 → harness.apply() + gsd.initProject()
  → 파이프라인 뷰 (discuss 단계부터 시작)
```

### 9.4 파일 변경 맵 (Phase 5~7)

| 파일 | 액션 | 설명 |
|------|------|------|
| `src/renderer/pages/OrchestrationPage.tsx` | **재작성** | 좌측 파이프라인 + 우측 채팅 통합 레이아웃 |
| `src/renderer/pages/ChatPage.tsx` | **삭제** | 파이프라인에 통합 |
| `src/renderer/components/PhaseChat.tsx` | **신규** | 단계별 채팅 패널 컴포넌트 |
| `src/renderer/components/PipelineProgress.tsx` | **신규** | GSD 단계 진행 표시 (좌측 패널) |
| `src/renderer/components/HarnessBrowser.tsx` | **수정** | 프로젝트 생성 플로우에 통합 |
| `src/renderer/pages/ProjectView.tsx` | **수정** | Discovery/팀구성 → 하네스 선택으로 교체 |
| `src/main/index.ts` | **수정** | phase별 세션 관리 핸들러 추가 |
| `src/main/agent-runner/sdk-chat.ts` | **유지** | 세션 인스턴스로 재사용 |
| `src/renderer/components/PhaseCoachBanner.tsx` | **삭제** | 레거시 |
| `src/renderer/components/SmartInputForm.tsx` | **삭제** | 레거시 |

### 9.5 네비게이션 구조 변경

```
[기존 탭]
채팅 | 파이프라인 | 일정 | 에이전트 | 설정

[변경 탭]
프로젝트(파이프라인+채팅) | 하네스 | 일정 | 설정
```

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-02 | Initial design — GSD + Harness-100 피벗 | User + Claude |
| 0.2 | 2026-04-02 | Phase 0~4 완료 반영 + Phase 5~7 UI 재설계 추가 (파이프라인+채팅 통합) | User + Claude |
