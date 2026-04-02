import fs from "fs";
import path from "path";
import type { SpecCard, PoolAgent, PoolRecommendation } from "../shared/types";

/**
 * agent-pool/ 디렉토리에서 에이전트 .md 파일을 스캔하고
 * specCard 기반 동적 매칭을 수행한다.
 */
export class AgentPoolManager {
  private pool: PoolAgent[] = [];
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /** agent-pool/ 전체 스캔 → PoolAgent[] 인덱스 구축 */
  async buildIndex(): Promise<PoolAgent[]> {
    this.pool = [];
    const categories = ["core", "game", "web"] as const;

    for (const cat of categories) {
      const dir = path.join(this.basePath, cat);
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir).filter(f => f.endsWith(".md"));
      for (const file of files) {
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        const agent = this.parseFrontmatter(content, cat, `${cat}/${file}`);
        if (agent) this.pool.push(agent);
      }
    }

    console.log(`[AgentPool] Indexed ${this.pool.length} agents`);
    return this.pool;
  }

  /** 전체 풀 반환 */
  getAll(): PoolAgent[] {
    return this.pool;
  }

  /** specCard 기반 자동 매칭 */
  recommend(specCard: SpecCard): PoolRecommendation {
    const keywords = this.extractKeywords(specCard);
    const domain = this.detectDomain(keywords);

    const core: PoolAgent[] = [];
    const recommended: PoolAgent[] = [];
    const optional: PoolAgent[] = [];

    for (const agent of this.pool) {
      // core는 항상 포함
      if (agent.category === "core") {
        core.push({ ...agent, matchScore: 100, matchReason: "필수 에이전트", recommendCategory: "core" });
        continue;
      }

      // 도메인 필터: game specCard면 web 에이전트 제외, 반대도 마찬가지
      if (domain === "game" && agent.category === "web") {
        optional.push({ ...agent, matchScore: 0, matchReason: "웹 전용 (게임 프로젝트)", recommendCategory: "optional" });
        continue;
      }
      if (domain === "web" && agent.category === "game") {
        optional.push({ ...agent, matchScore: 0, matchReason: "게임 전용 (웹 프로젝트)", recommendCategory: "optional" });
        continue;
      }

      // tags 매칭
      const score = this.calculateMatchScore(agent.tags, keywords);
      const reason = this.buildMatchReason(agent, keywords, score);

      if (score > 0) {
        recommended.push({ ...agent, matchScore: score, matchReason: reason, recommendCategory: "recommended" });
      } else {
        optional.push({ ...agent, matchScore: 0, matchReason: agent.description, recommendCategory: "optional" });
      }
    }

    // recommended를 점수 순으로 정렬
    recommended.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));

    return { core, recommended, optional };
  }

  /** 선택된 에이전트 .md를 프로젝트 .claude/agents/에 복사 */
  applyAgents(agentIds: string[], projectDir: string): { success: boolean; appliedAgents: string[]; error?: string } {
    try {
      const agentsDir = path.join(projectDir, ".claude", "agents");

      // 기존 agents/ 백업
      if (fs.existsSync(agentsDir)) {
        const backupDir = `${agentsDir}-backup-${Date.now()}`;
        fs.renameSync(agentsDir, backupDir);
      }

      // .claude/agents/ 생성
      fs.mkdirSync(agentsDir, { recursive: true });

      const applied: string[] = [];
      for (const id of agentIds) {
        const agent = this.pool.find(a => a.id === id);
        if (!agent) continue;

        const src = path.join(this.basePath, agent.filePath);
        const dest = path.join(agentsDir, `${id}.md`);

        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          applied.push(id);
        }
      }

      return { success: true, appliedAgents: applied };
    } catch (err) {
      return { success: false, appliedAgents: [], error: String(err) };
    }
  }

  // ── Private helpers ──

  private parseFrontmatter(content: string, category: string, filePath: string): PoolAgent | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    const fm = match[1];
    const get = (key: string): string => {
      const m = fm.match(new RegExp(`^${key}:\\s*"?([^"\\n]*)"?`, "m"));
      return m ? m[1].trim() : "";
    };

    const tags: string[] = [];
    const tagMatch = fm.match(/tags:\n((?:\s+-\s+.+\n?)*)/);
    if (tagMatch) {
      const lines = tagMatch[1].split("\n");
      for (const line of lines) {
        const t = line.match(/^\s+-\s+(.+)/);
        if (t) tags.push(t[1].trim());
      }
    }

    const name = get("name");
    if (!name) return null;

    return {
      id: name,
      displayName: get("displayName"),
      icon: get("icon"),
      description: get("description"),
      tags,
      category: category as PoolAgent["category"],
      trigger: get("trigger"),
      model: get("model"),
      filePath,
    };
  }

  private extractKeywords(specCard: SpecCard): Set<string> {
    const keywords = new Set<string>();

    // projectType 토큰화
    if (specCard.projectType) {
      for (const token of this.tokenize(specCard.projectType)) {
        keywords.add(token);
      }
    }

    // coreDecisions
    if (specCard.coreDecisions) {
      for (const d of specCard.coreDecisions) {
        for (const token of this.tokenize(d.value)) {
          keywords.add(token);
        }
      }
    }

    // enabled expansions
    if (specCard.expansions) {
      for (const e of specCard.expansions) {
        if (e.enabled) {
          keywords.add(e.id.toLowerCase());
          for (const token of this.tokenize(e.label)) {
            keywords.add(token);
          }
        }
      }
    }

    // techStack
    if (specCard.techStack) {
      for (const t of specCard.techStack) {
        keywords.add(t.toLowerCase());
      }
    }

    return keywords;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, "")
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  private readonly GAME_INDICATORS = new Set([
    "게임", "game", "phaser", "unity", "godot", "rpg", "platformer",
    "shooter", "puzzle", "roguelike", "idle", "action", "fighting",
    "racing", "sports", "strategy", "simulation", "adventure",
    "visual-novel", "피하기", "슈팅", "퍼즐", "액션",
  ]);

  private readonly WEB_INDICATORS = new Set([
    "웹", "web", "saas", "dashboard", "ecommerce", "social",
    "blog", "포털", "쇼핑몰", "대시보드", "api", "website",
    "react", "next", "vue", "angular",
  ]);

  private detectDomain(keywords: Set<string>): "game" | "web" | "mixed" {
    let gameScore = 0;
    let webScore = 0;

    for (const kw of keywords) {
      if (this.GAME_INDICATORS.has(kw)) gameScore++;
      if (this.WEB_INDICATORS.has(kw)) webScore++;
    }

    if (gameScore > 0 && webScore === 0) return "game";
    if (webScore > 0 && gameScore === 0) return "web";
    return "mixed";
  }

  private calculateMatchScore(tags: string[], keywords: Set<string>): number {
    // "all" 태그는 항상 매칭
    if (tags.includes("all")) return 1;

    let score = 0;
    for (const tag of tags) {
      if (keywords.has(tag)) {
        score++;
      } else {
        // 부분 매칭: tag가 keyword에 포함되거나 반대
        for (const kw of keywords) {
          if (kw.includes(tag) || tag.includes(kw)) {
            score += 0.5;
            break;
          }
        }
      }
    }
    return score;
  }

  private buildMatchReason(agent: PoolAgent, keywords: Set<string>, score: number): string {
    const matched: string[] = [];
    for (const tag of agent.tags) {
      if (tag === "all") continue;
      if (keywords.has(tag)) matched.push(tag.toUpperCase());
    }

    if (matched.length > 0) {
      return `${matched.join(" + ")}와 매칭 (${score}점)`;
    }
    return agent.description;
  }
}
