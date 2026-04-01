import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "../stores/app-store";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { toast } from "./Toast";
import type { ChatMessage } from "@shared/types";

interface PhaseChatProps {
  projectId: string;
  stepId: string | null;
  stepName?: string;
  workingDir: string;
}

export function PhaseChat({ projectId, stepId, stepName, workingDir }: PhaseChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [activityTrail, setActivityTrail] = useState<{ type: string; content: string; ts: number }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 히스토리 로드 (stepId 변경 시 재로드)
  useEffect(() => {
    if (!projectId || !window.harness?.chat) { setIsLoadingHistory(false); return; }
    setIsLoadingHistory(true);
    setMessages([]);
    window.harness.chat.history(projectId, 100, 0, stepId ?? undefined).then((msgs: ChatMessage[]) => {
      setMessages(msgs);
      setIsLoadingHistory(false);
    });
  }, [projectId, stepId]);

  // IPC 이벤트 리스너
  useEffect(() => {
    if (!window.harness?.on) return;
    const cleanups: (() => void)[] = [];

    cleanups.push(
      window.harness.on("chat:message", (msg: ChatMessage) => {
        // stepId가 일치하는 메시지만 표시
        if (msg.stepId && stepId && msg.stepId !== stepId) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }),
    );

    cleanups.push(
      window.harness.on("chat:stream", (data: { type: string; content: string }) => {
        if (data.type === "text") {
          setStreamingContent((prev) => prev + data.content);
        }
      }),
    );

    cleanups.push(
      window.harness.on("chat:stream-end", () => {
        setIsStreaming(false);
        setStreamingContent("");
        setTimeout(() => setActivityTrail([]), 3000);
      }),
    );

    cleanups.push(
      window.harness.on("chat:activity", (data: { type: string; content?: string }) => {
        if (!data.content) return;
        setActivityTrail((prev) => [
          ...prev.slice(-10),
          { type: data.type, content: data.content!, ts: Date.now() },
        ]);
      }),
    );

    return () => cleanups.forEach((c) => c());
  }, [stepId]);

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const adjustTextareaHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !projectId || isStreaming || !window.harness?.chat) return;

    const msg = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");
    setActivityTrail([]);
    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      await window.harness.chat.send(projectId, msg, workingDir, undefined, stepId ?? undefined);
    } catch (err) {
      setIsStreaming(false);
      setStreamingContent("");
      toast("error", "메시지 전송 실패", String(err));
    }
  }, [input, projectId, isStreaming, workingDir, stepId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-2 border-b border-border-subtle flex items-center gap-2">
        <span className="text-sm">💬</span>
        <span className="text-sm font-medium text-text-primary">
          {stepName ?? "채팅"}
        </span>
        {stepId && (
          <span className="text-[10px] text-text-muted px-1.5 py-0.5 bg-bg-active rounded-badge">
            {stepId}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoadingHistory ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex gap-3 animate-fade-in" style={{ animationDelay: `${n * 80}ms` }}>
                <div className="w-7 h-7 rounded-full skeleton shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 skeleton w-1/3" />
                  <div className="h-3 skeleton w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-50 animate-fade-in">
            <p className="text-sm text-text-secondary">
              {stepName ? `${stepName} 단계에 대해 질문하세요.` : "메시지를 입력하세요."}
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble key={msg.id} message={msg} style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }} />
          ))
        )}

        {/* Activity trail */}
        {isStreaming && activityTrail.length > 0 && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-7 shrink-0" />
            <div className="flex-1 min-w-0 space-y-0.5 mb-2">
              {activityTrail.map((item, i) => (
                <ActivityTrailItem key={item.ts} item={item} isLatest={i === activityTrail.length - 1} />
              ))}
            </div>
          </div>
        )}

        {/* Streaming content */}
        {isStreaming && streamingContent && (
          <div className="flex gap-3 animate-fade-in">
            <Avatar role="assistant" />
            <div className="flex-1 min-w-0 p-3 bg-bg-card border border-border-subtle rounded-lg">
              <MarkdownRenderer content={streamingContent} />
              <span className="inline-block w-1.5 h-4 bg-accent rounded-sm animate-pulse ml-0.5 align-middle" />
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && activityTrail.length === 0 && (
          <div className="flex gap-3 animate-fade-in">
            <Avatar role="assistant" />
            <div className="p-3 bg-bg-card border border-border-subtle rounded-lg">
              <div className="flex gap-1.5 items-center h-5">
                <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border-subtle p-3 bg-bg-base">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); adjustTextareaHeight(); }}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? "응답 대기중..." : "메시지를 입력하세요... (Enter로 전송)"}
            disabled={isStreaming}
            rows={1}
            className="flex-1 resize-none bg-bg-card border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:opacity-40 transition-all"
            style={{ minHeight: "38px", maxHeight: "120px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="p-2 bg-accent hover:bg-accent-hover text-white rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0 active:scale-95"
            title="전송 (Enter)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div className="text-center mt-1">
          <span className="text-[10px] text-text-muted">Shift+Enter로 줄바꿈</span>
        </div>
      </div>
    </div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
      role === "user" ? "bg-accent/20" : "bg-bg-active border border-border-subtle"
    }`}>
      {role === "user" ? "👤" : "✦"}
    </div>
  );
}

function MessageBubble({ message, style }: { message: ChatMessage; style?: React.CSSProperties }) {
  const isUser = message.role === "user";
  return (
    <div className="flex gap-3 animate-fade-in" style={style}>
      <Avatar role={message.role} />
      <div className="flex-1 min-w-0">
        <div className={`p-3 rounded-lg border overflow-hidden ${
          isUser ? "bg-accent/8 border-accent/15" : "bg-bg-card border-border-subtle"
        }`}>
          {isUser ? (
            <p className="text-sm text-text-primary whitespace-pre-wrap select-text">{message.content}</p>
          ) : (
            <div className="overflow-x-auto">
              <MarkdownRenderer content={message.content} />
            </div>
          )}
        </div>
        <div className="text-[10px] text-text-muted mt-1 px-1">
          {new Date(message.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

function ActivityTrailItem({ item, isLatest }: { item: { type: string; content: string }; isLatest: boolean }) {
  const typeConfig: Record<string, { color: string; icon: string }> = {
    tool_use:    { color: "text-status-info",    icon: "▸" },
    tool_result: { color: "text-status-success", icon: "✓" },
    thinking:    { color: "text-text-muted",     icon: "…" },
    system:      { color: "text-text-muted",     icon: "●" },
    progress:    { color: "text-accent",         icon: "↻" },
    complete:    { color: "text-status-success",  icon: "✓" },
  };

  const config = typeConfig[item.type] ?? typeConfig.system;

  return (
    <div className={`flex items-center gap-1.5 text-[11px] font-mono transition-opacity ${
      isLatest ? "opacity-100" : "opacity-40"
    }`}>
      <span className={`${config.color} shrink-0`}>{config.icon}</span>
      <span className={`${config.color} truncate`}>{item.content}</span>
      {isLatest && <span className="w-1 h-1 bg-accent rounded-full animate-pulse shrink-0 ml-1" />}
    </div>
  );
}
