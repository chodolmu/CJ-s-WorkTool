import type { Config } from "tailwindcss";

export default {
  content: ["./src/renderer/**/*.{ts,tsx,html}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          base: "var(--wt-bg-base)",
          card: "var(--wt-bg-card)",
          hover: "var(--wt-bg-hover)",
          active: "var(--wt-bg-active)",
        },
        border: {
          subtle: "var(--wt-border-subtle)",
          strong: "var(--wt-border-strong)",
        },
        text: {
          primary: "var(--wt-text-primary)",
          secondary: "var(--wt-text-secondary)",
          muted: "var(--wt-text-muted)",
        },
        status: {
          success: "#22c55e",
          warning: "#eab308",
          error: "#ef4444",
          info: "#3b82f6",
          neutral: "#6b7280",
        },
        accent: {
          DEFAULT: "var(--wt-accent)",
          hover: "var(--wt-accent-hover)",
        },
      },
      fontFamily: {
        sans: ['"Inter"', "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Cascadia Code"', "monospace"],
      },
      borderRadius: {
        card: "8px",
        button: "6px",
        badge: "4px",
      },
    },
  },
  plugins: [],
} satisfies Config;
