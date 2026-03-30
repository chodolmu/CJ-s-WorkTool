import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "../stores/app-store";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { toast } from "../components/Toast";
import type { ChatMessage } from "@shared/types";

type ExecutionMode = "direct" | "light" | "full" | "auto";

const modeConfig: Record<ExecutionMode, { label: string; icon: string; description: string; color: string }> = {
  auto:   { label: "자동",     icon: "🔀", description: "작업 복잡도에 따라 자동 선택", color: "text-text-secondary" },
  direct: { label: "직접",   icon: "⚡", description: "AI 1회 호출 — 간단한 수정, 질문, 소소한 작업",  color: "text-status-success" },
  light:  { label: "Light",    icon: "🔧", description: "AI 2회 호출 — Generator + Evaluator만 (Planner 생략)",  color: "text-status-info" },
  full:   { label: "Full",     icon: "🚀", description: "AI 3+회 호출 — 전체 Planner→Generator→Evaluator",  color: "text-status-warning" },
};

export function ChatPage() {
  const { currentProjectId, projectName } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("auto");
  const [detectedMode, setDetectedMode] = useState<ExecutionMode | null>(null);
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [activityTrail, setActivityTrail] = useState<{ type: string; content: string; ts: number }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  // 히스토리 로드
  useEffect(() => {
    if (!currentProjectId || !window.harness?.chat) { setIsLoadingHistory(false); return; }
    setIsLoadingHistory(true);
    window.harness.chat.history(currentProjectId).then((msgs: ChatMessage[]) => {
      setMessages(msgs);
      setIsLoadingHistory(false);
    });
  }, [currentProjectId]);

  // IPC 이벤트 리스너
  useEffect(() => {
    if (!window.harness?.on) return;
    const cleanups: (() => void)[] = [];

    cleanups.push(
      window.harness.on("chat:message", (msg: ChatMessage) => {
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
        setActiveMode(null);
        // 작업 내역은 잠시 유지 후 정리
        setTimeout(() => setActivityTrail([]), 3000);
      }),
    );

    // 실시간 작업 내역 (도구 사용, 사고 등)
    cleanups.push(
      window.harness.on("chat:activity", (data: { type: string; content?: string }) => {
        if (!data.content) return;
        setActivityTrail((prev) => [
          ...prev.slice(-10), // 최대 10개 유지
          { type: data.type, content: data.content!, ts: Date.now() },
        ]);
      }),
    );

    cleanups.push(
      window.harness.on("chat:mode", (data: { mode: string }) => {
        setActiveMode(data.mode);
      }),
    );

    return () => cleanups.forEach((c) => c());
  }, []);

  // 입력 변경 시 모드 자동 감지
  useEffect(() => {
    if (executionMode !== "auto" || !input.trim()) {
      setDetectedMode(null);
      return;
    }
    const timer = setTimeout(() => {
      if (input.trim().length >= 5 && window.harness?.chat?.classify) {
        window.harness.chat.classify(input.trim()).then((result: { mode: string }) => {
          setDetectedMode(result.mode as ExecutionMode);
        }).catch(() => {});
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [input, executionMode]);

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // 모드 메뉴 바깥 클릭 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setShowModeMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const adjustTextareaHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  // 프로젝트의 workingDir 가져오기
  const projects = useAppStore((s) => s.projects);
  const currentProject = projects.find((p) => p.id === currentProjectId);
  const workingDir = currentProject?.workingDir || ".";

  const handleSend = useCallback(async () => {
    if (!input.trim() || !currentProjectId || isStreaming || !window.harness?.chat) return;

    const msg = input.trim();
    const mode = executionMode === "auto" ? undefined : executionMode;

    setInput("");
    setIsStreaming(true);
    setStreamingContent("");
    setActivityTrail([]);
    setDetectedMode(null);
    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      await window.harness.chat.send(currentProjectId, msg, workingDir, mode);
    } catch (err) {
      setIsStreaming(false);
      setStreamingContent("");
      setActiveMode(null);
      toast("error", "메시지 전송 실패", String(err));
    }
  }, [input, currentProjectId, isStreaming, executionMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!currentProjectId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
        <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
          <span className="text-2xl">💬</span>
        </div>
        <h2 className="text-base font-medium mb-1.5">채팅</h2>
        <p className="text-sm text-text-secondary max-w-xs">
          AI와 대화하려면 먼저 프로젝트를 시작하세요.
        </p>
      </div>
    );
  }

  const currentModeConfig = modeConfig[executionMode];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-2.5 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">💬</span>
          <span className="text-sm font-medium text-text-primary">채팅</span>
          <span className="text-xs text-text-muted">— {projectName}</span>
        </div>

        {/* Active mode indicator */}
        {activeMode && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-accent/10 rounded-badge animate-fade-in">
            <span className="text-xs">{modeConfig[activeMode as ExecutionMode]?.icon}</span>
            <span className="text-[10px] text-accent font-medium">{modeConfig[activeMode as ExecutionMode]?.label} 모드</span>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoadingHistory ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex gap-3 animate-fade-in" style={{ animationDelay: `${n * 80}ms` }}>
                <div className="w-8 h-8 rounded-full skeleton shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 skeleton w-1/3" />
                  <div className="h-3 skeleton w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-50 animate-fade-in">
            <p className="text-sm text-text-secondary mb-3">프로젝트에 대해 무엇이든 물어보세요.</p>
            <div className="space-y-1.5 text-xs text-text-muted">
              <SuggestionChip text="로그인 버튼 색상을 파란색으로 변경해줘" mode="direct" onClick={(t) => setInput(t)} />
              <SuggestionChip text="회원가입 폼에 비밀번호 확인 필드 추가해줘" mode="light" onClick={(t) => setInput(t)} />
              <SuggestionChip text="실시간 알림 시스템을 구축해줘" mode="full" onClick={(t) => setInput(t)} />
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble key={msg.id} message={msg} style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }} />
          ))
        )}

        {/* Activity trail — 실시간 작업 내역 */}
        {isStreaming && activityTrail.length > 0 && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 shrink-0" /> {/* Avatar spacer */}
            <div className="flex-1 min-w-0">
              <div className="space-y-0.5 mb-2">
                {activityTrail.map((item, i) => (
                  <ActivityTrailItem key={item.ts} item={item} isLatest={i === activityTrail.length - 1} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Streaming */}
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

      {/* Input area */}
      <div className="shrink-0 border-t border-border-subtle p-3 bg-bg-base">
        {/* Mode detected hint */}
        {detectedMode && executionMode === "auto" && !isStreaming && (
          <div className="flex items-center gap-1.5 mb-2 px-1 animate-fade-in">
            <span className="text-[10px] text-text-muted">자동 감지:</span>
            <span className={`text-[10px] font-medium ${modeConfig[detectedMode].color}`}>
              {modeConfig[detectedMode].icon} {modeConfig[detectedMode].label}
            </span>
          </div>
        )}

        <div className="flex gap-2 items-end max-w-3xl mx-auto">
          {/* Mode selector */}
          <div className="relative" ref={modeMenuRef}>
            <button
              onClick={() => setShowModeMenu(!showModeMenu)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
                showModeMenu
                  ? "border-accent bg-accent/10"
                  : "border-border-subtle bg-bg-card hover:border-border-strong"
              }`}
              title={`모드: ${currentModeConfig.label}\n${currentModeConfig.description}`}
            >
              <span className="text-sm">{currentModeConfig.icon}</span>
            </button>

            {showModeMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-bg-card border border-border-subtle rounded-lg card-shadow py-1 z-50 animate-scale-in">
                <div className="px-3 py-1.5 text-[10px] text-text-muted uppercase tracking-wider">실행 모드</div>
                {(["auto", "direct", "light", "full"] as ExecutionMode[]).map((mode) => {
                  const config = modeConfig[mode];
                  return (
                    <button
                      key={mode}
                      onClick={() => { setExecutionMode(mode); setShowModeMenu(false); }}
                      className={`w-full text-left px-3 py-2 transition-colors cursor-pointer ${
                        executionMode === mode ? "bg-accent/10" : "hover:bg-bg-hover"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{config.icon}</span>
                        <span className={`text-xs font-medium ${executionMode === mode ? "text-accent" : "text-text-primary"}`}>
                          {config.label}
                        </span>
                      </div>
                      <div className="text-[10px] text-text-muted ml-6 mt-0.5">{config.description}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Input */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); adjustTextareaHeight(); }}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? "응답 대기중..." : "메시지를 입력하세요... (Enter로 전송)"}
            disabled={isStreaming}
            rows={1}
            className="flex-1 resize-none bg-bg-card border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:opacity-40 transition-all"
            style={{ minHeight: "42px", maxHeight: "120px" }}
          />

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="p-2.5 bg-accent hover:bg-accent-hover text-white rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0 active:scale-95"
            title="전송 (Enter)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="text-center mt-1.5">
          <span className="text-[10px] text-text-muted">Shift+Enter로 줄바꿈 · {currentModeConfig.icon}를 클릭하여 모드 변경</span>
        </div>
      </div>
    </div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${
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
      <div className="flex-1 min-w-0 max-w-[85%]">
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

function SuggestionChip({ text, mode, onClick }: { text: string; mode: ExecutionMode; onClick: (text: string) => void }) {
  const config = modeConfig[mode];
  return (
    <button
      onClick={() => onClick(text)}
      className="flex items-center gap-2 w-full text-left px-3 py-2 bg-bg-card border border-border-subtle rounded-lg text-xs text-text-secondary hover:border-accent hover:text-accent transition-all cursor-pointer"
    >
      <span className="text-sm shrink-0">{config.icon}</span>
      <span>{text}</span>
      <span className={`text-[10px] ml-auto shrink-0 ${config.color}`}>{config.label}</span>
    </button>
  );
}
