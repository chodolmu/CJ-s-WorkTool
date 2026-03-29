import React, { useState, useRef, useEffect } from "react";
import { useDiscoveryStore } from "../../stores/discovery-store";
import { MarkdownRenderer } from "../MarkdownRenderer";
import type { SpecCard } from "@shared/types";

interface DiscoveryChatProps {
  onSpecReady: () => void;
}

/**
 * 대화형 Discovery
 *
 * 사용자가 자유롭게 프로젝트를 설명하면
 * AI가 대화로 핵심 정보를 추출하고 SpecCard를 자동 생성
 *
 * AI 호출 없이도 동작하도록 로컬 파싱 폴백 내장
 */
export function DiscoveryChat({ onSpecReady }: DiscoveryChatProps) {
  const {
    chatMessages,
    isThinking,
    workingDir,
    addUserMessage,
    addAssistantMessage,
    setThinking,
    setSpecFromChat,
    setWorkingDir,
  } = useDiscoveryStore();

  const [input, setInput] = useState("");
  const [conversationRound, setConversationRound] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isThinking]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const msg = input.trim();
    setInput("");
    addUserMessage(msg);
    setThinking(true);

    const round = conversationRound + 1;
    setConversationRound(round);

    // Claude Code CLI를 통해 대화 처리
    if (window.harness?.discovery?.chat) {
      try {
        await processWithAI(msg, round);
      } catch {
        addAssistantMessage(
          "AI 연결에 문제가 발생했습니다. Claude Code CLI가 정상 동작하는지 확인해주세요.\n\n" +
          "터미널에서 `claude --version`을 실행해보세요.",
        );
      }
    } else {
      addAssistantMessage(
        "**Claude Code CLI가 필요합니다.**\n\n" +
        "이 앱은 Claude Code CLI를 통해 AI와 대화합니다.\n" +
        "설치 후 로그인해주세요: [Claude Code 설치 가이드](https://docs.anthropic.com/en/docs/claude-code)\n\n" +
        "```\nnpm install -g @anthropic-ai/claude-code\nclaude\n```",
      );
    }

    setThinking(false);
  };

  /** AI로 대화 처리 (Claude CLI 사용) */
  const processWithAI = async (msg: string, round: number) => {
    const allMessages = [
      ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: msg },
    ];

    const result = await window.harness.discovery.chat(allMessages, round);

    if (result.error || !result.response) {
      throw new Error(result.error || "No response");
    }

    // AI 응답 표시
    addAssistantMessage(result.response);

    // AI가 스펙 카드를 생성했으면 (사용자 확인 후) Review 단계로
    if (result.specCard) {
      setTimeout(() => {
        setSpecFromChat(result.specCard, result.presetId ?? "game");
        onSpecReady();
      }, 1000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Project directory selector */}
      <div className="shrink-0 px-6 pt-6 pb-3">
        <div className="flex items-center gap-2 p-2.5 bg-bg-card border border-border-subtle rounded-lg">
          <span className="text-xs text-text-muted shrink-0">📁 프로젝트 폴더:</span>
          <input
            value={workingDir}
            onChange={(e) => setWorkingDir(e.target.value)}
            placeholder="C:/Projects/my-project (코드가 생성될 폴더)"
            className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <button
            onClick={async () => {
              if (!window.harness) return;
              const folder = await (window.harness as any).dialog.selectFolder();
              if (folder) setWorkingDir(folder);
            }}
            className="shrink-0 px-2.5 py-1 text-[10px] bg-accent/15 text-accent rounded hover:bg-accent/25 cursor-pointer transition-all"
          >
            찾아보기
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-3 space-y-4">
        {chatMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${
              msg.role === "user" ? "bg-accent/20" : "bg-bg-active border border-border-subtle"
            }`}>
              {msg.role === "user" ? "👤" : "✦"}
            </div>
            <div className={`max-w-[80%] p-3 rounded-lg border overflow-hidden ${
              msg.role === "user"
                ? "bg-accent/8 border-accent/15"
                : "bg-bg-card border-border-subtle"
            }`}>
              <div className="overflow-x-auto">
                <MarkdownRenderer content={msg.content} />
              </div>
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-bg-active border border-border-subtle flex items-center justify-center text-sm">✦</div>
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
      <div className="shrink-0 px-6 py-4 border-t border-border-subtle">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="프로젝트에 대해 자유롭게 설명해주세요..."
            disabled={isThinking}
            rows={1}
            className="flex-1 resize-none bg-bg-card border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:opacity-40 transition-all"
            style={{ minHeight: "42px", maxHeight: "100px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="p-2.5 bg-accent hover:bg-accent-hover text-white rounded-xl transition-all disabled:opacity-30 cursor-pointer shrink-0 active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div className="text-center mt-1.5">
          <span className="text-[10px] text-text-muted">Enter로 전송 · AI와 대화하며 프로젝트를 정의합니다</span>
        </div>
      </div>
    </div>
  );
}

