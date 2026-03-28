import React, { useState } from "react";
import { motion } from "framer-motion";

interface DecisionModalProps {
  decision: {
    id: string;
    agentId: string;
    question: string;
    options: string[];
    context: string;
    severity: "normal" | "high";
  };
  onRespond: (answer: string) => void;
}

export function DecisionModal({ decision, onRespond }: DecisionModalProps) {
  const [customAnswer, setCustomAnswer] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const isHigh = decision.severity === "high";

  const handleCustomSubmit = () => {
    if (customAnswer.trim()) {
      onRespond(customAnswer.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg bg-bg-card border border-border-subtle rounded-card card-shadow overflow-hidden"
      >
        {/* Header */}
        <div className={`px-5 py-3 border-b border-border-subtle ${
          isHigh ? "bg-status-error/5" : "bg-accent/5"
        }`}>
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{isHigh ? "⚠️" : "🤔"}</span>
            <div>
              <span className="text-sm font-medium text-text-primary">
                {isHigh ? "주의 필요" : "결정 필요"}
              </span>
              <span className="text-xs text-text-muted ml-2">출처: {decision.agentId}</span>
            </div>
          </div>
        </div>

        {/* Question */}
        <div className="p-5">
          <p className="text-sm text-text-primary mb-4 leading-relaxed">
            {decision.question}
          </p>

          {decision.context && (
            <div className="text-xs text-text-muted bg-bg-hover rounded-md p-2.5 mb-4">
              맥락: {decision.context}
            </div>
          )}

          {/* Options */}
          <div className="space-y-2 mb-4">
            {decision.options.map((option, i) => (
              <button
                key={i}
                onClick={() => onRespond(option)}
                className="w-full text-left px-4 py-2.5 bg-bg-hover border border-border-subtle rounded-lg text-sm text-text-primary hover:border-accent hover:bg-accent/5 transition-all cursor-pointer"
              >
                <span className="text-text-muted mr-2">{i + 1}.</span>
                {option}
              </button>
            ))}
          </div>

          {/* Custom answer */}
          {!showCustom ? (
            <button
              onClick={() => setShowCustom(true)}
              className="text-xs text-accent hover:text-accent-hover cursor-pointer"
            >
              또는 직접 입력...
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                value={customAnswer}
                onChange={(e) => setCustomAnswer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                placeholder="결정 내용을 입력하세요..."
                className="flex-1 px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                autoFocus
              />
              <button
                onClick={handleCustomSubmit}
                disabled={!customAnswer.trim()}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium cursor-pointer disabled:opacity-40 transition-all"
              >
                전송
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
