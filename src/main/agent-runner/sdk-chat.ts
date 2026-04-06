import { EventEmitter } from "events";
import { spawn } from "child_process";

/**
 * Claude Code CLI 기반 채팅 엔진
 *
 * `claude -p` 명령어로 직접 호출 — 가장 단순하고 안정적.
 */
export class SdkChat extends EventEmitter {
  /**
   * 메시지 전송 — claude -p로 CLI 직접 호출
   */
  async send(params: {
    message: string;
    systemPrompt: string;
    workingDir: string;
  }): Promise<{ response: string; sessionId: string | null }> {

    const args = [
      "-p", params.message,
      "--output-format", "text",
      "--max-turns", "3",
      "--system-prompt", params.systemPrompt,
    ];

    return new Promise((resolve, reject) => {
      const proc = spawn("claude", args, {
        cwd: params.workingDir,
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
          this.emit("activity", { type: "complete", content: "응답 완료" });
          resolve({ response: stdout.trim(), sessionId: null });
        } else {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr.slice(0, 500)}`));
        }
      });

      proc.on("error", (err: Error) => {
        reject(new Error(`Claude CLI spawn error: ${err.message}`));
      });

      // 2분 타임아웃
      setTimeout(() => {
        proc.kill();
        reject(new Error("Claude CLI timeout (120s)"));
      }, 120000);
    });
  }

  resetSession(): void {}
  getSessionId(): string | null { return null; }
}
