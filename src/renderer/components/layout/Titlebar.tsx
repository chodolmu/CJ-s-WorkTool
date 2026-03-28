import React from "react";
import { useThemeStore } from "../../stores/theme-store";

interface TitlebarProps {
  onNewProject?: () => void;
}

export function Titlebar({ onNewProject }: TitlebarProps) {
  const { theme, toggle } = useThemeStore();

  return (
    <div className="titlebar-drag flex items-center justify-between h-10 px-4 bg-bg-base border-b border-border-subtle shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-accent font-bold text-sm">WorkTool</span>
        <span className="text-text-muted text-xs">v0.1.0</span>
      </div>

      <div className="titlebar-no-drag flex items-center gap-2">
        <button
          onClick={toggle}
          className="text-text-secondary hover:text-text-primary text-xs cursor-pointer px-1.5 py-0.5 rounded hover:bg-bg-hover transition-colors"
          title={`${theme === "dark" ? "라이트" : "다크"} 모드로 전환`}
        >
          {theme === "dark" ? "☀" : "🌙"}
        </button>
      </div>
    </div>
  );
}
