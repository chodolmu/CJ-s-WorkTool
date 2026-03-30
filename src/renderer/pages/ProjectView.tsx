import React, { useState, useMemo } from "react";
import { useAppStore } from "../stores/app-store";
import { AgentCard, AgentStatusSummary } from "../components/AgentCard";
import { DetailPanel } from "../components/layout/DetailPanel";
import { ActivityPanel } from "../components/layout/ActivityPanel";
import { ChatPage } from "./ChatPage";
import { SpecsPage } from "./SpecsPage";
import { LogsPage } from "./LogsPage";
import { OrchestrationPage } from "./OrchestrationPage";
import { PlanPage } from "./PlanPage";
import { toast } from "../components/Toast";
import type { SpecCard } from "@shared/types";

type ProjectTab = "overview" | "plan" | "chat" | "agents" | "pipeline" | "specs" | "logs";

const tabs: { id: ProjectTab; label: string; icon: string }[] = [
  { id: "overview", label: "개요", icon: "📊" },
  { id: "plan", label: "계획", icon: "📝" },
  { id: "chat", label: "채팅", icon: "💬" },
  { id: "agents", label: "에이전트", icon: "🤖" },
  { id: "pipeline", label: "파이프라인", icon: "🔄" },
  { id: "specs", label: "스펙", icon: "📋" },
  { id: "logs", label: "로그", icon: "📜" },
];

interface ProjectViewProps {
  projectId: string;
}

export function ProjectView({ projectId }: ProjectViewProps) {
  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");
  const { agents, pipeline, projectName, selectedAgentId, setSelectedAgent, features } = useAppStore();

  // 현재 프로젝트의 specCard (app-store에는 없으므로 projects에서 찾기)
  const projects = useAppStore((s) => s.projects);
  const currentProject = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);
  const specCard = currentProject?.specCard ?? null;

  return (
    <div className="flex flex-col h-full">
      {/* Project header + tabs */}
      <div className="shrink-0 border-b border-border-subtle bg-bg-base">
        {/* Project name + status */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div>
            <h1 className="text-base font-medium text-text-primary">{projectName ?? "프로젝트"}</h1>
            <div className="text-[11px] text-text-secondary mt-0.5">
              {pipeline.status === "running" ? "빌드 중..." :
               pipeline.status === "completed" ? "완료" :
               pipeline.status === "waiting_checkpoint" ? "입력 대기중" :
               pipeline.status}
              {pipeline.totalFeatures > 0 && (
                <span className="ml-2">· {pipeline.completedFeatures}/{pipeline.totalFeatures} 기능</span>
              )}
            </div>
          </div>
          <AgentStatusSummary agents={agents} />
        </div>

        {/* Sub-tabs */}
        <div className="flex px-4 gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-medium rounded-t-md transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-bg-card text-accent border-t border-x border-border-subtle -mb-px"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {activeTab === "overview" && (
            <OverviewTab specCard={specCard} />
          )}
          {activeTab === "plan" && (
            <PlanPage projectId={projectId} />
          )}
          {activeTab === "chat" && (
            <ChatPage />
          )}
          {activeTab === "agents" && (
            <div className="p-4">
              <AgentsTab onSelectAgent={setSelectedAgent} />
            </div>
          )}
          {activeTab === "pipeline" && (
            <div className="p-4">
              <OrchestrationPage specCard={specCard} />
            </div>
          )}
          {activeTab === "specs" && (
            <div className="p-4">
              <SpecsPage specCard={specCard} />
            </div>
          )}
          {activeTab === "logs" && (
            <div className="p-4">
              <LogsPage />
            </div>
          )}
        </div>

        {/* Detail panel (agent selected) */}
        {selectedAgentId && (activeTab === "overview" || activeTab === "agents") && (
          <DetailPanel
            agentId={selectedAgentId}
            onClose={() => setSelectedAgent(null)}
          />
        )}
      </div>

      {/* Activity bar (collapsed by default in project view) */}
      {activeTab !== "logs" && activeTab !== "chat" && (
        <ActivityBar />
      )}
    </div>
  );
}

