import fs from "fs";
import path from "path";

/**
 * Harness-100 카탈로그 관리 + 프로젝트 적용
 *
 * vendor/harness-100/ 에서 200개 하네스(ko/en)를 인덱싱하고,
 * 프로젝트에 .claude/ 폴더를 복사하여 적용한다.
 */

export interface HarnessAgent {
  id: string;
  name: string;
  description: string;
}

export interface HarnessEntry {
  id: string;             // "05-game-narrative"
  number: number;         // 5
  category: string;       // "Content Creation"
  name: { en: string; ko: string };
  description: { en: string; ko: string };
  agents: HarnessAgent[];
  skills: string[];
  agentCount: number;
  skillCount: number;
}

const CATEGORIES: { range: [number, number]; name: string; nameKo: string }[] = [
  { range: [1, 15], name: "Content Creation", nameKo: "콘텐츠 제작" },
  { range: [16, 30], name: "Software Dev & DevOps", nameKo: "소프트웨어 개발" },
  { range: [31, 42], name: "Data & AI/ML", nameKo: "데이터 & AI" },
  { range: [43, 55], name: "Business & Strategy", nameKo: "비즈니스 전략" },
  { range: [56, 65], name: "Education & Learning", nameKo: "교육 & 학습" },
  { range: [66, 72], name: "Legal & Compliance", nameKo: "법률 & 규정" },
  { range: [73, 80], name: "Health & Lifestyle", nameKo: "건강 & 라이프" },
  { range: [81, 87], name: "Communication & Docs", nameKo: "문서 & 커뮤니케이션" },
  { range: [88, 95], name: "Operations & Process", nameKo: "운영 & 프로세스" },
  { range: [96, 100], name: "Specialized Domains", nameKo: "전문 도메인" },
];

