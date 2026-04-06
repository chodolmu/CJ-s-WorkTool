import React, { useEffect } from "react";
import { useDiscoveryStore } from "../../stores/discovery-store";
import { DiscoveryChat } from "../../components/discovery/DiscoveryChat";
import { SpecCardReview } from "../../components/discovery/SpecCardReview";
import type { SpecCard } from "@shared/types";

interface DiscoveryPageProps {
  onComplete: (specCard: SpecCard, workingDir: string) => void;
  onCancel: () => void;
}

export function DiscoveryPage({ onComplete, onCancel }: DiscoveryPageProps) {
  const store = useDiscoveryStore();

  useEffect(() => {
    store.reset();
  }, []);

  const handleSpecReady = () => {
    store.setPhase("spec_review");
  };

  const handleConfirm = () => {
    if (!store.specCard || !store.workingDir) return;
    store.confirm();
    onComplete(store.specCard, store.workingDir);
  };

  const handleSelectFolder = async () => {
    if (!window.harness?.dialog) return;
    const folder = await window.harness.dialog.selectFolder();
    if (folder) {
      store.setWorkingDir(folder as string);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-base">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">새 프로젝트</h1>
          <p className="text-xs text-text-muted mt-0.5">
            {store.phase === "chat" && "프로젝트에 대해 설명해주세요"}
            {store.phase === "spec_review" && "스펙을 확인하고 작업 폴더를 선택하세요"}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-sm text-text-muted hover:text-text-secondary cursor-pointer"
        >
          취소
        </button>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-hidden">
        {store.phase === "chat" && (
          <DiscoveryChat onSpecReady={handleSpecReady} />
        )}

        {store.phase === "spec_review" && store.specCard && (
          <div className="flex flex-col h-full overflow-y-auto p-6 gap-4">
            <SpecCardReview
              specCard={store.specCard}
              onUpdate={(sc: SpecCard) => store.updateSpecCard(sc)}
            />

            {/* 작업 폴더 선택 */}
            <div className="bg-bg-surface rounded-lg p-4 border border-border-subtle">
              <h3 className="text-sm font-medium text-text-primary mb-2">작업 폴더</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectFolder}
                  className="px-3 py-1.5 text-xs bg-accent/10 text-accent rounded hover:bg-accent/20 cursor-pointer"
                >
                  폴더 선택
                </button>
                <span className="text-xs text-text-muted font-mono">
                  {store.workingDir || "선택 안 됨"}
                </span>
              </div>
            </div>

            {/* 확인 버튼 */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => store.setPhase("chat")}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary cursor-pointer"
              >
                ← 대화로 돌아가기
              </button>
              <button
                onClick={handleConfirm}
                disabled={!store.workingDir}
                className={`px-6 py-2 text-sm rounded-lg font-medium cursor-pointer ${
                  store.workingDir
                    ? "bg-accent text-white hover:bg-accent-hover"
                    : "bg-bg-hover text-text-muted cursor-not-allowed"
                }`}
              >
                계획 생성 시작
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
