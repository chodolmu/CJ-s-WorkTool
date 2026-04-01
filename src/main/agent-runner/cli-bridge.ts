import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { v4 as uuid } from "uuid";

export interface CLIBridgeOptions {
  workingDir: string;
  model?: "opus" | "sonnet" | "haiku";
  systemPrompt?: string;
  maxTurns?: number;
  outputFormat?: "json" | "text";
}

export interface CLIStreamEvent {
  type: "thinking" | "text" | "tool_use" | "tool_result" | "complete" | "error";
  content: string;
  timestamp: string;
  metadata?: {
    toolName?: string;
    filePath?: string;
  };
}

export interface CLIResult {
  success: boolean;
  output: string;
  error?: string;
  filesChanged: string[];
  tokenUsage?: { input: number; output: number };
}

/**
 * Claude Code CLI를 child_process로 실행하고 stdout을 파싱하는 브리지
 */
export class CLIBridge {
  /**
   * Claude Code CLI 프로세스를 생성
   * --print 모드로 비대화형 실행, --output-format json으로 구조화된 출력
   */
  spawn(prompt: string, options: CLIBridgeOptions): CLISession {
    const args: string[] = [
      "--print",
    ];

    if (options.outputFormat !== "text") {
      args.push("--output-format", "json");
    }

    if (options.model) {
      args.push("--model", this.resolveModel(options.model));
    }

    if (options.systemPrompt) {
      // 시스템 프롬프트를 임시 파일로 저장 (shell 이스케이핑 문제 방지)
      const fs = require("fs");
      const os = require("os");
      const pathMod = require("path");
      const tmpFile = pathMod.join(os.tmpdir(), `worktool-sysprompt-${Date.now()}.txt`);
      fs.writeFileSync(tmpFile, options.systemPrompt, "utf-8");
      args.push("--system-prompt-file", tmpFile);
      // 프로세스 종료 후 정리
      setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch {} }, 60000);
    }

    if (options.maxTurns) {
      args.push("--max-turns", String(options.maxTurns));
    }

    // 프롬프트를 임시 파일 + --append-system-prompt-file로 전달
    // Windows에서 CLI 인자로 한글 전달 시 코드페이지 문제로 깨짐
    // → 프롬프트를 시스템 프롬프트에 append하고, 인자에는 짧은 영문 트리거만 전달
    {
      const fs = require("fs");
      const os = require("os");
      const pathMod = require("path");
      const tmpPromptFile = pathMod.join(os.tmpdir(), `worktool-prompt-${Date.now()}.txt`);
      fs.writeFileSync(tmpPromptFile, `\n\n---\n## USER REQUEST\n${prompt}`, "utf-8");
      args.push("--append-system-prompt-file", tmpPromptFile);
      setTimeout(() => { try { fs.unlinkSync(tmpPromptFile); } catch {} }, 60000);
    }
    // 인자에는 짧은 영문 트리거 (CLI가 프롬프트 필수)
    args.push("Execute the USER REQUEST from the appended system prompt above.");

    // 환경변수 설정
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      CLAUDE_CODE_NONINTERACTIVE: "1",
      // Windows 한글 인코딩 깨짐 방지 — UTF-8 코드페이지 강제
      PYTHONIOENCODING: "utf-8",
      LANG: "ko_KR.UTF-8",
      CHCP: "65001",
    };

    // git-bash 경로 자동 설정 (Windows)
    if (process.platform === "win32" && !env.CLAUDE_CODE_GIT_BASH_PATH) {
      const gitBashPath = this.findGitBash();
      if (gitBashPath) {
        env.CLAUDE_CODE_GIT_BASH_PATH = gitBashPath;
      }
    }

    // claude를 직접 spawn (shell 경유 없음 → 한국어 인자 깨짐 방지)
    const claudePath = this.findClaudeExe();
    // 디버그 로그 — console.log는 Electron main process에서 DevTools로 전달됨
    const _log = (msg: string) => {
      const line = `[CLIBridge] ${msg}`;
      console.log(line);
      try {
        const fs = require("fs");
        const os = require("os");
        const pathMod = require("path");
        fs.appendFileSync(pathMod.join(os.tmpdir(), "worktool-debug.log"), `${new Date().toISOString()} ${msg}\n`);
      } catch {}
    };
    _log(`claudePath: ${claudePath}`);
    _log(`gitBash: ${env.CLAUDE_CODE_GIT_BASH_PATH}`);
    _log(`args: ${JSON.stringify(args.map(a => a.length > 50 ? a.slice(0, 50) + "..." : a))}`);
    let proc;

    if (claudePath && claudePath.endsWith(".exe")) {
      // WinGet claude.exe → 직접 실행
      _log(`spawn mode: direct exe — ${claudePath}`);
      proc = spawn(claudePath, args, {
        cwd: options.workingDir,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env,
      });
    } else if (claudePath && claudePath.endsWith(".js")) {
      // npm global cli.js → node로 실행 (process.execPath은 Electron이므로 node를 찾아야 함)
      const nodePath = this.findNodeExe() ?? "node";
      _log(`spawn mode: node + cli.js — node=${nodePath}, cli=${claudePath}`);
      proc = spawn(nodePath, [claudePath, ...args], {
        cwd: options.workingDir,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env,
      });
    } else {
      // 폴백: shell 경유 (macOS/Linux 또는 경로 못 찾은 경우)
      _log("spawn mode: shell fallback (claude not found as exe/js)");
      proc = spawn("claude", args, {
        cwd: options.workingDir,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
        windowsHide: true,
        env,
      });
    }

    _log(`spawn pid: ${proc.pid ?? "NONE"}`);
    proc.on("error", (err) => _log(`proc error: ${err.message}`));
    proc.on("close", (code, signal) => _log(`proc close: code=${code} signal=${signal}`));

    return new CLISession(proc, options.workingDir);
  }

  /** claude 실행 경로 탐색 (shell 없이 직접 실행용) */
  private findClaudeExe(): string | null {
    if (process.platform !== "win32") return null;
    const fs = require("fs");
    const pathMod = require("path");

    // 1. npm global 설치 우선 (항상 최신, node로 cli.js 실행)
    const appData = process.env.APPDATA;
    if (appData) {
      const npmCli = pathMod.join(appData, "npm", "node_modules", "@anthropic-ai", "claude-code", "cli.js");
      if (fs.existsSync(npmCli)) return npmCli; // .js → node로 실행
    }

    // 2. WinGet 설치 경로 (폴백 — 업데이트가 느릴 수 있음)
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const wingetDir = pathMod.join(localAppData, "Microsoft", "WinGet", "Packages");
      if (fs.existsSync(wingetDir)) {
        try {
          const dirs = fs.readdirSync(wingetDir).filter((d: string) => d.startsWith("Anthropic.ClaudeCode"));
          for (const dir of dirs) {
            const exe = pathMod.join(wingetDir, dir, "claude.exe");
            if (fs.existsSync(exe)) return exe;
          }
        } catch {}
      }
    }

    return null;
  }

  /** Windows에서 git-bash 경로 자동 탐색 */
  private findGitBash(): string | null {
    if (process.platform !== "win32") return null;
    const fs = require("fs");
    const path = require("path");
    // path.join으로 OS 네이티브 경로 생성 (백슬래시 이스케이핑 문제 방지)
    const drives = ["C:", "D:", "E:"];
    const subPaths = [
      ["Program Files", "Git", "bin", "bash.exe"],
      ["Program Files (x86)", "Git", "bin", "bash.exe"],
      ["Git", "bin", "bash.exe"],
      ["Git", "usr", "bin", "bash.exe"],
    ];
    for (const drive of drives) {
      for (const sub of subPaths) {
        const p = path.join(drive, ...sub);
        if (fs.existsSync(p)) return p;
      }
    }
    return null;
  }

  /** Node.js 실행파일 경로 탐색 (Electron의 process.execPath은 electron.exe이므로 별도로 찾아야 함) */
  private findNodeExe(): string | null {
    if (process.platform !== "win32") return null;
    const { execSync } = require("child_process");
    try {
      const result = execSync("where node", { encoding: "utf-8", timeout: 5000 }).trim();
      const first = result.split("\n")[0]?.trim();
      if (first) return first;
    } catch {}
    return null;
  }

  private resolveModel(short: "opus" | "sonnet" | "haiku"): string {
    const map: Record<string, string> = {
      opus: "claude-opus-4-6",
      sonnet: "claude-sonnet-4-6",
      haiku: "claude-haiku-4-5-20251001",
    };
    return map[short] ?? short;
  }
}

