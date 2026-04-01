import React, { useEffect, useState } from "react";
import type { HarnessEntry } from "@shared/types";
import { toast } from "./Toast";

interface Props {
  projectDir?: string;
  onApplied?: (harnessId: string) => void;
}

export function HarnessBrowser({ projectDir, onApplied }: Props) {
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

  const displayItems = searchResults || [];
  const categories = searchResults ? {} : catalog;

  if (loading) {
    return <div className="harness-browser loading">카탈로그 로딩 중...</div>;
  }

  return (
    <div className="harness-browser">
      {/* 검색바 + 언어 토글 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="하네스 검색... (예: game, API, 교육)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: "8px 12px",
            background: "var(--bg-secondary, #2b2d31)",
            border: "1px solid var(--border, #3f4147)",
            borderRadius: 6, color: "inherit", fontSize: 14,
          }}
        />
        <button
          onClick={() => setLang((l) => (l === "ko" ? "en" : "ko"))}
          style={{
            padding: "8px 16px", borderRadius: 6, cursor: "pointer",
            background: "var(--bg-secondary, #2b2d31)",
            border: "1px solid var(--border, #3f4147)",
            color: "inherit", fontSize: 13, whiteSpace: "nowrap",
          }}
        >
          {lang === "ko" ? "한국어" : "English"}
        </button>
      </div>

      {/* 검색 결과 */}
      {searchResults && (
        <div style={{ marginBottom: 12, fontSize: 13, opacity: 0.7 }}>
          {searchResults.length}개 결과
        </div>
      )}

      {/* 검색 결과 리스트 */}
      {searchResults && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {searchResults.map((h) => (
            <HarnessCard
              key={h.id} harness={h} lang={lang}
              onApply={handleApply} applying={applying === h.id}
            />
          ))}
        </div>
      )}

      {/* 카테고리별 */}
      {!searchResults && Object.entries(categories).map(([category, harnesses]) => (
        <div key={category} style={{ marginBottom: 16 }}>
          <button
            onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              padding: "10px 12px", cursor: "pointer",
              background: expandedCategory === category ? "var(--accent, #5865f2)" : "var(--bg-secondary, #2b2d31)",
              border: "1px solid var(--border, #3f4147)", borderRadius: 8,
              color: "inherit", fontSize: 14, fontWeight: 600,
            }}
          >
            <span style={{ transform: expandedCategory === category ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
              ▶
            </span>
            {category}
            <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.6 }}>
              {harnesses.length}개
            </span>
          </button>

          {expandedCategory === category && (
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 12, marginTop: 8, paddingLeft: 4,
            }}>
              {harnesses.map((h) => (
                <HarnessCard
                  key={h.id} harness={h} lang={lang}
                  onApply={handleApply} applying={applying === h.id}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function HarnessCard({ harness, lang, onApply, applying }: {
  harness: HarnessEntry;
  lang: "ko" | "en";
  onApply: (id: string) => void;
  applying: boolean;
}) {
  return (
    <div style={{
      padding: 14, borderRadius: 8,
      background: "var(--bg-secondary, #2b2d31)",
      border: "1px solid var(--border, #3f4147)",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, opacity: 0.5, fontFamily: "monospace" }}>#{harness.number}</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{harness.name[lang]}</span>
      </div>

      <p style={{ fontSize: 12, opacity: 0.7, margin: 0, lineHeight: 1.5 }}>
        {harness.description[lang]?.slice(0, 120) || ""}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {harness.agents.slice(0, 4).map((a) => (
          <span key={a.id} style={{
            fontSize: 11, padding: "2px 6px", borderRadius: 4,
            background: "var(--bg-tertiary, #1e1f22)", opacity: 0.8,
          }}>
            {a.name}
          </span>
        ))}
        {harness.agents.length > 4 && (
          <span style={{ fontSize: 11, opacity: 0.5 }}>+{harness.agents.length - 4}</span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
        <span style={{ fontSize: 11, opacity: 0.5 }}>
          {harness.agentCount} agents / {harness.skillCount} skills
        </span>
        <button
          onClick={() => onApply(harness.id)}
          disabled={applying}
          style={{
            padding: "4px 12px", borderRadius: 4, cursor: applying ? "wait" : "pointer",
            background: applying ? "#3f4147" : "var(--accent, #5865f2)",
            border: "none", color: "#fff", fontSize: 12,
          }}
        >
          {applying ? "적용 중..." : "적용"}
        </button>
      </div>
    </div>
  );
}
