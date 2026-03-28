import React, { useMemo } from "react";
import { useAppStore } from "../../stores/app-store";
import { StatusLabel } from "../StatusDot";
import { ChangeSummary } from "../ChangeSummary";

interface DetailPanelProps {
  agentId: string;
  onClose: () => void;
}

export function DetailPanel({ agentId, onClose }: DetailPanelProps) {
  const agents = useAppStore((s) => s.agents);
  const allActivities = useAppStore((s) => s.activities);
  const agent = useMemo(() => agents.find((a) => a.id === agentId), [agents, agentId]);
  const activities = useMemo(
    () => allActivities.filter((a) => a.agentId === agentId).slice(-20),
    [allActivities, agentId],
  );

  if (!agent) {
    return (
      <aside className="w-80 bg-bg-card border-l border-border-subtle p-4">
        <button onClick={onClose} className="text-text-muted hover:text-text-primary text-sm cursor-pointer">✕</button>
        <p className="text-text-secondary text-sm mt-4">Agent not found</p>
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-bg-card border-l border-border-subtle overflow-y-auto shrink-0">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{agent.icon}</span>
            <h2 className="text-sm font-medium text-text-primary">{agent.displayName}</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-sm cursor-pointer">✕</button>
        </div>

        {/* Status */}
        <div className="p-3 bg-bg-hover rounded-lg border border-border-subtle">
          <div className="text-xs text-text-secondary mb-1">Status</div>
          <StatusLabel status={agent.status} />
        </div>

        {/* Current task */}
        {agent.currentFeature && (
          <div className="p-3 bg-bg-hover rounded-lg border border-border-subtle">
            <div className="text-xs text-text-secondary mb-1">Current Task</div>
            <div className="text-sm text-text-primary">{agent.currentFeature}</div>
          </div>
        )}

        {/* Progress */}
        {agent.progress && (
          <div className="p-3 bg-bg-hover rounded-lg border border-border-subtle">
            <div className="text-xs text-text-secondary mb-1">Progress</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-bg-active rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full"
                  style={{ width: `${(agent.progress.current / agent.progress.total) * 100}%` }}
                />
              </div>
              <span className="text-xs text-text-secondary">
                {agent.progress.current}/{agent.progress.total}
              </span>
            </div>
          </div>
        )}

        {/* Change Summary */}
        {agent.lastChangeSummary && (
          <ChangeSummary
            summary={agent.lastChangeSummary}
            filesChanged={[]}
            agentName={agent.displayName}
          />
        )}

        {/* Recent activity */}
        <div>
          <div className="text-xs text-text-secondary mb-2">Recent Activity</div>
          {activities.length === 0 ? (
            <p className="text-xs text-text-muted italic">No activity yet</p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {activities.map((act) => (
                <div key={act.id} className="text-xs text-text-secondary p-1.5 bg-bg-hover rounded">
                  <span className="text-text-muted">
                    {new Date(act.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {" "}{act.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