export class CLISession extends EventEmitter {
  readonly id: string;
  private process: ChildProcess;
  private workingDir: string;
  private outputBuffer: string = "";
  private fullOutput: string = "";  // 전체 출력 누적
  private _status: "running" | "completed" | "failed" = "running";
  private _result: CLIResult | null = null;

  constructor(proc: ChildProcess, workingDir: string) {
    super();
    this.id = uuid();
    this.process = proc;
    this.workingDir = workingDir;

    this.setupListeners();
  }

  get status() {
    return this._status;
  }

  private setupListeners(): void {
    // stdout 스트리밍
    this.process.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      this.outputBuffer += text;
      this.fullOutput += text;  // 전체 출력 누적

      // 줄 단위로 JSON 파싱 시도
      const lines = this.outputBuffer.split("\n");
      this.outputBuffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const event = this.parseLine(line.trim());
        if (event) {
          this.emit("event", event);
        }
      }
    });

    // stderr (에러/경고)
    this.process.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      try {
        const fs = require("fs");
        const os = require("os");
        const pathMod = require("path");
        fs.appendFileSync(pathMod.join(os.tmpdir(), "worktool-debug.log"), `${new Date().toISOString()} STDERR: ${text.slice(0, 500)}\n`);
      } catch {}
      // stderr에서 유의미한 에러만 이벤트로
      if (text.includes("Error") || text.includes("error")) {
        this.emit("event", {
          type: "error",
          content: text.trim(),
          timestamp: new Date().toISOString(),
        } satisfies CLIStreamEvent);
      }
    });

    // 프로세스 종료
    this.process.on("close", (code) => {
      console.log("[CLIBridge] process closed, code:", code, "fullOutput len:", this.fullOutput.length);
      // 남은 버퍼 처리
      if (this.outputBuffer.trim()) {
        const event = this.parseLine(this.outputBuffer.trim());
        if (event) this.emit("event", event);
      }

      this._status = code === 0 ? "completed" : "failed";
      this._result = {
        success: code === 0,
        output: this.fullOutput,  // 전체 누적 출력 사용
        error: code !== 0 ? `Process exited with code ${code}` : undefined,
        filesChanged: this.extractFilesChanged(),
        tokenUsage: this.extractTokenUsage(),
      };

      this.emit("complete", this._result);
    });

    this.process.on("error", (err) => {
      this._status = "failed";
      this._result = {
        success: false,
        output: "",
        error: err.message,
        filesChanged: [],
      };
      this.emit("error", err);
      this.emit("complete", this._result);
    });
  }

  /**
   * stdout 한 줄을 파싱하여 구조화된 이벤트로 변환
   */
  private parseLine(line: string): CLIStreamEvent | null {
    const now = new Date().toISOString();

    // JSON 파싱 시도 (--output-format json)
    try {
      const json = JSON.parse(line);

      // Claude Code JSON 출력 형식에 따라 분기
      if (json.type === "assistant" || json.role === "assistant") {
        // 텍스트 응답
        const content = json.content ?? json.text ?? json.message ?? "";
        const textContent = Array.isArray(content)
          ? content
              .filter((b: { type: string }) => b.type === "text")
              .map((b: { text: string }) => b.text)
              .join("")
          : String(content);

        return { type: "text", content: textContent, timestamp: now };
      }

      if (json.type === "tool_use" || json.tool_name) {
        return {
          type: "tool_use",
          content: `${json.tool_name ?? json.name ?? "tool"}: ${JSON.stringify(json.input ?? json.arguments ?? {}).slice(0, 200)}`,
          timestamp: now,
          metadata: {
            toolName: json.tool_name ?? json.name,
            filePath: json.input?.file_path ?? json.input?.path,
          },
        };
      }

      if (json.type === "tool_result" || json.type === "result") {
        return {
          type: "tool_result",
          content: String(json.content ?? json.output ?? "").slice(0, 500),
          timestamp: now,
        };
      }

      // 알 수 없는 JSON은 텍스트로 처리
      return { type: "text", content: line, timestamp: now };
    } catch {
      // JSON이 아니면 일반 텍스트로 처리
      if (!line.trim()) return null;

      // "Thinking..." 같은 패턴 감지
      if (line.toLowerCase().includes("thinking") || line.startsWith("⠋") || line.startsWith("⠙")) {
        return { type: "thinking", content: line, timestamp: now };
      }

      return { type: "text", content: line, timestamp: now };
    }
  }

  /**
   * 출력에서 변경된 파일 목록 추출 (간단한 휴리스틱)
   */
  private extractFilesChanged(): string[] {
    const files = new Set<string>();
    const patterns = [
      /(?:wrote|created|modified|updated|edited)\s+[`"]?([^\s`"]+\.\w+)/gi,
      /(?:Write|Edit|Create)\s+.*?([^\s]+\.\w+)/g,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(this.outputBuffer)) !== null) {
        files.add(match[1]);
      }
    }
    return Array.from(files);
  }

  /** 출력에서 토큰 사용량 추출 */
  private extractTokenUsage(): { input: number; output: number } | undefined {
    try {
      // Claude Code JSON 출력에서 usage 정보 추출
      const usageMatch = this.outputBuffer.match(/"usage"\s*:\s*\{[^}]*"input_tokens"\s*:\s*(\d+)[^}]*"output_tokens"\s*:\s*(\d+)/);
      if (usageMatch) {
        return { input: parseInt(usageMatch[1], 10), output: parseInt(usageMatch[2], 10) };
      }
    } catch { /* ignore */ }
    return undefined;
  }

  /** 프로세스 완료 대기 */
  waitForCompletion(): Promise<CLIResult> {
    if (this._result) return Promise.resolve(this._result);
    return new Promise((resolve) => {
      this.once("complete", resolve);
    });
  }

  /** 프로세스 강제 중지 */
  abort(): void {
    if (this._status === "running") {
      this.process.kill("SIGTERM");
      this._status = "failed";
    }
  }

  /** stdin 입력 전송 */
  sendInput(text: string): void {
    this.process.stdin?.write(text + "\n");
  }
}