function OverviewTab({ specCard }: { specCard: SpecCard | null }) {
  const { agents, pipeline, features, selectedAgentId, currentProjectId } = useAppStore();
  const projects = useAppStore((s) => s.projects);
  const currentProject = projects.find((p) => p.id === currentProjectId);
  const workingDir = currentProject?.workingDir || ".";

  const handleStartPipeline = async () => {
    if (!currentProjectId || !window.harness?.pipeline) return;
    // 설정에서 maxRetries, autoApprove 로드
    let maxRetries = 10;
    let autoApprove = false;
    try {
      const stored = localStorage.getItem("worktool-settings");
      if (stored) {
        const s = JSON.parse(stored);
        maxRetries = s.maxRetries ?? 10;
        autoApprove = s.autoApprove ?? false;
      }
    } catch {}
    try {
      await window.harness.pipeline.start(currentProjectId, workingDir, maxRetries, autoApprove);
      toast("success", "파이프라인 시작",
        autoApprove
          ? "자동 진행 모드로 실행 중입니다."
          : "Planner → Generator → Evaluator 파이프라인이 실행 중입니다.",
      );
    } catch (err) {
      toast("error", "파이프라인 실패", String(err));
    }
  };

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* Start Pipeline button */}
      {pipeline.status === "idle" && agents.length > 0 && (
        <div className="p-4 bg-accent/5 border border-accent/20 rounded-card flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-text-primary">빌드 준비 완료</div>
            <div className="text-xs text-text-secondary mt-0.5">
              {agents.length} 에이전트 구성됨 · 작업 폴더: {workingDir || "(미설정)"}
            </div>
          </div>
          <button
            onClick={handleStartPipeline}
            disabled={!workingDir}
            className="px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-all cursor-pointer active:scale-[0.98] disabled:opacity-40"
          >
            ▶ 파이프라인 시작
          </button>
        </div>
      )}

      {/* Progress */}
      {pipeline.totalFeatures > 0 && (
        <div>
          <div className="flex justify-between text-xs text-text-secondary mb-1">
            <span>{pipeline.currentFeature ?? "준비"}</span>
            <span>{pipeline.completedFeatures}/{pipeline.totalFeatures} 기능</span>
          </div>
          <div className="w-full h-2 bg-bg-active rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700"
              style={{ width: `${pipeline.totalFeatures > 0 ? (pipeline.completedFeatures / pipeline.totalFeatures) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Agent cards */}
      <div>
        <div className="text-xs text-text-secondary uppercase tracking-wide mb-2">에이전트</div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((agent, i) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isSelected={selectedAgentId === agent.id}
              onClick={() => useAppStore.getState().setSelectedAgent(agent.id)}
              index={i}
            />
          ))}
        </div>
      </div>

      {/* Quick spec summary */}
      {specCard && (
        <div className="p-3 bg-bg-card border border-border-subtle rounded-card">
          <div className="text-xs text-text-secondary uppercase tracking-wide mb-2">스펙 요약</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {specCard.techStack.map((t) => (
              <span key={t} className="px-2 py-0.5 bg-accent/10 text-accent text-[10px] rounded-badge">{t}</span>
            ))}
          </div>
          <div className="space-y-1">
            {specCard.coreDecisions.slice(0, 3).map((d) => (
              <div key={d.key} className="text-xs text-text-muted">
                {d.label}: <span className="text-text-primary">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      {features.length > 0 && (
        <div>
          <div className="text-xs text-text-secondary uppercase tracking-wide mb-2">
            기능 ({features.filter((f) => f.status === "completed").length}/{features.length})
          </div>
          <div className="space-y-1">
            {features.map((f) => (
              <div key={f.id} className="flex items-center gap-2 p-2 bg-bg-card border border-border-subtle rounded-md text-xs">
                <span>{f.status === "completed" ? "✅" : f.status === "in_progress" ? "🔄" : f.status === "failed" ? "❌" : "⏳"}</span>
                <span className="text-text-primary">{f.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentsTab({ onSelectAgent }: { onSelectAgent: (id: string) => void }) {
  const { agents, selectedAgentId } = useAppStore();

  if (agents.length === 0) {
    return <p className="text-sm text-text-secondary">에이전트가 없습니다. Discovery를 시작하여 에이전트를 구성하세요.</p>;
  }

  return (
    <div className="space-y-2">
      {agents.map((agent, i) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          isSelected={selectedAgentId === agent.id}
          onClick={() => onSelectAgent(agent.id)}
          index={i}
        />
      ))}
    </div>
  );
}

function ActivityBar() {
  const [open, setOpen] = useState(false);
  const activities = useAppStore((s) => s.activities);

  return (
    <div className="border-t border-border-subtle bg-bg-base shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-1.5 hover:bg-bg-hover transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">활동</span>
          {activities.length > 0 && (
            <span className="text-[10px] text-text-muted bg-bg-active px-1.5 py-0.5 rounded-badge">{activities.length}</span>
          )}
        </div>
        <span className="text-[10px] text-text-muted">{open ? "▼" : "▲"}</span>
      </button>
      {open && (
        <div className="h-32 px-3 pb-2 overflow-y-auto text-xs font-mono space-y-0.5">
          {activities.length === 0 ? (
            <div className="text-text-muted text-center py-4">아직 활동이 없습니다</div>
          ) : (
            activities.slice(-30).map((a) => (
              <div key={a.id} className="text-text-secondary truncate">
                <span className="text-text-muted">{new Date(a.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                {" "}{a.message}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
