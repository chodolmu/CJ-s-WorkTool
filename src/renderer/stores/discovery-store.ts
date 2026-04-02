import { create } from "zustand";
import type {
  SpecCard,
  CoreDecision,
  Expansion,
  Preset,
  AgentDefinition,
  PoolAgent,
} from "@shared/types";

/** UI용 에이전트 카탈로그 항목 (PoolAgent + 카테고리/이유) */
export interface CatalogAgent extends AgentDefinition {
  category: "core" | "recommended" | "optional";
  reason: string;
  matchTags: string[];
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface DiscoveryState {
  // 상태
  phase: "chat" | "review" | "team_setup" | "confirmed";
  presets: Preset[];

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
  phase: "chat",
  presets: [],
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
    // chat이 첫 단계이므로 더 이상 뒤로 갈 수 없음
  },

  updateSpecCard: (specCard) => set({ specCard }),

  confirmSpec: async () => {
    const { specCard } = get();
    if (!specCard) return;

    // agent-pool IPC로 추천 받기
    if (window.harness?.agentPool) {
      try {
        const result = await window.harness.agentPool.recommend(specCard) as {
          core: PoolAgent[];
          recommended: PoolAgent[];
          optional: PoolAgent[];
        };

        const toAgent = (a: PoolAgent, cat: "core" | "recommended" | "optional", reason: string): CatalogAgent => ({
          id: a.id,
          displayName: a.displayName,
          icon: a.icon,
          role: a.description,
          goal: a.description,
          constraints: [],
          model: a.model as "opus" | "sonnet" | "haiku",
          trigger: a.trigger as CatalogAgent["trigger"],
          guidelines: [],
          outputFormat: "",
          category: cat,
          reason,
          matchTags: a.tags,
        });

        const allAgents: CatalogAgent[] = [
          ...result.core.map(a => toAgent(a, "core", "필수 에이전트")),
          ...result.recommended.map(a => toAgent(a, "recommended", a.matchReason ?? a.description)),
          ...result.optional.map(a => toAgent(a, "optional", a.description)),
        ];

        const selectedIds = new Set([
          ...result.core.map(a => a.id),
          ...result.recommended.map(a => a.id),
        ]);

        set({ phase: "team_setup", catalogAgents: allAgents, selectedAgentIds: selectedIds });
        return;
      } catch (err) {
        console.error("[Discovery] agent-pool recommend failed:", err);
      }
    }

    // 폴백: 빈 상태로 team_setup 진행
    set({ phase: "team_setup", catalogAgents: [], selectedAgentIds: new Set() });
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
      phase: "chat",
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
