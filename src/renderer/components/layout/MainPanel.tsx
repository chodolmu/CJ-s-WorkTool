import React from "react";
import type { Page } from "../../App";
import { useAppStore } from "../../stores/app-store";
import { AgentCard, AgentStatusSummary } from "../AgentCard";
import { PresetsPage } from "../../pages/Presets/PresetsPage";
import { SettingsPage } from "../../pages/SettingsPage";
import { ChatPage } from "../../pages/ChatPage";
import { SpecsPage } from "../../pages/SpecsPage";
import { LogsPage } from "../../pages/LogsPage";
import { OrchestrationPage } from "../../pages/OrchestrationPage";
import { PhaseTracker } from "../PhaseTracker";
import { SkillsLibrary } from "../SkillsLibrary";
import type { SpecCard, ProjectPhaseState } from "@shared/types";

interface MainPanelProps {
  currentPage: Page;
  onSelectAgent: (agentId: string) => void;
  onNewProject?: () => void;
  specCard?: SpecCard | null;
  phaseState?: ProjectPhaseState | null;
  onPhaseChange?: (state: ProjectPhaseState) => void;
}

export function MainPanel({ currentPage, onSelectAgent, onNewProject, specCard, phaseState, onPhaseChange }: MainPanelProps) {
  return (
    <main className="flex-1 overflow-y-auto p-4">
      {currentPage === "home" && <HomePage onSelectAgent={onSelectAgent} onNewProject={onNewProject} phaseState={phaseState} onPhaseChange={onPhaseChange} />}
      {currentPage === "chat" && <ChatPage />}
      {currentPage === "agents" && <AgentsPage onSelectAgent={onSelectAgent} />}
      {currentPage === "orchestration" && <OrchestrationPage />}
      {currentPage === "specs" && <SpecsPage specCard={specCard ?? null} />}
      {currentPage === "logs" && <LogsPage />}
      {currentPage === "presets" && <PresetsPage />}
      {currentPage === "settings" && <SettingsPage />}
    </main>
  );
}

function HomePage({ onSelectAgent, onNewProject, phaseState, onPhaseChange }: {
  onSelectAgent: (id: string) => void;
  onNewProject?: () => void;
  phaseState?: ProjectPhaseState | null;
  onPhaseChange?: (state: ProjectPhaseState) => void;
}) {
  const { agents, pipeline, projectName, selectedAgentId, claudeInstalled } = useAppStore();
  const hasProject = agents.length > 0;

  if (!hasProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-5 glow-accent">
          <span className="text-2xl font-bold text-accent">W</span>
        </div>
        <h2 className="text-lg font-medium mb-2">WorkTool에 오신 걸 환영합니다</h2>
        <p className="text-sm text-text-secondary mb-6 max-w-md">
          만들고 싶은 것을 알려주세요. AI 에이전트가 기획, 코드 작성, 검증까지 해드립니다.
        </p>
        <button
          onClick={onNewProject}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-all cursor-pointer active:scale-[0.98]"
        >
          + 새 프로젝트
        </button>

        {claudeInstalled === false && (
          <div className="mt-5 p-3 bg-status-error/5 border border-status-error/20 rounded-lg text-xs text-status-error max-w-sm">
            Claude Code CLI가 설치되어 있지 않습니다. 파이프라인 실행에 필요합니다.
            설정에서 확인하세요.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Project header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-text-primary">{projectName ?? "프로젝트"}</h1>
          <div className="text-xs text-text-secondary mt-0.5">
            {pipeline.status === "running" ? "빌드 중..." :
             pipeline.status === "completed" ? "완료" :
             pipeline.status === "waiting_checkpoint" ? "입력 대기중" :
             pipeline.status}
          </div>
        </div>
        <AgentStatusSummary agents={agents} />
      </div>

      {/* Overall progress */}
      {pipeline.totalFeatures > 0 && (
        <div>
          <div className="flex justify-between text-xs text-text-secondary mb-1">
            <span>{pipeline.currentFeature ?? "준비"}</span>
            <span>{pipeline.completedFeatures}/{pipeline.totalFeatures} 기능</span>
          </div>
          <div className="w-full h-2 bg-bg-active rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700"
              style={{ width: `${(pipeline.completedFeatures / pipeline.totalFeatures) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Phase tracker */}
      {phaseState && onPhaseChange && (
        <PhaseTracker phaseState={phaseState} onPhaseChange={onPhaseChange} compact />
      )}

      {/* Agent cards grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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

      {/* Skills library */}
      <SkillsLibrary />
    </div>
  );
}

function AgentsPage({ onSelectAgent }: { onSelectAgent: (id: string) => void }) {
  const { agents, selectedAgentId } = useAppStore();

  if (agents.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-medium">에이전트</h1>
        <p className="text-text-secondary text-sm">
          에이전트가 없습니다. 프로젝트를 시작하면 에이전트를 볼 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium">에이전트</h1>
      <div className="space-y-2">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isSelected={selectedAgentId === agent.id}
            onClick={() => onSelectAgent(agent.id)}
          />
        ))}
      </div>
    </div>
  );
}
