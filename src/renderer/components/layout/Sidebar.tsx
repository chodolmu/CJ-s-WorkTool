import React from "react";
import type { TopPage } from "../../App";

interface SidebarProps {
  topPage: TopPage;
  onNavigate: (page: TopPage) => void;
  activeProjectName?: string;
}

const navItems: { id: TopPage; label: string; icon: string }[] = [
  { id: "dashboard", label: "대시보드", icon: "📊" },
  { id: "project", label: "프로젝트", icon: "📁" },
  { id: "presets", label: "프리셋", icon: "⚙" },
];

export function Sidebar({ topPage, onNavigate, activeProjectName }: SidebarProps) {
  return (
    <nav className="flex flex-col w-[64px] bg-bg-base border-r border-border-subtle shrink-0 justify-between">
      <div className="flex flex-col items-center gap-0.5 py-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`
              flex flex-col items-center justify-center w-13 h-12 rounded-lg
              transition-all cursor-pointer gap-0.5
              ${
                topPage === item.id
                  ? "bg-accent/15 text-accent border border-accent/20"
                  : "text-text-muted hover:bg-bg-hover hover:text-text-secondary border border-transparent"
              }
            `}
            title={item.id === "project" && activeProjectName ? `프로젝트: ${activeProjectName}` : item.label}
          >
            <span className="text-[15px] leading-none">{item.icon}</span>
            <span className="text-[9px] leading-none font-medium">
              {item.id === "project" && activeProjectName
                ? activeProjectName.slice(0, 6) + (activeProjectName.length > 6 ? ".." : "")
                : item.label}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center pb-2">
        <button
          onClick={() => onNavigate("settings")}
          className={`
            flex flex-col items-center justify-center w-13 h-12 rounded-lg
            transition-all cursor-pointer gap-0.5
            ${
              topPage === "settings"
                ? "bg-accent/15 text-accent border border-accent/20"
                : "text-text-muted hover:bg-bg-hover hover:text-text-secondary border border-transparent"
            }
          `}
          title="설정"
        >
          <span className="text-[15px] leading-none">⚙️</span>
          <span className="text-[9px] leading-none font-medium">설정</span>
        </button>
      </div>
    </nav>
  );
}
