import React, { useState, useRef, useEffect } from "react";
import { useDiscoveryStore } from "../../stores/discovery-store";
import { MarkdownRenderer } from "../MarkdownRenderer";
import type { SpecCard, CoreDecision, Expansion } from "@shared/types";

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

    // AI를 쓸 수 있으면 AI로, 아니면 로컬 파싱
    if (window.harness?.discovery?.chat) {
      try {
        // AI에게 대화 기록 + 사용자 메시지를 보내서 분석 요청
        // 간단히 classify 비슷한 방식으로 처리
        await processWithAI(msg, round);
      } catch {
        processLocally(msg, round);
      }
    } else {
      processLocally(msg, round);
    }

    setThinking(false);
  };

  /** AI 없이 로컬에서 대화 처리 */
  const processLocally = (msg: string, round: number) => {
    const allUserMessages = [...chatMessages.filter((m) => m.role === "user").map((m) => m.content), msg];
    const combined = allUserMessages.join(" ");

    if (round === 1) {
      // 첫 메시지: 프로젝트 유형 파악 + 추가 질문
      const detected = detectProjectType(combined);
      addAssistantMessage(
        `${detected.summary}\n\n좀 더 구체적으로 알려주세요:\n` +
        `- **핵심 기능**은 무엇인가요? (가장 중요한 1-2가지)\n` +
        `- **사용자**는 누구인가요? (본인, 팀, 일반 사용자)\n` +
        `- 참고하고 싶은 **레퍼런스**가 있나요?`,
      );
    } else if (round === 2) {
      // 두 번째 메시지: 기술적 부분 질문
      addAssistantMessage(
        "좋습니다! 마지막으로 몇 가지만 더:\n\n" +
        "- **비주얼 스타일** 선호가 있나요? (미니멀, 화려한, 레트로 등)\n" +
        "- **꼭 있어야 하는 것**이 있다면?\n\n" +
        "아니면 \"이 정도면 됐어\" 라고 해주시면 바로 정리해드릴게요.",
      );
    } else {
      // 세 번째 이상: 스펙 카드 생성
      const spec = buildSpecFromConversation(allUserMessages);
      setSpecFromChat(spec.specCard, spec.presetId);
      addAssistantMessage(
        "프로젝트를 정리했습니다! 다음 화면에서 확인하고 수정할 수 있어요.",
      );
      onSpecReady();
    }
  };

  /** AI로 대화 처리 (Claude CLI 사용) */
  const processWithAI = async (msg: string, round: number) => {
    const allMessages = [
      ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: msg },
    ];

    try {
      const result = await window.harness.discovery.chat(allMessages, round);

      if (result.error || !result.response) {
        // AI 실패 → 로컬 폴백
        processLocally(msg, round);
        return;
      }

      // AI 응답 표시
      addAssistantMessage(result.response);

      // 스펙 카드가 생성되었으면 review 단계로
      if (result.specCard) {
        setSpecFromChat(result.specCard, result.presetId ?? "game");
        onSpecReady();
      }
    } catch {
      processLocally(msg, round);
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
            <div className={`max-w-[80%] p-3 rounded-lg border ${
              msg.role === "user"
                ? "bg-accent/8 border-accent/15"
                : "bg-bg-card border-border-subtle"
            }`}>
              <MarkdownRenderer content={msg.content} />
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
          <span className="text-[10px] text-text-muted">Enter로 전송 · 3번 정도 대화하면 프로젝트가 정리됩니다</span>
        </div>
      </div>
    </div>
  );
}

// ── 로컬 파싱 헬퍼 ──

function detectProjectType(text: string): { type: "game" | "webapp"; summary: string } {
  const t = text.toLowerCase();
  const gameKeywords = ["게임", "game", "rpg", "플랫포머", "슈팅", "퍼즐", "2d", "3d", "캐릭터", "스테이지", "레벨"];
  const webKeywords = ["웹", "web", "대시보드", "dashboard", "관리", "admin", "sns", "쇼핑", "ecommerce", "saas", "앱", "app"];

  const gameScore = gameKeywords.filter((k) => t.includes(k)).length;
  const webScore = webKeywords.filter((k) => t.includes(k)).length;

  if (gameScore > webScore) {
    return { type: "game", summary: "게임 프로젝트로 이해했습니다! 🎮" };
  }
  return { type: "webapp", summary: "웹 애플리케이션 프로젝트로 이해했습니다! 🌐" };
}

