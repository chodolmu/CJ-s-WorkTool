import { EventEmitter } from "events";

/**
 * Claude Agent SDK 기반 채팅 엔진
 *
 * CLI --print 대신 SDK의 query()를 사용하여:
 * - 세션 유지 (대화 연속성)
 * - 네이티브 스트리밍
 * - spawn 오버헤드 없음
 * - 실시간 작업 내역 (tool_use, thinking 등) 스트리밍
 *
 * Events:
 *   "stream"   — { text: string }              텍스트 델타
 *   "activity" — { type, tool?, content? }      작업 내역 (도구 사용, 사고 등)
 */
export class SdkChat extends EventEmitter {
  private sessionId: string | null = null;

  /**
   * 메시지 전송 — 세션이 있으면 이어서 대화, 없으면 새 세션
   */
  async send(params: {
    message: string;
    systemPrompt: string;
    workingDir: string;
  }): Promise<{ response: string; sessionId: string | null }> {
    // Agent SDK는 ESM-only이므로 dynamic import 필수
    const { query } = await import("@anthropic-ai/claude-agent-sdk");

    let fullResponse = "";
    let capturedSessionId: string | null = this.sessionId;

    const options: Record<string, unknown> = {
      cwd: params.workingDir,
      systemPrompt: params.systemPrompt,
      allowedTools: ["Read", "Glob", "Grep"],
      permissionMode: "dontAsk",
      maxTurns: 3,
    };

    // 세션 이어가기
    if (this.sessionId) {
      options.resume = this.sessionId;
    }

    try {
      for await (const message of query({
        prompt: params.message,
        options: options as any,
      })) {
        // 세션 ID 캡처
        if (message.type === "system" && (message as any).subtype === "init") {
          capturedSessionId = (message as any).session_id ?? null;
          this.sessionId = capturedSessionId;
          this.emit("activity", { type: "system", content: "세션 시작" });
        }

        // 도구 사용 이벤트 — Claude Code처럼 실시간 표시
        if (message.type === "assistant" && (message as any).message) {
          const content = (message as any).message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "text" && block.text) {
                this.emit("stream", { text: block.text });
              } else if (block.type === "tool_use") {
                const toolName = block.name ?? "tool";
                const input = block.input ?? {};
                // 도구별 사람 친화적 메시지
                const desc = this.describeToolUse(toolName, input);
                this.emit("activity", {
                  type: "tool_use",
                  tool: toolName,
                  content: desc,
                  input,
                });
              } else if (block.type === "thinking") {
                this.emit("activity", {
                  type: "thinking",
                  content: typeof block.thinking === "string" ? block.thinking.slice(0, 200) : "사고중...",
                });
              }
            }
          }
        }

        // 도구 결과
        if (message.type === "user" && (message as any).message) {
          const content = (message as any).message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "tool_result") {
                this.emit("activity", {
                  type: "tool_result",
                  content: typeof block.content === "string" ? block.content.slice(0, 200) : "완료",
                });
              }
            }
          }
        }

        // 시스템 메시지 (subagent 등)
        if (message.type === "system") {
          const subtype = (message as any).subtype;
          if (subtype === "task_started") {
            this.emit("activity", { type: "system", content: "서브 에이전트 시작..." });
          } else if (subtype === "task_progress") {
            const summary = (message as any).summary;
            if (summary) {
              this.emit("activity", { type: "progress", content: summary });
            }
          }
        }

        // 최종 결과
        if ("result" in message && typeof message.result === "string") {
          fullResponse = message.result;
          this.emit("activity", { type: "complete", content: "응답 완료" });
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // 세션 만료 등으로 resume 실패 시 새 세션으로 재시도
      if (this.sessionId && errMsg.includes("session")) {
        this.sessionId = null;
        return this.send(params);
      }
      throw err;
    }

    return { response: fullResponse, sessionId: capturedSessionId };
  }

  /** 도구 사용을 사람 친화적 메시지로 변환 */
  private describeToolUse(toolName: string, input: Record<string, unknown>): string {
    switch (toolName) {
      case "Read":
        return `📄 파일 읽기: ${input.file_path ?? ""}`;
      case "Write":
        return `✏️ 파일 생성: ${input.file_path ?? ""}`;
      case "Edit":
        return `🔧 파일 수정: ${input.file_path ?? ""}`;
      case "Glob":
        return `🔍 파일 검색: ${input.pattern ?? ""}`;
      case "Grep":
        return `🔎 내용 검색: ${input.pattern ?? ""}`;
      case "Bash":
        return `💻 명령 실행: ${String(input.command ?? "").slice(0, 80)}`;
      case "WebSearch":
        return `🌐 웹 검색: ${input.query ?? ""}`;
      case "WebFetch":
        return `🌐 웹 페이지: ${input.url ?? ""}`;
      default:
        return `⚙️ ${toolName}`;
    }
  }

  /** 세션 초기화 (새 프로젝트/대화 시작 시) */
  resetSession(): void {
    this.sessionId = null;
  }

  /** 현재 세션 ID */
  getSessionId(): string | null {
    return this.sessionId;
  }
}
