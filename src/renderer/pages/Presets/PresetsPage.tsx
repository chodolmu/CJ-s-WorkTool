import React, { useState, useEffect } from "react";
import type { AgentDefinition } from "@shared/types";
import { AgentEditorSimple } from "../../components/AgentEditorSimple";
import { AgentEditorAdvanced } from "../../components/AgentEditorAdvanced";
import { useAppStore } from "../../stores/app-store";
import { toast } from "../../components/Toast";

// Fallback mock data (IPC 없을 때)
const FALLBACK_AGENTS: AgentDefinition[] = [
  { id: "planner", displayName: "Planner", icon: "🔧", role: "기술 설계자", goal: "스펙 → 기능 목록", constraints: ["코드 직접 작성 금지"], model: "opus", trigger: "manual", guidelines: ["게임 장르별 필수 시스템 누락 방지", "MVP 최소 기능만"], outputFormat: "" },
  { id: "generator", displayName: "Generator", icon: "💻", role: "개발자", goal: "기능 구현 + 변경 요약", constraints: ["한 번에 하나의 기능만", "빌드 통과 유지"], model: "sonnet", trigger: "after_planner", guidelines: ["requestAnimationFrame 기반 게임 루프"], outputFormat: "" },
  { id: "evaluator", displayName: "Evaluator", icon: "🔍", role: "QA 엔지니어", goal: "구현 검증 + 통과/반려", constraints: ["코드 수정 금지"], model: "opus", trigger: "after_generator", guidelines: ["빌드 통과 확인", "핵심 기능 작동 확인"], outputFormat: "" },
];

const PROTECTED_AGENTS = ["planner", "generator", "evaluator"];

type EditorMode = "none" | "simple" | "advanced";

export function PresetsPage() {
  const { currentProjectId } = useAppStore();
  const [agents, setAgents] = useState<AgentDefinition[]>(FALLBACK_AGENTS);
  const [presetId, setPresetId] = useState("game");
  const [editorMode, setEditorMode] = useState<EditorMode>("none");
  const [editingAgent, setEditingAgent] = useState<AgentDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // IPC에서 프리셋 에이전트 로드
  useEffect(() => {
    if (!window.harness?.preset) {
      setIsLoading(false);
      return;
    }

    window.harness.preset.list().then((presets: { id: string; agents: AgentDefinition[] }[]) => {
      if (presets && presets.length > 0) {
        const preset = presets[0]; // 현재 프로젝트의 프리셋 (TODO: 프로젝트별 presetId)
        setPresetId(preset.id);
        if (preset.agents?.length > 0) {
          setAgents(preset.agents);
        }
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  const handleSaveAgent = async (agent: AgentDefinition, isNew: boolean) => {
    if (isNew) {
      setAgents((prev) => [...prev, agent]);
    } else {
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? agent : a)));
    }
    setEditorMode("none");
    setEditingAgent(null);

    // IPC로 저장
    if (window.harness?.agent) {
      await window.harness.agent.save(presetId, agent);
      toast("success", "에이전트 저장됨", `${agent.displayName}이(가) 저장되었습니다.`);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (PROTECTED_AGENTS.includes(agentId)) return;

    const agent = agents.find((a) => a.id === agentId);
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
    setEditorMode("none");
    setEditingAgent(null);

    if (window.harness?.agent) {
      await window.harness.agent.delete(presetId, agentId);
      toast("info", "에이전트 삭제됨", `${agent?.displayName ?? agentId}이(가) 삭제되었습니다.`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-6 skeleton w-48" />
        <div className="h-4 skeleton w-32" />
        <div className="space-y-2">
          {[1, 2, 3].map((n) => <div key={n} className="h-16 skeleton" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-lg font-medium text-text-primary">프리셋 & 에이전트</h1>
        <p className="text-xs text-text-secondary mt-0.5">
          {presetId.charAt(0).toUpperCase() + presetId.slice(1)} 프리셋
        </p>
      </div>

      {/* Agent list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary uppercase tracking-wide">
            에이전트 ({agents.length})
          </span>
          <button
            onClick={() => { setEditorMode("simple"); setEditingAgent(null); }}
            className="px-3 py-1.5 text-xs text-accent hover:text-accent-hover border border-accent/30 hover:border-accent rounded-button cursor-pointer transition-all"
          >
            + 에이전트 추가
          </button>
        </div>

        {agents.map((agent) => (
          <div
            key={agent.id}
            className="flex items-center justify-between p-3.5 bg-bg-card border border-border-subtle rounded-card hover:border-border-strong transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{agent.icon}</span>
              <div>
                <div className="text-sm font-medium text-text-primary">{agent.displayName}</div>
                <div className="text-xs text-text-secondary">{agent.role}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-badge font-medium ${
                agent.model === "opus" ? "bg-status-warning/10 text-status-warning" :
                agent.model === "haiku" ? "bg-status-info/10 text-status-info" :
                "bg-accent/10 text-accent"
              }`}>
                {agent.model}
              </span>
              <span className="text-xs text-text-muted">
                {agent.guidelines.length} 가이드라인
              </span>
              <button
                onClick={() => { setEditingAgent(agent); setEditorMode("advanced"); }}
                className="text-xs text-text-muted hover:text-accent cursor-pointer transition-colors"
              >
                편집
              </button>
              {!PROTECTED_AGENTS.includes(agent.id) && (
                <button
                  onClick={() => {
                    if (confirm(`"${agent.displayName}" 에이전트를 삭제할까요?`)) {
                      handleDeleteAgent(agent.id);
                    }
                  }}
                  className="text-xs text-text-muted hover:text-status-error cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Editor panel */}
      {editorMode === "simple" && (
        <div className="bg-bg-card border border-border-subtle rounded-card animate-slide-in-up">
          <AgentEditorSimple
            projectId={currentProjectId ?? "temp"}
            presetId={presetId}
            onGenerated={(agent) => handleSaveAgent(agent, true)}
            onSwitchToAdvanced={(agent) => { setEditingAgent(agent); setEditorMode("advanced"); }}
            onCancel={() => setEditorMode("none")}
          />
        </div>
      )}

      {editorMode === "advanced" && editingAgent && (
        <div className="bg-bg-card border border-border-subtle rounded-card animate-slide-in-up">
          <AgentEditorAdvanced
            initial={editingAgent}
            onSave={(agent) => handleSaveAgent(agent, !agents.find((a) => a.id === agent.id))}
            onDelete={
              PROTECTED_AGENTS.includes(editingAgent.id)
                ? undefined
                : () => handleDeleteAgent(editingAgent.id)
            }
            onCancel={() => setEditorMode("none")}
          />
        </div>
      )}
    </div>
  );
}