function buildSpecFromConversation(messages: string[]): { specCard: SpecCard; presetId: string } {
  const combined = messages.join(" ");
  const detected = detectProjectType(combined);

  // 핵심 결정 추출 (키워드 기반)
  const decisions: CoreDecision[] = [];

  // 프로젝트 유형
  decisions.push({ key: "type", label: "프로젝트 유형", value: detected.type === "game" ? "게임" : "웹 애플리케이션", source: "user" });

  // 장르/카테고리 추출
  const genres: Record<string, string> = {
    rpg: "RPG", platformer: "플랫포머", "플랫포머": "플랫포머", puzzle: "퍼즐", "퍼즐": "퍼즐",
    shooting: "슈팅", "슈팅": "슈팅", "횡스크롤": "횡스크롤", "대시보드": "대시보드",
    dashboard: "대시보드", sns: "SNS", social: "SNS", "쇼핑": "이커머스", ecommerce: "이커머스",
    saas: "SaaS", "관리": "관리 도구",
  };
  for (const [keyword, label] of Object.entries(genres)) {
    if (combined.toLowerCase().includes(keyword)) {
      decisions.push({ key: "genre", label: "장르/카테고리", value: label, source: "user" });
      break;
    }
  }

  // 나머지는 대화 내용에서 추출 시도
  const extractions = [
    { key: "target", label: "대상 사용자", patterns: [/(?:사용자|유저|타겟|대상|target)[\s:은는]?\s*(.{2,30})/i] },
    { key: "core-feature", label: "핵심 기능", patterns: [/(?:핵심|중요|메인|core|main|기능)[\s:은는]?\s*(.{2,50})/i] },
    { key: "style", label: "스타일", patterns: [/(?:스타일|비주얼|디자인|style)[\s:은는]?\s*(.{2,30})/i] },
    { key: "reference", label: "레퍼런스", patterns: [/(?:참고|레퍼런스|reference|처럼|같은)[\s:은는]?\s*(.{2,30})/i] },
  ];

  for (const ext of extractions) {
    for (const pattern of ext.patterns) {
      const match = combined.match(pattern);
      if (match) {
        decisions.push({ key: ext.key, label: ext.label, value: match[1].trim(), source: "user" });
        break;
      }
    }
  }

  // 확장 기능 제안
  const expansions: Expansion[] = detected.type === "game"
    ? [
        { id: "scoring", label: "점수 시스템", enabled: true, suggestedBy: "ai" },
        { id: "levels", label: "스테이지/레벨 시스템", enabled: true, suggestedBy: "ai" },
        { id: "sound", label: "사운드 이펙트", enabled: false, suggestedBy: "ai" },
        { id: "save", label: "세이브/로드", enabled: false, suggestedBy: "ai" },
      ]
    : [
        { id: "auth", label: "로그인/회원가입", enabled: true, suggestedBy: "ai" },
        { id: "responsive", label: "반응형 디자인", enabled: true, suggestedBy: "ai" },
        { id: "dark-mode", label: "다크 모드", enabled: false, suggestedBy: "ai" },
        { id: "notifications", label: "알림 시스템", enabled: false, suggestedBy: "ai" },
      ];

  const techStack = detected.type === "game"
    ? ["React", "TypeScript", "Canvas API"]
    : ["React", "TypeScript", "Next.js", "Tailwind CSS"];

  return {
    presetId: detected.type,
    specCard: {
      projectType: decisions.find((d) => d.key === "genre")?.value
        ? `${decisions.find((d) => d.key === "genre")!.value} ${detected.type === "game" ? "게임" : "웹앱"}`
        : detected.type === "game" ? "게임 프로젝트" : "웹 애플리케이션",
      coreDecisions: decisions,
      expansions,
      techStack,
      rawAnswers: [],
    },
  };
}
