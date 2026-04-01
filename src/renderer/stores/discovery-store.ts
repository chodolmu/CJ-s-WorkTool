import { create } from "zustand";
import type {
  SpecCard,
  CoreDecision,
  Expansion,
  Preset,
  AgentDefinition,
  HarnessEntry,
} from "@shared/types";
import { getRecommendedAgents, type CatalogAgent } from "../data/agent-catalog";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface DiscoveryState {
  // 상태
  phase: "harness_select" | "chat" | "review" | "team_setup" | "confirmed";
  presets: Preset[];

  // 하네스 선택
  selectedHarnessId: string | null;
  selectedHarnessEntry: HarnessEntry | null;

  // 대화 기반 Discovery
  chatMessages: ChatMessage[];
  isThinking: boolean;
  specCard: SpecCard | null;
  detectedPresetId: string | null;
  workingDir: string;

  // 에이전트 팀 구성
  catalogAgents: CatalogAgent[];
  selectedAgentIds: Set<string>;

  // 액션
  setPresets: (presets: Preset[]) => void;
  setWorkingDir: (dir: string) => void;
  setSelectedHarness: (id: string, entry: HarnessEntry) => void;
  setPhase: (phase: DiscoveryState["phase"]) => void;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string) => void;
  setThinking: (v: boolean) => void;
  setSpecFromChat: (spec: SpecCard, presetId: string) => void;
  goToReview: () => void;
  goBack: () => void;
  updateSpecCard: (specCard: SpecCard) => void;
  confirmSpec: () => void;
  toggleAgent: (agentId: string) => void;
  confirm: () => void;
  getSelectedAgents: () => AgentDefinition[];
  reset: () => void;
}

export const useDiscoveryStore = create<DiscoveryState>((set, get) => ({
  phase: "harness_select",
  presets: [],
  selectedHarnessId: null,
  selectedHarnessEntry: null,
  chatMessages: [{
    role: "assistant",
    content: "안녕하세요! 어떤 프로젝트를 만들고 싶으세요? 자유롭게 설명해주세요.\n\n예시:\n- \"2D 횡스크롤 RPG 게임을 만들고 싶어\"\n- \"우리 팀 내부 업무 관리 대시보드\"\n- \"레시피 공유 SNS 앱\"",
  }],
  isThinking: false,
  specCard: null,
  detectedPresetId: null,
  workingDir: "",
  catalogAgents: [],
  selectedAgentIds: new Set<string>(),

  setPresets: (presets) => set({ presets }),

  setWorkingDir: (dir) => set({ workingDir: dir }),

  setSelectedHarness: (id, entry) => set({ selectedHarnessId: id, selectedHarnessEntry: entry }),

  setPhase: (phase) => set({ phase }),

  addUserMessage: (content) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, { role: "user", content }],
    })),

  addAssistantMessage: (content) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, { role: "assistant", content }],
    })),

  setThinking: (v) => set({ isThinking: v }),

  setSpecFromChat: (spec, presetId) =>
    set({ specCard: spec, detectedPresetId: presetId, phase: "review" }),

  goToReview: () => {
    const { specCard } = get();
    if (specCard) set({ phase: "review" });
  },

  goBack: () => {
    const { phase } = get();
    if (phase === "team_setup") set({ phase: "review" });
    else if (phase === "review") set({ phase: "chat" });
    else if (phase === "chat") set({ phase: "harness_select" });
  },

  updateSpecCard: (specCard) => set({ specCard }),

  confirmSpec: () => {
    const { detectedPresetId, specCard } = get();
    if (!specCard) return;

    const presetId = detectedPresetId ?? "game";
    const catalog = getRecommendedAgents(presetId, specCard);
    const selectedIds = new Set(
      catalog
        .filter((a) => a.category === "core" || a.category === "recommended")
        .map((a) => a.id),
    );

    set({ phase: "team_setup", catalogAgents: catalog, selectedAgentIds: selectedIds });
  },

  toggleAgent: (agentId) => {
    const { catalogAgents, selectedAgentIds } = get();
    const agent = catalogAgents.find((a) => a.id === agentId);
    if (!agent || agent.category === "core") return;

    const next = new Set(selectedAgentIds);
    if (next.has(agentId)) next.delete(agentId);
    else next.add(agentId);
    set({ selectedAgentIds: next });
  },

  confirm: () => set({ phase: "confirmed" }),

  getSelectedAgents: () => {
    const { catalogAgents, selectedAgentIds } = get();
    return catalogAgents
      .filter((a) => selectedAgentIds.has(a.id))
      .map(({ category, reason, matchTags, ...agent }) => agent);
  },

  reset: () =>
    set({
      phase: "harness_select",
      selectedHarnessId: null,
      selectedHarnessEntry: null,
      chatMessages: [{
        role: "assistant",
        content: "안녕하세요! 어떤 프로젝트를 만들고 싶으세요? 자유롭게 설명해주세요.\n\n예시:\n- \"2D 횡스크롤 RPG 게임을 만들고 싶어\"\n- \"우리 팀 내부 업무 관리 대시보드\"\n- \"레시피 공유 SNS 앱\"",
      }],
      isThinking: false,
      specCard: null,
      detectedPresetId: null,
      workingDir: "",
      catalogAgents: [],
      selectedAgentIds: new Set<string>(),
    }),
}));
