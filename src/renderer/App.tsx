import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Titlebar } from "./components/layout/Titlebar";
import { DashboardPage } from "./pages/DashboardPage";
import { ProjectPage } from "./pages/ProjectPage";
import { PlanReviewPage } from "./pages/PlanReviewPage";
import { DiscoveryPage } from "./pages/Discovery/DiscoveryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ToastContainer } from "./components/Toast";
import { useAppStore } from "./stores/app-store";
import { useIpcEvents } from "./hooks/useIpcEvents";
import type { SpecCard, Project } from "@shared/types";

export type TopPage = "dashboard" | "project" | "settings";

export default function App() {
  const [topPage, setTopPage] = useState<TopPage>("dashboard");
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [showPlanReview, setShowPlanReview] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const {
    setClaudeInstalled,
    setProjects,
    setCurrentProject,
    projects,
  } = useAppStore();

  useIpcEvents();

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

    return () => cleanups.forEach((c) => c());
  }, []);

  const openProject = useCallback((projectId: string) => {
    setActiveProjectId(projectId);
    setCurrentProject(projectId);
    setTopPage("project");
  }, [setCurrentProject]);

  const handleDiscoveryComplete = async (specCard: SpecCard, workingDir: string) => {
    setShowDiscovery(false);

    if (!window.harness) {
      const fakeId = "local-" + Date.now();
      setActiveProjectId(fakeId);
      setCurrentProject(fakeId);
      setTopPage("project");
      return;
    }

    const project = await window.harness.discovery.complete(
      specCard.projectName || specCard.projectType || "New Project",
      specCard,
      workingDir,
    ) as Project;

    setActiveProjectId(project.id);
    setCurrentProject(project.id);

    // 계획 생성 → PlanReview로
    setShowPlanReview(true);

    const updatedProjects = await window.harness.project.list() as Project[];
    setProjects(updatedProjects);
  };

  const handlePlanApproved = () => {
    setShowPlanReview(false);
    setTopPage("project");
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
      setCurrentProject(null);
      setTopPage("dashboard");
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
        <ToastContainer />
      </div>
    );
  }

  // PlanReview 전체화면
  if (showPlanReview && activeProjectId) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden">
        <Titlebar />
        <div className="flex-1 overflow-hidden">
          <PlanReviewPage
            projectId={activeProjectId}
            onApprove={handlePlanApproved}
            onBack={() => setShowPlanReview(false)}
          />
        </div>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <Titlebar onNewProject={() => setShowDiscovery(true)} />

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
            <ProjectPage projectId={activeProjectId} />
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

          {topPage === "settings" && <div className="p-4 overflow-y-auto h-full"><SettingsPage /></div>}
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
