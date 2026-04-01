import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PhaseCoachMessage, TouchLevel } from "@shared/types";

interface PhaseCoachBannerProps {
  message: PhaseCoachMessage;
  onAction: (actionId: string) => void;
  onDismiss: () => void;
}

const touchLevelStyles: Record<TouchLevel, { bg: string; border: string; icon: string }> = {
  high:   { bg: "bg-accent/10", border: "border-accent/30", icon: "📋" },
  medium: { bg: "bg-status-info/10", border: "border-status-info/30", icon: "👀" },
  auto:   { bg: "bg-bg-active", border: "border-border-subtle", icon: "🤖" },
  light:  { bg: "bg-status-success/10", border: "border-status-success/30", icon: "✅" },
};

export function PhaseCoachBanner({ message, onAction, onDismiss }: PhaseCoachBannerProps) {
  const style = touchLevelStyles[message.touchLevel];

  // AUTO 레벨은 3초 후 자동 사라짐
  React.useEffect(() => {
    if (message.autoAdvance) {
      const timer = setTimeout(onDismiss, 3000);
      return () => clearTimeout(timer);
    }
  }, [message.autoAdvance, onDismiss]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className={`mx-4 mb-3 p-3 rounded-lg border ${style.bg} ${style.border}`}
      >
        <div className="flex items-start gap-2.5">
          <span className="text-base shrink-0 mt-0.5">{style.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-text-primary mb-0.5">
              {message.title}
            </div>
            <div className="text-xs text-text-secondary leading-relaxed">
              {message.description}
            </div>

            {/* 액션 버튼 */}
            {message.actions && message.actions.length > 0 && (
              <div className="flex items-center gap-2 mt-2.5">
                {message.actions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => onAction(action.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      action.type === "approve"
                        ? "bg-accent text-white hover:bg-accent-hover"
                        : "bg-bg-card border border-border-subtle text-text-primary hover:border-border-strong"
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* AUTO 레벨: 진행 인디케이터 */}
          {message.autoAdvance && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-text-muted">자동 진행</span>
              <span className="w-1.5 h-1.5 bg-status-success rounded-full animate-pulse" />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
