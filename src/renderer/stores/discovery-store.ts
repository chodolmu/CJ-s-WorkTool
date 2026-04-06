import { create } from "zustand";
import type { SpecCard } from "@shared/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DiscoveryState {
  // 단계: chat → spec_review → confirmed
  phase: "chat" | "spec_review" | "confirmed";

  // 대화
  chatMessages: ChatMessage[];
  isThinking: boolean;

  // SpecCard
  specCard: SpecCard | null;

  // 작업 폴더
  workingDir: string;

  // 액션
  setPhase: (phase: DiscoveryState["phase"]) => void;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string) => void;
  setThinking: (v: boolean) => void;
  setSpecFromChat: (spec: SpecCard) => void;
  updateSpecCard: (specCard: SpecCard) => void;
  setWorkingDir: (dir: string) => void;
  confirm: () => void;
  reset: () => void;
}

export const useDiscoveryStore = create<DiscoveryState>((set) => ({
  phase: "chat",
  chatMessages: [],
  isThinking: false,
  specCard: null,
  workingDir: "",

  setPhase: (phase) => set({ phase }),

  addUserMessage: (content) =>
    set((s) => ({
      chatMessages: [...s.chatMessages, { role: "user", content }],
    })),

  addAssistantMessage: (content) =>
    set((s) => ({
      chatMessages: [...s.chatMessages, { role: "assistant", content }],
    })),

  setThinking: (v) => set({ isThinking: v }),

  setSpecFromChat: (spec) =>
    set({ specCard: spec, phase: "spec_review" }),

  updateSpecCard: (specCard) => set({ specCard }),

  setWorkingDir: (dir) => set({ workingDir: dir }),

  confirm: () => set({ phase: "confirmed" }),

  reset: () =>
    set({
      phase: "chat",
      chatMessages: [],
      isThinking: false,
      specCard: null,
      workingDir: "",
    }),
}));
