import React, { useState } from "react";
import { useDiscoveryStore } from "../../stores/discovery-store";
import type { CatalogAgent } from "../../data/agent-catalog";
import type { AgentDefinition } from "@shared/types";

interface AgentTeamSetupProps {
  onConfirm: () => void;
  onBack: () => void;
}

export function AgentTeamSetup({ onConfirm, onBack }: AgentTeamSetupProps) {
  const { catalogAgents, selectedAgentIds, toggleAgent } = useDiscoveryStore();

  const core = catalogAgents.filter((a) => a.category === "core");
  const recommended = catalogAgents.filter((a) => a.category === "recommended");
  const optional = catalogAgents.filter((a) => a.category === "optional");

  const selectedCount = selectedAgentIds.size;
  const tokenEstimate = catalogAgents
    .filter((a) => selectedAgentIds.has(a.id))
    .reduce((sum, a) => sum + (a.model === "opus" ? 3 : a.model === "sonnet" ? 2 : 1), 0);

  return (
    <div className="flex flex-col items-center justify-start h-full overflow-y-auto py-8 px-6">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-text-primary mb-1">AI 팀 구성</h2>
          <p className="text-sm text-text-secondary">
            프로젝트 특성에 맞는 에이전트를 추천합니다.
            <br />
            필요한 에이전트를 선택/해제하여 팀을 구성하세요.
          </p>
        </div>

        {/* Summary bar */}
        <div className="flex items-center justify-between p-3 bg-bg-card border border-border-subtle rounded-card">
          <div className="flex items-center gap-4">
            <div className="text-xs text-text-secondary">
              <span className="text-text-primary font-medium">{selectedCount}</span> 에이전트 선택됨
            </div>
            <div className="text-xs text-text-muted">
              예상 비용: <span className="text-text-secondary">{tokenEstimate}x</span> /기능 사이클
            </div>
          </div>
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent" title="Core" />
            <span className="w-2 h-2 rounded-full bg-status-success" title="Recommended" />
            <span className="w-2 h-2 rounded-full bg-text-muted" title="Optional" />
          </div>
        </div>

        {/* Core agents */}
        <AgentSection
          title="핵심 에이전트"
          subtitle="항상 활성 — 모든 프로젝트의 기반"
          agents={core}
          selectedIds={selectedAgentIds}
          onToggle={toggleAgent}
          dotColor="bg-accent"
        />

        {/* Recommended agents */}
        {recommended.length > 0 && (
          <AgentSection
            title="프로젝트에 추천"
            subtitle="AI가 선택 결과를 기반으로 추천"
            agents={recommended}
            selectedIds={selectedAgentIds}
            onToggle={toggleAgent}
            dotColor="bg-status-success"
          />
        )}

        {/* Optional agents */}
        {optional.length > 0 && (
          <AgentSection
            title="선택 사항"
            subtitle="있으면 좋은 것 — 추가 검증이 필요하면 활성화"
            agents={optional}
            selectedIds={selectedAgentIds}
            onToggle={toggleAgent}
            dotColor="bg-text-muted"
          />
        )}

        {/* Custom agent */}
        <CustomAgentAdder />

        {/* Actions */}
        <div className="flex justify-center gap-3 pt-2 pb-4">
          <button
            onClick={onBack}
            className="px-5 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            ← 스펙으로 돌아가기
          </button>
          <button
            onClick={onConfirm}
            className="px-8 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-all cursor-pointer active:scale-[0.98]"
          >
            {selectedCount}개 에이전트로 빌드 시작 →
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentSection({
  title,
  subtitle,
  agents,
  selectedIds,
  onToggle,
  dotColor,
}: {
  title: string;
  subtitle: string;
  agents: CatalogAgent[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  dotColor: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">{title}</span>
      </div>
      <p className="text-[11px] text-text-muted mb-2.5">{subtitle}</p>

      <div className="space-y-1.5">
        {agents.map((agent) => (
          <AgentToggleCard
            key={agent.id}
            agent={agent}
            isSelected={selectedIds.has(agent.id)}
            onToggle={() => onToggle(agent.id)}
          />
        ))}
      </div>
    </div>
  );
}

function AgentToggleCard({
  agent,
  isSelected,
  onToggle,
}: {
  agent: CatalogAgent;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const isCore = agent.category === "core";

  return (
    <button
      onClick={isCore ? undefined : onToggle}
      className={`
        w-full flex items-center gap-3 p-3 rounded-card border transition-all text-left
        ${isCore
          ? "border-accent/20 bg-accent/5 cursor-default"
          : isSelected
            ? "border-border-strong bg-bg-card hover:bg-bg-hover cursor-pointer"
            : "border-border-subtle bg-bg-base hover:bg-bg-hover cursor-pointer opacity-60 hover:opacity-80"
        }
      `}
    >
      {/* Toggle / lock icon */}
      <div className="shrink-0 w-5 flex items-center justify-center">
        {isCore ? (
          <span className="text-[10px] text-accent">🔒</span>
        ) : (
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
            isSelected
              ? "border-accent bg-accent"
              : "border-border-strong bg-transparent"
          }`}>
            {isSelected && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Icon */}
      <span className="text-xl shrink-0">{agent.icon}</span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{agent.displayName}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-badge font-medium ${
            agent.model === "opus" ? "bg-status-warning/10 text-status-warning" :
            agent.model === "haiku" ? "bg-status-info/10 text-status-info" :
            "bg-accent/10 text-accent"
          }`}>
            {agent.model}
          </span>
        </div>
        <div className="text-xs text-text-muted mt-0.5">{agent.reason}</div>
      </div>
    </button>
  );
}

function CustomAgentAdder() {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [icon, setIcon] = useState("🤖");
  const store = useDiscoveryStore();

  const handleAdd = () => {
    if (!name.trim() || !role.trim()) return;

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    const newAgent: CatalogAgent = {
      id,
      displayName: name.trim(),
      icon,
      role: role.trim(),
      goal: role.trim(),
      constraints: [],
      model: "sonnet",
      trigger: "manual",
      guidelines: [],
      outputFormat: "",
      category: "optional",
      reason: "사용자가 직접 추가한 에이전트",
      matchTags: [],
    };

    // store에 추가하고 자동 선택
    const updatedCatalog = [...store.catalogAgents, newAgent];
    const updatedSelected = new Set(store.selectedAgentIds);
    updatedSelected.add(id);

    // Zustand store 직접 업데이트
    useDiscoveryStore.setState({
      catalogAgents: updatedCatalog,
      selectedAgentIds: updatedSelected,
    });

    setIsAdding(false);
    setName("");
    setRole("");
    setIcon("🤖");
  };

  if (!isAdding) {
    return (
      <div>
        <button
          onClick={() => setIsAdding(true)}
          className="w-full p-3 border-2 border-dashed border-border-subtle rounded-card text-sm text-text-muted hover:text-accent hover:border-accent/30 transition-all cursor-pointer"
        >
          + 커스텀 에이전트 추가
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-bg-card border border-accent/20 rounded-card space-y-3 animate-fade-in">
      <div className="text-xs font-medium text-text-secondary uppercase tracking-wide">새 커스텀 에이전트</div>

      <div className="flex gap-2">
        {/* Icon picker (간단한 이모지 선택) */}
        <div className="shrink-0">
          <div className="text-[10px] text-text-muted mb-1">아이콘</div>
          <div className="flex gap-1">
            {["🤖", "🧠", "🎯", "📝", "🔧", "🛡️", "📊", "🎨"].map((e) => (
              <button
                key={e}
                onClick={() => setIcon(e)}
                className={`w-8 h-8 flex items-center justify-center rounded cursor-pointer transition-all ${
                  icon === e ? "bg-accent/20 border border-accent/30" : "hover:bg-bg-hover"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="text-[10px] text-text-muted mb-1">에이전트 이름</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 보안 검토자"
          className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      </div>

      <div>
        <div className="text-[10px] text-text-muted mb-1">역할 / 목표</div>
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. 코드 보안 취약점 검사 및 리포트"
          className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => { setIsAdding(false); setName(""); setRole(""); }}
          className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary cursor-pointer"
        >
          취소
        </button>
        <button
          onClick={handleAdd}
          disabled={!name.trim() || !role.trim()}
          className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-button text-xs font-medium cursor-pointer disabled:opacity-40 transition-all"
        >
          에이전트 추가
        </button>
      </div>
    </div>
  );
}
