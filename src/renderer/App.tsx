import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./components/layout/Sidebar";
import { Titlebar } from "./components/layout/Titlebar";
import { DashboardPage } from "./pages/DashboardPage";
import { ProjectView } from "./pages/ProjectView";
import { DiscoveryPage } from "./pages/Discovery/DiscoveryPage";
import { PresetsPage } from "./pages/Presets/PresetsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SchedulePage } from "./pages/SchedulePage";
import { CheckpointModal } from "./components/CheckpointModal";
import { DecisionModal } from "./components/DecisionModal";
import { ToastContainer } from "./components/Toast";
import { useAppStore } from "./stores/app-store";
import { useIpcEvents } from "./hooks/useIpcEvents";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import type { SpecCard, Project, AgentDefinition } from "@shared/types";

// 최상위 페이지: Dashboard(전체) | Project(상세) | Schedule(일정) | Presets | Settings
export type TopPage = "dashboard" | "project" | "schedule" | "presets" | "settings";

export default function App() {
  const [topPage, setTopPage] = useState<TopPage>("dashboard");
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<any>(null);

  const {
    pendingCheckpoint,
    setCheckpoint,
    selectedAgentId,
    setSelectedAgent,
    initAgents,
    setProject,
    setProjects,
    setFeatures,
    setClaudeInstalled,
    reset,
    projects,
  } = useAppStore();

  useIpcEvents();

  useKeyboardShortcuts({
    onNavigate: (page) => {
      // Ctrl+1 = dashboard, Ctrl+2 = project, Ctrl+3 = schedule, Ctrl+4 = presets, Ctrl+5 = settings
      const map: Record<string, TopPage> = { "1": "dashboard", "2": "project", "3": "schedule", "4": "presets", "5": "settings" };
      if (map[page as string]) setTopPage(map[page as string]);
    },
    onNewProject: () => setShowDiscovery(true),
    onClosePanel: () => {
      if (selectedAgentId) setSelectedAgent(null);
      else if (showDiscovery) setShowDiscovery(false);
    },
  });

  // 앱 시작 시 프로젝트 목록 로드
  useEffect(() => {
    if (!window.harness) return;

    window.harness.project.list().then((projects: Project[]) => {
      setProjects(projects);
    });

    const cleanups: (() => void)[] = [];

    cleanups.push(
      window.harness.on("system:claude-status", (data: { installed: boolean }) => {
        setClaudeInstalled(data.installed);
      }),
    );

    cleanups.push(
      window.harness.on("decision:request", (data: any) => {
        setPendingDecision(data);
      }),
    );

    return () => cleanups.forEach((c) => c());
  }, []);

  const openProject = useCallback((projectId: string) => {
    setActiveProjectId(projectId);
    setTopPage("project");

    // 프로젝트 데이터 로드
    // 프로젝트 목록에서 찾기 (이미 로드됨)
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      setProject(project.id, project.name);
      // DB에 저장된 에이전트가 있으면 사용, 없으면 기본 3개
      const agentDefs = Array.isArray(project.selectedAgents) && project.selectedAgents.length > 0
        ? project.selectedAgents.map((a: any) => ({ id: a.id, displayName: a.displayName, icon: a.icon, trigger: a.trigger }))
        : [
            { id: "director", displayName: "Director", icon: "🎬", trigger: "manual" },
            { id: "planner", displayName: "Planner", icon: "🔧", trigger: "manual" },
            { id: "generator", displayName: "Generator", icon: "💻", trigger: "after_planner" },
            { id: "evaluator", displayName: "Evaluator", icon: "🔍", trigger: "after_generator" },
          ];
      initAgents(agentDefs);
      window.harness?.session.start(project.id);
    } else if (window.harness) {
      // 목록에 없으면 IPC로 로드
      window.harness.project.load(projectId).then((p: Project | null) => {
        if (p) {
          setProject(p.id, p.name);
          const defs = Array.isArray(p.selectedAgents) && p.selectedAgents.length > 0
            ? p.selectedAgents.map((a: any) => ({ id: a.id, displayName: a.displayName, icon: a.icon, trigger: a.trigger }))
            : [
                { id: "director", displayName: "Director", icon: "🎬", trigger: "manual" },
                { id: "planner", displayName: "Planner", icon: "🔧", trigger: "manual" },
                { id: "generator", displayName: "Generator", icon: "💻", trigger: "after_planner" },
                { id: "evaluator", displayName: "Evaluator", icon: "🔍", trigger: "after_generator" },
              ];
          initAgents(defs);
          window.harness?.session.start(p.id);
        }
      });
    }
  }, [setProject, initAgents]);

  const handleDiscoveryComplete = async (specCard: SpecCard, selectedAgents: AgentDefinition[], workingDir: string) => {
    setShowDiscovery(false);

    const agentDefs = selectedAgents.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      icon: a.icon,
      trigger: a.trigger,
    }));

    if (!window.harness) {
      // 브라우저 폴백
      const fakeId = "local-" + Date.now();
      setProject(fakeId, specCard.projectType);
      initAgents(agentDefs);
      setActiveProjectId(fakeId);
      setTopPage("project");

      setProjects([...projects, {
        id: fakeId,
        name: specCard.projectType,
        presetId: "game",
        specCard,
        status: "planning",
        workingDir: workingDir || ".",
        selectedAgents,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]);
      return;
    }

    const project = await window.harness.discovery.complete(
      specCard.projectType,
      "game",
      specCard,
      workingDir,
      selectedAgents,
    ) as Project;

    setProject(project.id, project.name);
    initAgents(agentDefs);
    setActiveProjectId(project.id);
    setTopPage("project");
    window.harness.session.start(project.id);

    const updatedProjects = await window.harness.project.list() as Project[];
    setProjects(updatedProjects);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (window.harness) {
      await window.harness.project.delete(projectId);
      const updatedProjects = await window.harness.project.list() as Project[];
      setProjects(updatedProjects);
    } else {
      setProjects(projects.filter((p) => p.id !== projectId));
    }
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
      setTopPage("dashboard");
      reset();
    }
  };

  const handleCheckpointRespond = (action: "approve" | "cancel") => {
    if (pendingCheckpoint) {
      window.harness?.checkpoint.respond(action);
      setCheckpoint(null);
    }
  };

  // Discovery 전체화면
  if (showDiscovery) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden">
        <Titlebar />
        <div className="flex-1 overflow-hidden">
          <DiscoveryPage
            onComplete={handleDiscoveryComplete}
            onCancel={() => setShowDiscovery(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <Titlebar
        onNewProject={() => setShowDiscovery(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          topPage={topPage}
          onNavigate={setTopPage}
          activeProjectName={activeProjectId ? projects.find((p) => p.id === activeProjectId)?.name : undefined}
        />

        <main className="flex-1 overflow-hidden">
          {topPage === "dashboard" && (
            <DashboardPage
              onNewProject={() => setShowDiscovery(true)}
              onOpenProject={openProject}
              onDeleteProject={handleDeleteProject}
            />
          )}

          {topPage === "project" && activeProjectId && (
            <ProjectView projectId={activeProjectId} />
          )}

          {topPage === "project" && !activeProjectId && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
              <p className="text-sm text-text-secondary">대시보드에서 프로젝트를 선택하세요.</p>
              <button
                onClick={() => setTopPage("dashboard")}
                className="mt-3 text-xs text-accent hover:text-accent-hover cursor-pointer"
              >
                ← 대시보드로 이동
              </button>
            </div>
          )}

          {topPage === "schedule" && <SchedulePage />}
          {topPage === "presets" && <div className="p-4 overflow-y-auto h-full"><PresetsPage /></div>}
          {topPage === "settings" && <div className="p-4 overflow-y-auto h-full"><SettingsPage /></div>}
        </main>
      </div>

      <AnimatePresence>
        {pendingCheckpoint && (
          <CheckpointModal
            checkpoint={pendingCheckpoint as Parameters<typeof CheckpointModal>[0]["checkpoint"]}
            onRespond={handleCheckpointRespond}
          />
        )}
      </AnimatePresence>

      {/* Decision Modal (에이전트가 사용자에게 묻는 질문) */}
      <AnimatePresence>
        {pendingDecision && (
          <DecisionModal
            decision={pendingDecision}
            onRespond={(answer) => {
              window.harness?.decision.respond(answer);
              setPendingDecision(null);
            }}
          />
        )}
      </AnimatePresence>

      <ToastContainer />
    </div>
  );
}
