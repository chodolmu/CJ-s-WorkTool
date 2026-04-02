import React, { useEffect } from "react";
import { useDiscoveryStore } from "../../stores/discovery-store";
import { DiscoveryChat } from "../../components/discovery/DiscoveryChat";
import { SpecCardReview } from "../../components/discovery/SpecCardReview";
import { AgentTeamSetup } from "../../components/discovery/AgentTeamSetup";
import type { Preset, SpecCard, AgentDefinition } from "@shared/types";

import { MOCK_PRESETS } from "./mock-presets";

interface DiscoveryPageProps {
  onComplete: (specCard: SpecCard, selectedAgents: AgentDefinition[], workingDir: string, harnessId?: string) => void;
  onCancel: () => void;
}

export function DiscoveryPage({ onComplete, onCancel }: DiscoveryPageProps) {
  const store = useDiscoveryStore();

  useEffect(() => {
    if (!window.harness?.preset) {
      store.setPresets(MOCK_PRESETS);
      return;
    }
    window.harness.preset.list()
      .then((presets: Preset[]) => store.setPresets(presets?.length > 0 ? presets : MOCK_PRESETS))
      .catch(() => store.setPresets(MOCK_PRESETS));
  }, []);

  const handleToggleExpansion = (id: string) => {
    if (!store.specCard) return;
    store.updateSpecCard({
      ...store.specCard,
      expansions: store.specCard.expansions.map((e) =>
        e.id === id ? { ...e, enabled: !e.enabled } : e,
      ),
    });
  };

  const handleTeamConfirm = () => {
    store.confirm();
    if (store.specCard) {
      const specCard = { ...store.specCard };
      const selectedAgents = store.getSelectedAgents();
      const workingDir = store.workingDir;
      store.reset();
      onComplete(specCard, selectedAgents, workingDir);
    }
  };

  // 진행률 표시
  const phaseIndex = ["chat", "review", "team_setup"].indexOf(store.phase);
  const totalPhases = 3;

  return (
    <div className="h-full relative flex flex-col">
      {/* Cancel + Progress */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
        {/* Phase indicator */}
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i <= phaseIndex ? "bg-accent" : "bg-bg-active"
              }`}
            />
          ))}
        </div>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-all cursor-pointer"
        >
          ✕ Cancel
        </button>
      </div>

      {/* Phase: Chat — 대화로 프로젝트 정의 */}
      {store.phase === "chat" && (
        <DiscoveryChat onSpecReady={() => {}} />
      )}

      {/* Phase: Review — 스펙 카드 확인/수정 */}
      {store.phase === "review" && store.specCard && (
        <SpecCardReview
          specCard={store.specCard}
          onToggleExpansion={handleToggleExpansion}
          onConfirm={() => store.confirmSpec()}
          onBack={() => store.goBack()}
        />
      )}

      {/* Phase: Team Setup — 에이전트 팀 구성 */}
      {store.phase === "team_setup" && (
        <AgentTeamSetup
          onConfirm={handleTeamConfirm}
          onBack={() => store.goBack()}
        />
      )}
    </div>
  );
}
