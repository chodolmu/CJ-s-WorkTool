import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../stores/app-store";
import { PHASE_ORDER, PHASE_DEFINITIONS } from "../../shared/phase-definitions";
import type { Project, ProjectPhase } from "@shared/types";

interface DashboardPageProps {
  onNewProject: () => void;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

type ViewMode = "cards" | "timeline";

const statusConfig: Record<string, { label: string; color: string; icon: string; phaseIndex: number }> = {
  discovery:  { label: "Discovery", color: "text-status-info",    icon: "🔍", phaseIndex: 0 },
  planning:   { label: "기획중",    color: "text-status-warning", icon: "📋", phaseIndex: 1 },
  building:   { label: "빌드중",    color: "text-accent",         icon: "🔨", phaseIndex: 3 },
  paused:     { label: "일시정지",  color: "text-text-muted",     icon: "⏸",  phaseIndex: -1 },
  completed:  { label: "완료",      color: "text-status-success", icon: "✅", phaseIndex: 5 },
};

export function DashboardPage({ onNewProject, onOpenProject, onDeleteProject }: DashboardPageProps) {
  const { projects, claudeInstalled } = useAppStore();
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">대시보드</h1>
            <p className="text-xs text-text-secondary mt-0.5">
              {projects.length > 0
                ? `${projects.length} 프로젝트 · ${projects.filter((p) => p.status === "building").length} 진행중`
                : "프로젝트 없음"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            {projects.length > 0 && (
              <div className="flex bg-bg-card border border-border-subtle rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`px-2.5 py-1 text-[10px] rounded-md transition-all cursor-pointer ${
                    viewMode === "cards" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  카드
                </button>
                <button
                  onClick={() => setViewMode("timeline")}
                  className={`px-2.5 py-1 text-[10px] rounded-md transition-all cursor-pointer ${
                    viewMode === "timeline" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  타임라인
                </button>
              </div>
            )}
            <button
              onClick={onNewProject}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-all cursor-pointer active:scale-[0.98]"
            >
              + 새 프로젝트
            </button>
          </div>
        </div>

        {claudeInstalled === false && (
          <div className="p-3 bg-status-error/5 border border-status-error/20 rounded-lg text-xs text-status-error flex items-center gap-2">
            <span>⚠</span>
            <span>Claude Code CLI가 설치되어 있지 않습니다. 설정에서 확인하세요.</span>
          </div>
        )}

        {/* Empty state */}
        {projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
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
          </div>
        )}

        {/* Cards view */}
        {projects.length > 0 && viewMode === "cards" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {projects.map((project, i) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={i}
                onOpen={() => onOpenProject(project.id)}
                onDelete={() => {
                  if (confirm(`"${project.name}" 프로젝트를 삭제할까요?`)) onDeleteProject(project.id);
                }}
              />
            ))}
          </div>
        )}

        {/* Timeline view */}
        {projects.length > 0 && viewMode === "timeline" && (
          <TimelineView
            projects={projects}
            onOpenProject={onOpenProject}
          />
        )}
      </div>
    </div>
  );
}

/** Timeline view — 모든 프로젝트의 단계를 한눈에 */
function TimelineView({ projects, onOpenProject }: { projects: Project[]; onOpenProject: (id: string) => void }) {
  return (
    <div className="space-y-1">
      {/* Phase header */}
      <div className="flex items-center gap-0">
        <div className="w-40 shrink-0" />
        {PHASE_DEFINITIONS.map((phase) => (
          <div key={phase.id} className="flex-1 text-center text-[10px] text-text-muted font-medium uppercase tracking-wider px-1">
            {phase.icon} {phase.label}
          </div>
        ))}
      </div>

      {/* Project rows */}
      {projects.map((project, i) => {
        const config = statusConfig[project.status] ?? statusConfig.discovery;
        const currentPhaseIdx = config.phaseIndex;

        return (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-0 group"
          >
            {/* Project name */}
            <button
              onClick={() => onOpenProject(project.id)}
              className="w-40 shrink-0 text-left pr-3 cursor-pointer"
            >
              <div className="text-xs font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                {project.name}
              </div>
              <div className="text-[10px] text-text-muted">{config.label}</div>
            </button>

            {/* Phase progress bar */}
            {PHASE_ORDER.map((phaseId, phaseIdx) => {
              let cellState: "completed" | "active" | "locked" | "skipped" = "locked";

              if (currentPhaseIdx >= 0) {
                if (phaseIdx < currentPhaseIdx) cellState = "completed";
                else if (phaseIdx === currentPhaseIdx) cellState = "active";
              }

              if (project.status === "completed") cellState = "completed";
              if (project.status === "paused" && phaseIdx <= 1) cellState = "completed";

              return (
                <div key={phaseId} className="flex-1 px-0.5">
                  <div className={`h-6 rounded-sm transition-all ${
                    cellState === "completed" ? "bg-status-success/20 border border-status-success/30" :
                    cellState === "active" ? "bg-accent/20 border border-accent/30 animate-pulse" :
                    "bg-bg-hover border border-border-subtle"
                  }`} />
                </div>
              );
            })}
          </motion.div>
        );
      })}
    </div>
  );
}

function ProjectCard({ project, index, onOpen, onDelete }: {
  project: Project; index: number; onOpen: () => void; onDelete: () => void;
}) {
  const config = statusConfig[project.status] ?? statusConfig.discovery;
  const featuresEnabled = project.specCard?.expansions.filter((e) => e.enabled).length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group"
    >
      <button
        onClick={onOpen}
        className="w-full text-left p-4 bg-bg-card border border-border-subtle rounded-card hover:border-border-strong hover:bg-bg-hover transition-all cursor-pointer"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-text-primary truncate">{project.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs">{config.icon}</span>
              <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
              <span className="text-[10px] text-text-muted">·</span>
              <span className="text-[10px] text-text-muted">{new Date(project.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-status-error text-xs cursor-pointer transition-all p-1"
          >
            ✕
          </button>
        </div>

        {project.specCard && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1">
              {project.specCard.techStack.map((tech) => (
                <span key={tech} className="px-1.5 py-0.5 bg-accent/10 text-accent text-[10px] rounded-badge">{tech}</span>
              ))}
            </div>
            {project.specCard.coreDecisions.slice(0, 2).map((d) => (
              <div key={d.key} className="text-[11px] text-text-muted truncate">
                {d.label}: <span className="text-text-secondary">{d.value}</span>
              </div>
            ))}
          </div>
        )}

        {!project.specCard && (
          <div className="text-xs text-text-muted italic">Discovery 진행중...</div>
        )}
      </button>
    </motion.div>
  );
}
