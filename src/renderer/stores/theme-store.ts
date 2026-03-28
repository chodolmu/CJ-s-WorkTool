import { create } from "zustand";

type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem("worktool-theme") as Theme) ?? "dark",

  toggle: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("worktool-theme", next);
      applyTheme(next);
      return { theme: next };
    }),

  set: (theme) => {
    localStorage.setItem("worktool-theme", theme);
    applyTheme(theme);
    set({ theme });
  },
}));

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
}

// 초기 적용
const initial = (localStorage.getItem("worktool-theme") ?? "dark") as Theme;
applyTheme(initial);
