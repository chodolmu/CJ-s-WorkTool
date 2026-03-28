import React, { useState, useEffect } from "react";
import { useAppStore } from "../stores/app-store";
import { toast } from "./Toast";

interface Skill {
  id: string;
  name: string;
  description: string;
  pattern: string;
  template: string;
  usageCount: number;
}

export function SkillsLibrary() {
  const { currentProjectId } = useAppStore();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentProjectId || !window.harness?.skill) {
      setIsLoading(false);
      return;
    }
    window.harness.skill.list(currentProjectId).then((result: Skill[]) => {
      setSkills(result);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [currentProjectId]);

  const handleDelete = async (skillId: string) => {
    if (!window.harness?.skill) return;
    await window.harness.skill.delete(skillId);
    setSkills((prev) => prev.filter((s) => s.id !== skillId));
    toast("info", "스킬 삭제됨");
  };

  if (!currentProjectId) {
    return (
      <div className="text-xs text-text-muted italic py-4 text-center">
        프로젝트를 시작하면 자동 감지된 스킬을 볼 수 있습니다.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((n) => <div key={n} className="h-16 skeleton" />)}
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="p-4 bg-bg-card border border-border-subtle rounded-card text-center">
        <span className="text-2xl mb-2 block">🔄</span>
        <div className="text-sm text-text-secondary mb-1">아직 감지된 스킬이 없습니다</div>
        <div className="text-xs text-text-muted">
          에이전트가 작업하면서 WorkTool이 반복 패턴을 자동 감지하여 재사용 가능한 스킬로 만듭니다.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-text-secondary uppercase tracking-wide mb-2">
        자동 감지된 스킬 ({skills.length})
      </div>
      {skills.map((skill) => (
        <div
          key={skill.id}
          className="p-3 bg-bg-card border border-border-subtle rounded-card hover:border-border-strong transition-all group"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">{skill.name}</span>
                {skill.usageCount > 0 && (
                  <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-badge">
                    {skill.usageCount}회 사용
                  </span>
                )}
              </div>
              <div className="text-xs text-text-secondary mt-0.5">{skill.description}</div>
              <div className="text-[10px] text-text-muted mt-1 font-mono truncate">
                pattern: {skill.pattern}
              </div>
            </div>
            <button
              onClick={() => handleDelete(skill.id)}
              className="text-xs text-text-muted hover:text-status-error cursor-pointer opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-2"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
