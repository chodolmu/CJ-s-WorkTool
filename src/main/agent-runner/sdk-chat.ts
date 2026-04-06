import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

/**
 * Claude Code CLI 래퍼
 *
 * 두 가지 모드:
 * 1. one-shot: claude -p "prompt" — 한 번 실행하고 결과 반환
 * 2. interactive: claude 프로세스를 띄우고 stdin/stdout 파이프
 */
export class SdkChat extends EventEmitter {
  private proc: ChildProcess | null = null;
  private workingDir: string = ".";

  /** git-bash 환경변수가 설정되었는지 확인하고 없으면 자동 설정 */
  private static ensureGitBash(): void {
    if (process.platform !== "win32") return;
    if (process.env.CLAUDE_CODE_GIT_BASH_PATH) return;

    try {
      const { execSync } = require("child_process");
      const bashPath = execSync("where bash", {
        encoding: "utf-8", timeout: 3000, shell: true, windowsHide: true,
      }).trim().split(/\r?\n/)[0].trim();

      if (bashPath && fs.existsSync(bashPath)) {
        process.env.CLAUDE_CODE_GIT_BASH_PATH = bashPath;
      }
    } catch { /* ignore */ }
  }

  /**
   * One-shot 실행: claude -p "prompt"
   * Discovery, Planning 등 한 번 물어보고 답 받는 용도
   */
  async send(params: {
    message: string;
    systemPrompt: string;
    workingDir: string;
  }): Promise<{ response: string; sessionId: string | null }> {
    SdkChat.ensureGitBash();

    const args = [
      "-p", params.message,
      "--output-format", "text",
      "--max-turns", "10",
    ];

    if (params.systemPrompt) {
      args.push("--append-system-prompt", params.systemPrompt);
    }

    return new Promise((resolve, reject) => {
      const proc = spawn("claude", args, {
        cwd: params.workingDir || ".",
        shell: true,
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });

      // UTF-8 디코딩 보장
      proc.stdout?.setEncoding("utf-8");
      proc.stderr?.setEncoding("utf-8");

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (text: string) => {
        stdout += text;
        this.emit("stream", { text });
      });

      proc.stderr?.on("data", (text: string) => {
        stderr += text;
      });

      proc.on("close", (code: number | null) => {
        if (code === 0 || stdout.trim()) {
          resolve({ response: stdout.trim(), sessionId: null });
        } else {
          reject(new Error(`claude exited ${code}: ${stderr.slice(0, 300)}`));
        }
      });

      proc.on("error", (err: Error) => {
        reject(new Error(`claude spawn error: ${err.message}`));
      });

      setTimeout(() => {
        proc.kill();
        reject(new Error("claude timeout (120s)"));
      }, 120000);
    });
  }

  /**
   * 인터랙티브 세션 시작: 프로젝트 폴더에서 claude를 띄움
   * 사용자 채팅용 — stdin으로 입력, stdout으로 출력
   */
  startInteractive(workingDir: string): void {
    SdkChat.ensureGitBash();
    this.workingDir = workingDir;

    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }

    this.proc = spawn("claude", [], {
      cwd: workingDir,
      shell: true,
      windowsHide: true,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.proc.stdout?.setEncoding("utf-8");
    this.proc.stderr?.setEncoding("utf-8");

    this.proc.stdout?.on("data", (text: string) => {
      this.emit("stdout", text);
    });

    this.proc.stderr?.on("data", (text: string) => {
      this.emit("stderr", text);
    });

    this.proc.on("close", (code: number | null) => {
      this.emit("exit", code);
      this.proc = null;
    });

    this.proc.on("error", (err: Error) => {
      this.emit("error", err.message);
      this.proc = null;
    });
  }

  /** 인터랙티브 세션에 메시지 전송 */
  write(text: string): void {
    if (this.proc?.stdin?.writable) {
      this.proc.stdin.write(text + "\n");
    }
  }

  /** 인터랙티브 세션 종료 */
  stop(): void {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
  }

  get isRunning(): boolean {
    return this.proc !== null;
  }

  resetSession(): void {
    this.stop();
  }

  getSessionId(): string | null {
    return null;
  }
}
