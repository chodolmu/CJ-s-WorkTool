import React, { useState } from "react";
import { HarnessBrowser } from "../components/HarnessBrowser";
import { PresetsPage } from "./Presets/PresetsPage";
import { useAppStore } from "../stores/app-store";

type HarnessTab = "browse" | "agents";

export function HarnessPage() {
  const [tab, setTab] = useState<HarnessTab>("browse");
  const { currentProjectId, projects } = useAppStore();
  const currentProject = projects.find((p) => p.id === currentProjectId);
  const workingDir = currentProject?.workingDir;

  return (
    <div className="flex flex-col h-full">
      {/* Header + sub-tabs */}
      <div className="shrink-0 border-b border-border-subtle bg-bg-base px-4 pt-3">
        <h1 className="text-base font-medium text-text-primary mb-2">하네스</h1>
        <div className="flex gap-0.5">
          {([
            { id: "browse" as const, label: "카탈로그", icon: "🧩" },
            { id: "agents" as const, label: "에이전트 편집", icon: "🤖" },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-xs font-medium rounded-t-md transition-all cursor-pointer ${
                tab === t.id
                  ? "bg-bg-card text-accent border-t border-x border-border-subtle -mb-px"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "browse" && (
          <div className="animate-fade-in">
            <p className="text-xs text-text-secondary mb-4">
              100개의 사전 구성된 하네스에서 프로젝트에 맞는 에이전트 구성을 찾아보세요.
              {!workingDir && (
                <span className="text-status-warning ml-1">프로젝트를 선택하면 바로 적용할 수 있습니다.</span>
              )}
            </p>
            <HarnessBrowser
              projectDir={workingDir}
              mode={workingDir ? "apply" : "select"}
              onApplied={(harnessId) => {
                // Re-load project to reflect .claude/ changes
                if (currentProjectId && window.harness?.project) {
                  window.harness.project.load(currentProjectId);
                }
              }}
            />
          </div>
        )}

        {tab === "agents" && (
          <div className="animate-fade-in">
            <PresetsPage />
          </div>
        )}
      </div>
    </div>
  );
}
