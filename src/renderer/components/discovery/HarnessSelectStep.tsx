import React, { useState } from "react";
import { HarnessBrowser } from "../HarnessBrowser";
import type { HarnessEntry } from "@shared/types";

interface Props {
  onSelect: (harnessId: string, entry: HarnessEntry) => void;
  onSkip: () => void;
}

export function HarnessSelectStep({ onSelect, onSkip }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<HarnessEntry | null>(null);

  const handleSelect = (id: string, entry: HarnessEntry) => {
    setSelectedId(id);
    setSelectedEntry(entry);
  };

  const handleContinue = () => {
    if (selectedId && selectedEntry) {
      onSelect(selectedId, selectedEntry);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 pt-8 pb-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <span className="text-xl">🧩</span>
            </div>
            <div>
              <h1 className="text-lg font-medium text-text-primary">하네스 선택</h1>
              <p className="text-xs text-text-secondary">프로젝트에 적합한 하네스 템플릿을 선택하세요</p>
            </div>
          </div>
        </div>
      </div>

      {/* Browser */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        <div className="max-w-3xl mx-auto">
          <HarnessBrowser
            mode="select"
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-border-subtle px-6 py-3 bg-bg-base">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
          >
            건너뛰기 (빈 프로젝트)
          </button>

          <div className="flex items-center gap-3">
            {selectedEntry && (
              <span className="text-xs text-text-secondary">
                <span className="text-accent font-medium">{selectedEntry.name.ko}</span> 선택됨
              </span>
            )}
            <button
              onClick={handleContinue}
              disabled={!selectedId}
              className="px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-all cursor-pointer active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              다음 →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