export class HarnessManager {
  private catalog: HarnessEntry[] = [];
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath; // vendor/harness-100/
  }

  /**
   * 카탈로그 빌드 — 디렉토리 스캔 + frontmatter 파싱
   * 결과를 JSON으로 캐시
   */
  async buildCatalog(): Promise<HarnessEntry[]> {
    const cachePath = path.join(this.basePath, ".catalog-cache.json");

    // 캐시 확인
    if (fs.existsSync(cachePath)) {
      try {
        this.catalog = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
        return this.catalog;
      } catch {
        // 캐시 손상 — 재빌드
      }
    }

    const koDir = path.join(this.basePath, "ko");
    const enDir = path.join(this.basePath, "en");

    if (!fs.existsSync(koDir)) {
      console.warn("[HarnessManager] ko/ directory not found at", koDir);
      return [];
    }

    const dirs = fs.readdirSync(koDir)
      .filter(d => /^\d{2,3}-/.test(d) && fs.statSync(path.join(koDir, d)).isDirectory())
      .sort();

    this.catalog = dirs.map((dirName) => {
      const num = parseInt(dirName.split("-")[0], 10);
      const cat = CATEGORIES.find(c => num >= c.range[0] && num <= c.range[1]);
      const category = cat?.name || "Other";

      // 에이전트 파싱 (frontmatter)
      const agentsDir = path.join(koDir, dirName, ".claude", "agents");
      const agents: HarnessAgent[] = [];
      if (fs.existsSync(agentsDir)) {
        for (const file of fs.readdirSync(agentsDir).filter(f => f.endsWith(".md"))) {
          const content = fs.readFileSync(path.join(agentsDir, file), "utf-8");
          const fm = this.parseFrontmatter(content);
          agents.push({
            id: file.replace(".md", ""),
            name: fm.name || file.replace(".md", ""),
            description: fm.description || "",
          });
        }
      }

      // 스킬 목록
      const skillsDir = path.join(koDir, dirName, ".claude", "skills");
      const skills = fs.existsSync(skillsDir)
        ? fs.readdirSync(skillsDir).filter(d => {
            try { return fs.statSync(path.join(skillsDir, d)).isDirectory(); } catch { return false; }
          })
        : [];

      // 이름/설명 추출
      const koName = this.extractTitle(path.join(koDir, dirName, ".claude", "CLAUDE.md")) || dirName;
      const enName = this.extractTitle(path.join(enDir, dirName, ".claude", "CLAUDE.md")) || dirName;
      const koDesc = this.extractFirstParagraph(path.join(koDir, dirName, ".claude", "CLAUDE.md")) || "";
      const enDesc = this.extractFirstParagraph(path.join(enDir, dirName, ".claude", "CLAUDE.md")) || "";

      return {
        id: dirName,
        number: num,
        category,
        name: { en: enName, ko: koName },
        description: { en: enDesc, ko: koDesc },
        agents,
        skills,
        agentCount: agents.length,
        skillCount: skills.length,
      };
    });

    // 캐시 저장
    try {
      fs.writeFileSync(cachePath, JSON.stringify(this.catalog, null, 2));
    } catch {
      // 쓰기 실패 무시 (read-only 환경)
    }

    return this.catalog;
  }

  /**
   * 간단한 YAML frontmatter 파서 (gray-matter 의존성 없이)
   */
  private parseFrontmatter(content: string): Record<string, string> {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    const result: Record<string, string> = {};
    for (const line of match[1].split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      // 따옴표 제거
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
    return result;
  }

  private extractTitle(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const match = content.match(/^#\s+(.+)/m);
      return match ? match[1].trim() : null;
    } catch {
      return null;
    }
  }

  private extractFirstParagraph(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      // 첫 번째 헤딩 이후 첫 비어있지 않은 줄
      const lines = content.split("\n");
      let pastFirstHeading = false;
      for (const line of lines) {
        if (line.startsWith("#")) {
          pastFirstHeading = true;
          continue;
        }
        if (pastFirstHeading && line.trim().length > 0) {
          return line.trim().slice(0, 200);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 하네스 적용 — .claude/ 폴더를 프로젝트에 복사
   * 기존 .claude/ 는 백업
   */
  applyHarness(harnessId: string, projectDir: string, lang: "ko" | "en" = "ko"): { success: boolean; backupDir?: string; error?: string } {
    const src = path.join(this.basePath, lang, harnessId, ".claude");
    const dest = path.join(projectDir, ".claude");

    if (!fs.existsSync(src)) {
      return { success: false, error: `Harness not found: ${harnessId}` };
    }

    // 기존 .claude/ 백업
    let backupDir: string | undefined;
    if (fs.existsSync(dest)) {
      backupDir = dest + "-backup-" + Date.now();
      fs.renameSync(dest, backupDir);
    }

    try {
      fs.cpSync(src, dest, { recursive: true });
      return { success: true, backupDir };
    } catch (err) {
      // 실패 시 백업 복원
      if (backupDir && fs.existsSync(backupDir)) {
        try { fs.renameSync(backupDir, dest); } catch {}
      }
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * 카탈로그 검색
   */
  search(query: string): HarnessEntry[] {
    const q = query.toLowerCase();
    return this.catalog.filter(h =>
      h.name.ko.toLowerCase().includes(q) ||
      h.name.en.toLowerCase().includes(q) ||
      h.description.ko.toLowerCase().includes(q) ||
      h.description.en.toLowerCase().includes(q) ||
      h.category.toLowerCase().includes(q) ||
      h.agents.some(a => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q))
    );
  }

  /**
   * 카테고리별 그룹
   */
  getByCategory(): Record<string, HarnessEntry[]> {
    const groups: Record<string, HarnessEntry[]> = {};
    for (const h of this.catalog) {
      if (!groups[h.category]) groups[h.category] = [];
      groups[h.category].push(h);
    }
    return groups;
  }

  /**
   * 전체 카탈로그
   */
  getCatalog(): HarnessEntry[] {
    return this.catalog;
  }

  /**
   * 단일 하네스 상세
   */
  getHarness(id: string): HarnessEntry | undefined {
    return this.catalog.find(h => h.id === id);
  }

  /**
   * 카테고리 목록
   */
  getCategories(): { name: string; nameKo: string; count: number }[] {
    return CATEGORIES.map(c => ({
      name: c.name,
      nameKo: c.nameKo,
      count: this.catalog.filter(h => h.category === c.name).length,
    })).filter(c => c.count > 0);
  }
}
