import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

/**
 * Claude Code CLI 래퍼
 *
 * one-shot: claude -p — stdin으로 메시지 전달, stdout으로 응답 수신
 * interactive: claude 프로세스를 띄우고 stdin/stdout 파이프
 */
export class SdkChat extends EventEmitter {
  private proc: ChildProcess | null = null;
  private workingDir: string = ".";

  /** Windows에서 git-bash 경로 자동 설정 */
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
   * One-shot: 메시지를 stdin으로 전달하고 응답을 stdout으로 받음
   */
  async send(params: {
    message: string;
    systemPrompt: string;
    workingDir: string;
  }): Promise<{ response: string; sessionId: string | null }> {
    SdkChat.ensureGitBash();

    // args에 메시지를 넣지 않고 stdin으로 전달 (Windows cmd.exe 인코딩 문제 회피)
    const args = [
      "-p", "-",
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
        env: { ...process.env },
      });

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
          reject(new Error(`claude exited ${code}: ${stderr.slice(0, 500)}`));
        }
      });

      proc.on("error", (err: Error) => {
        reject(new Error(`claude spawn error: ${err.message}`));
      });

      // stdin으로 메시지 전달 후 닫기
      proc.stdin?.write(params.message, "utf-8");
      proc.stdin?.end();

      // 2분 타임아웃
      setTimeout(() => {
        proc.kill();
        reject(new Error("claude timeout (120s)"));
      }, 120000);
    });
  }

  /**
   * 인터랙티브 세션: 프로젝트 폴더에서 claude를 띄움
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

  write(text: string): void {
    if (this.proc?.stdin?.writable) {
      this.proc.stdin.write(text + "\n", "utf-8");
    }
  }

  stop(): void {
    if (this.proc) { this.proc.kill(); this.proc = null; }
  }

  get isRunning(): boolean { return this.proc !== null; }
  resetSession(): void { this.stop(); }
  getSessionId(): string | null { return null; }
}
