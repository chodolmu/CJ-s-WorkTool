import React, { useEffect, useState } from "react";
import type { HarnessEntry } from "@shared/types";
import { toast } from "./Toast";

interface Props {
  projectDir?: string;
  mode?: "apply" | "select";
  selectedId?: string | null;
  onSelect?: (harnessId: string, entry: HarnessEntry) => void;
  onApplied?: (harnessId: string) => void;
}

export function HarnessBrowser({ projectDir, mode = "apply", selectedId, onSelect, onApplied }: Props) {
  const [catalog, setCatalog] = useState<Record<string, HarnessEntry[]>>({});
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<HarnessEntry[] | null>(null);
  const [lang, setLang] = useState<"ko" | "en">("ko");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!window.harness?.harness100) return;
    window.harness.harness100.getByCategory().then((data: Record<string, HarnessEntry[]>) => {
      setCatalog(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!search.trim() || !window.harness?.harness100) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      window.harness.harness100.search(search).then(setSearchResults).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleApply = async (harnessId: string) => {
    if (!projectDir) {
      toast("warning", "프로젝트 없음", "먼저 프로젝트를 선택하세요.");
      return;
    }
    setApplying(harnessId);
    try {
      const result = await window.harness.harness100.apply(harnessId, projectDir, lang);
      if (result.success) {
        toast("success", "하네스 적용", `${harnessId} 적용 완료`);
        onApplied?.(harnessId);
      } else {
        toast("error", "적용 실패", result.error || "알 수 없는 에러");
      }
    } catch (err) {
      toast("error", "적용 실패", String(err));
    } finally {
      setApplying(null);
    }
  };

  const handleAction = (harness: HarnessEntry) => {
    if (mode === "select") {
      onSelect?.(harness.id, harness);
    } else {
      handleApply(harness.id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-text-secondary">
        카탈로그 로딩 중...
      </div>
    );
  }

  return (
    <div>
      {/* 검색바 + 언어 토글 */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="하네스 검색... (예: game, API, 교육)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 bg-bg-card border border-border-subtle rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />
        <button
          onClick={() => setLang((l) => (l === "ko" ? "en" : "ko"))}
          className="px-4 py-2 rounded-md cursor-pointer bg-bg-card border border-border-subtle text-text-secondary text-xs hover:border-border-strong transition-colors whitespace-nowrap"
        >
          {lang === "ko" ? "한국어" : "English"}
        </button>
      </div>

      {/* 검색 결과 수 */}
      {searchResults && (
        <div className="mb-3 text-xs text-text-muted">{searchResults.length}개 결과</div>
      )}

      {/* 검색 결과 리스트 */}
      {searchResults && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {searchResults.map((h) => (
            <HarnessCard
              key={h.id} harness={h} lang={lang}
              mode={mode} isSelected={selectedId === h.id}
              onAction={() => handleAction(h)}
              isBusy={applying === h.id}
            />
          ))}
        </div>
      )}

      {/* 카테고리별 */}
      {!searchResults && Object.entries(catalog).map(([category, harnesses]) => (
        <div key={category} className="mb-4">
          <button
            onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
            className={`flex items-center gap-2 w-full px-3 py-2.5 cursor-pointer rounded-lg text-sm font-semibold border transition-all ${
              expandedCategory === category
                ? "bg-accent text-white border-accent"
                : "bg-bg-card border-border-subtle text-text-primary hover:border-border-strong"
            }`}
          >
            <span className={`transition-transform text-xs ${expandedCategory === category ? "rotate-90" : ""}`}>▶</span>
            {category}
            <span className="ml-auto text-xs opacity-60">{harnesses.length}개</span>
          </button>

          {expandedCategory === category && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 mt-2 pl-1">
              {harnesses.map((h) => (
                <HarnessCard
                  key={h.id} harness={h} lang={lang}
                  mode={mode} isSelected={selectedId === h.id}
                  onAction={() => handleAction(h)}
                  isBusy={applying === h.id}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function HarnessCard({ harness, lang, mode, isSelected, onAction, isBusy }: {
  harness: HarnessEntry;
  lang: "ko" | "en";
  mode: "apply" | "select";
  isSelected: boolean;
  onAction: () => void;
  isBusy: boolean;
}) {
  return (
    <div className={`p-3.5 rounded-lg border flex flex-col gap-2 transition-all ${
      isSelected
        ? "bg-accent/8 border-accent shadow-sm"
        : "bg-bg-card border-border-subtle hover:border-border-strong"
    }`}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-muted font-mono">#{harness.number}</span>
        <span className="font-semibold text-sm text-text-primary">{harness.name[lang]}</span>
      </div>

      <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
        {harness.description[lang]?.slice(0, 120) || ""}
      </p>

      <div className="flex flex-wrap gap-1">
        {harness.agents.slice(0, 4).map((a) => (
          <span key={a.id} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-active text-text-secondary">
            {a.name}
          </span>
        ))}
        {harness.agents.length > 4 && (
          <span className="text-[10px] text-text-muted">+{harness.agents.length - 4}</span>
        )}
      </div>

      <div className="flex items-center justify-between mt-auto">
        <span className="text-[10px] text-text-muted">
          {harness.agentCount} agents / {harness.skillCount} skills
        </span>
        <button
          onClick={onAction}
          disabled={isBusy}
          className={`px-3 py-1 rounded text-xs cursor-pointer transition-all ${
            mode === "select"
              ? isSelected
                ? "bg-accent text-white"
                : "bg-bg-active text-text-primary hover:bg-accent/20"
              : isBusy
                ? "bg-bg-active text-text-muted cursor-wait"
                : "bg-accent text-white hover:bg-accent-hover"
          }`}
        >
          {mode === "select"
            ? (isSelected ? "✓ 선택됨" : "선택")
            : (isBusy ? "적용 중..." : "적용")
          }
        </button>
      </div>
    </div>
  );
}
