import { useEffect } from "react";

interface UseKeyboardShortcutsOptions {
  onNavigate: (key: string) => void;
  onNewProject: () => void;
  onClosePanel: () => void;
}

export function useKeyboardShortcuts({ onNavigate, onNewProject, onClosePanel }: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const isEditing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;

      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        onNewProject();
        return;
      }

      if (e.ctrlKey && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        onNavigate(e.key);
        return;
      }

      if (e.key === "Escape" && !isEditing) {
        onClosePanel();
        return;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNavigate, onNewProject, onClosePanel]);
}
