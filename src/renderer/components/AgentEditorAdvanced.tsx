import React, { useState } from "react";
import type { AgentDefinition } from "@shared/types";

interface AgentEditorAdvancedProps {
  initial: AgentDefinition;
  onSave: (agent: AgentDefinition) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function AgentEditorAdvanced({
  initial,
  onSave,
  onDelete,
  onCancel,
}: AgentEditorAdvancedProps) {
  const [agent, setAgent] = useState<AgentDefinition>({ ...initial });
  const [newGuideline, setNewGuideline] = useState("");
  const [newConstraint, setNewConstraint] = useState("");

  const update = <K extends keyof AgentDefinition>(key: K, value: AgentDefinition[K]) =>
    setAgent((prev) => ({ ...prev, [key]: value }));

  const addGuideline = () => {
    if (!newGuideline.trim()) return;
    update("guidelines", [...agent.guidelines, newGuideline.trim()]);
    setNewGuideline("");
  };

  const removeGuideline = (i: number) =>
    update("guidelines", agent.guidelines.filter((_, idx) => idx !== i));

  const addConstraint = () => {
    if (!newConstraint.trim()) return;
    update("constraints", [...agent.constraints, newConstraint.trim()]);
    setNewConstraint("");
  };

  const removeConstraint = (i: number) =>
    update("constraints", agent.constraints.filter((_, idx) => idx !== i));

  return (
    <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
      <h3 className="text-sm font-medium text-text-primary">
        에이전트 편집: {agent.displayName}
      </h3>

      {/* Basic info */}
      <div className="grid grid-cols-2 gap-3">
        <InputField label="아이콘" value={agent.icon} onChange={(v) => update("icon", v)} />
        <InputField label="표시 이름" value={agent.displayName} onChange={(v) => update("displayName", v)} />
      </div>

      <InputField label="역할" value={agent.role} onChange={(v) => update("role", v)} />
      <TextareaField label="목표" value={agent.goal} onChange={(v) => update("goal", v)} />

      {/* Model & Trigger */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-secondary mb-1 block">모델</label>
          <div className="flex gap-2">
            {(["sonnet", "opus", "haiku"] as const).map((m) => (
              <button
                key={m}
                onClick={() => update("model", m)}
                className={`px-3 py-1 rounded text-xs cursor-pointer border ${
                  agent.model === m
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border-subtle text-text-secondary hover:border-border-strong"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1 block">트리거</label>
          <select
            value={agent.trigger}
            onChange={(e) => update("trigger", e.target.value as AgentDefinition["trigger"])}
            className="w-full px-2 py-1.5 bg-bg-card border border-border-subtle rounded text-xs text-text-primary"
          >
            <option value="manual">수동</option>
            <option value="after_planner">Planner 후</option>
            <option value="after_generator">Generator 후</option>
            <option value="after_evaluator">Evaluator 후</option>
          </select>
        </div>
      </div>

      {/* Guidelines */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-text-secondary">가이드라인</label>
          <button
            onClick={() => {/* TODO: AI regenerate */}}
            className="text-xs text-accent hover:text-accent-hover cursor-pointer"
          >
            AI 재생성
          </button>
        </div>
        <div className="space-y-1 mb-2">
          {agent.guidelines.map((g, i) => (
            <div key={i} className="flex items-start gap-1.5 group">
              <span className="text-xs text-text-primary flex-1 pl-2 border-l-2 border-border-subtle py-0.5">
                {g}
              </span>
              <button
                onClick={() => removeGuideline(i)}
                className="text-xs text-text-muted hover:text-status-error opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            value={newGuideline}
            onChange={(e) => setNewGuideline(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGuideline()}
            placeholder="가이드라인 추가..."
            className="flex-1 px-2 py-1 bg-bg-card border border-border-subtle rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <button onClick={addGuideline} className="px-2 py-1 text-xs text-accent hover:text-accent-hover cursor-pointer">
            +
          </button>
        </div>
      </div>

      {/* Constraints */}
      <div>
        <label className="text-xs text-text-secondary mb-1 block">제약조건</label>
        <div className="space-y-1 mb-2">
          {agent.constraints.map((c, i) => (
            <div key={i} className="flex items-start gap-1.5 group">
              <span className="text-xs text-text-primary flex-1 pl-2 border-l-2 border-status-warning/30 py-0.5">
                {c}
              </span>
              <button
                onClick={() => removeConstraint(i)}
                className="text-xs text-text-muted hover:text-status-error opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            value={newConstraint}
            onChange={(e) => setNewConstraint(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addConstraint()}
            placeholder="제약조건 추가..."
            className="flex-1 px-2 py-1 bg-bg-card border border-border-subtle rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <button onClick={addConstraint} className="px-2 py-1 text-xs text-accent hover:text-accent-hover cursor-pointer">
            +
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
        {onDelete && (
          <button onClick={onDelete} className="px-3 py-1.5 text-xs text-status-error hover:bg-status-error/10 rounded cursor-pointer">
            삭제
          </button>
        )}
        <div className="flex gap-2 ml-auto">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary cursor-pointer">
            취소
          </button>
          <button
            onClick={() => onSave(agent)}
            className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-button text-xs font-medium cursor-pointer"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-text-secondary mb-1 block">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 bg-bg-card border border-border-subtle rounded text-xs text-text-primary focus:outline-none focus:border-accent"
      />
    </div>
  );
}

function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-text-secondary mb-1 block">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full px-2 py-1.5 bg-bg-card border border-border-subtle rounded text-xs text-text-primary focus:outline-none focus:border-accent resize-none"
      />
    </div>
  );
}
