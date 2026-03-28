import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import { create } from "zustand";

// ── Types ──
export type ToastType = "info" | "success" | "warning" | "error";

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 = persistent
}

// ── Store ──
let toastId = 0;

interface ToastStore {
  toasts: ToastItem[];
  add: (toast: Omit<ToastItem, "id">) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (toast) =>
    set((state) => ({
      toasts: [...state.toasts.slice(-4), { ...toast, id: `toast-${++toastId}` }], // max 5
    })),
  remove: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

// ── Convenience function (call anywhere) ──
export function toast(type: ToastType, title: string, message?: string, duration?: number) {
  useToastStore.getState().add({ type, title, message, duration });
}

// ── Toast Container (mount once in App) ──
export function ToastContainer() {
  const { toasts, remove } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => remove(t.id)} />
      ))}
    </div>
  );
}

// ── Single Toast Card ──
const typeConfig: Record<ToastType, { icon: string; accent: string; bg: string }> = {
  info:    { icon: "ℹ",  accent: "border-l-status-info",    bg: "bg-status-info/5" },
  success: { icon: "✓",  accent: "border-l-status-success", bg: "bg-status-success/5" },
  warning: { icon: "⚠",  accent: "border-l-status-warning", bg: "bg-status-warning/5" },
  error:   { icon: "✕",  accent: "border-l-status-error",   bg: "bg-status-error/5" },
};

function ToastCard({ toast: t, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);
  const config = typeConfig[t.type];

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(onDismiss, 200);
  }, [onDismiss]);

  // Auto-dismiss
  useEffect(() => {
    const duration = t.duration ?? 4000;
    if (duration === 0) return;
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, [t.duration, dismiss]);

  return (
    <div
      className={`
        pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5
        bg-bg-card border border-border-subtle border-l-[3px] ${config.accent}
        rounded-lg card-shadow
        ${exiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0 animate-slide-in-up"}
        transition-all duration-200
      `}
    >
      <span className="text-sm shrink-0 mt-0.5">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary">{t.title}</div>
        {t.message && (
          <div className="text-xs text-text-secondary mt-0.5 line-clamp-2">{t.message}</div>
        )}
      </div>
      <button
        onClick={dismiss}
        className="text-text-muted hover:text-text-primary text-xs shrink-0 cursor-pointer mt-0.5"
      >
        ✕
      </button>
    </div>
  );
}
