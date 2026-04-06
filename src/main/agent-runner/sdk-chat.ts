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
      const gitPath = execSync("where git", {
        encoding: "utf-8", timeout: 3000, shell: true, windowsHide: true,
      }).trim().split("\n")[0].trim();

      if (!gitPath) return;

      // git.exe 위치에서 상위로 올라가며 bash.exe 찾기
      let dir = path.dirname(gitPath);
      for (let i = 0; i < 4 && dir !== path.dirname(dir); i++) {
        for (const sub of ["usr\\bin\\bash.exe", "bin\\bash.exe"]) {
          const bp = path.join(dir, sub);
          if (fs.existsSync(bp)) {
            process.env.CLAUDE_CODE_GIT_BASH_PATH = bp;
            return;
          }
        }
        dir = path.dirname(dir);
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
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;
        this.emit("stream", { text });
      });

      proc.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
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

    this.proc.stdout?.on("data", (chunk: Buffer) => {
      this.emit("stdout", chunk.toString());
    });

    this.proc.stderr?.on("data", (chunk: Buffer) => {
      this.emit("stderr", chunk.toString());
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
