import React from "react";
import { motion } from "framer-motion";
import type { AgentStatus } from "@shared/types";
import { StatusDot } from "./StatusDot";

export interface AgentCardData {
  id: string;
  displayName: string;
  icon: string;
  status: AgentStatus;
  currentFeature: string | null;
  progress: { current: number; total: number } | null;
  lastChangeSummary: string | null;
  lastActivity: string | null;
  trigger?: string;
}

interface AgentCardProps {
  agent: AgentCardData;
  isSelected: boolean;
  onClick: () => void;
  index?: number;
}

export function AgentCard({ agent, isSelected, onClick, index = 0 }: AgentCardProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.2 }}
      onClick={onClick}
      className={`
        w-full text-left p-3.5 rounded-card border transition-all cursor-pointer
        ${isSelected
          ? "border-accent bg-accent/5 glow-accent"
          : "border-border-subtle bg-bg-card hover:border-border-strong hover:bg-bg-hover"
        }
      `}
    >
      {/* Header: icon + name + status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{agent.icon}</span>
          <span className="text-sm font-medium text-text-primary">
            {agent.displayName}
          </span>
        </div>
        <StatusDot status={agent.status} />
      </div>

      {/* Current task */}
      {agent.currentFeature && (
        <div className="text-xs text-text-secondary mb-2 truncate">
          → {agent.currentFeature}
        </div>
      )}

      {/* Progress bar */}
      {agent.progress && (
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-text-muted mb-1">
            <span>진행</span>
            <span>{agent.progress.current}/{agent.progress.total}</span>
          </div>
          <div className="w-full h-1 bg-bg-active rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${agent.progress.total > 0 ? (agent.progress.current / agent.progress.total) * 100 : 0}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full bg-accent rounded-full"
            />
          </div>
        </div>
      )}

      {/* Change summary preview */}
      {agent.lastChangeSummary && (
        <div className="text-xs text-text-muted line-clamp-2 leading-relaxed">
          {agent.lastChangeSummary}
        </div>
      )}

      {/* Idle state */}
      {agent.status === "queued" && !agent.currentFeature && (
        <div className="text-xs text-text-muted italic">대기중...</div>
      )}
    </motion.button>
  );
}

/** 집계 상태 배지 바 */
export function AgentStatusSummary({ agents }: { agents: AgentCardData[] }) {
  const running = agents.filter((a) => a.status === "running").length;
  const completed = agents.filter((a) => a.status === "completed").length;
  const failed = agents.filter((a) => a.status === "failed").length;
  const queued = agents.filter((a) => a.status === "queued").length;

  return (
    <div className="flex items-center gap-2">
      {running > 0 && <Badge count={running} label="실행중" dotColor="bg-status-success" />}
      {completed > 0 && <Badge count={completed} label="완료" dotColor="bg-status-info" />}
      {failed > 0 && <Badge count={failed} label="오류" dotColor="bg-status-error" />}
      {queued > 0 && <Badge count={queued} label="대기" dotColor="bg-status-neutral" />}
      {agents.length === 0 && (
        <span className="text-xs text-text-muted">에이전트 없음</span>
      )}
    </div>
  );
}

function Badge({ count, label, dotColor }: { count: number; label: string; dotColor: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-bg-card rounded-md border border-border-subtle">
      <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span className="text-xs font-medium text-text-primary">{count}</span>
      <span className="text-[10px] text-text-secondary">{label}</span>
    </div>
  );
}
