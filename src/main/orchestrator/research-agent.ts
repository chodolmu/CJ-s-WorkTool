import { CLIBridge, type CLIStreamEvent } from "../agent-runner/cli-bridge";
import { MemoryManager } from "../memory/memory-manager";
import { EventEmitter } from "events";
import type { SpecCard } from "@shared/types";

/**
 * R&D Research Agent
 *
 * 프로젝트 시작 전 기술 스택 비교, 아키텍처 탐색, 리스크 분석을 수행
 *
 * 출력: 구조화된 리서치 리포트
 *   - 기술 스택 비교표
 *   - 추천 아키텍처
 *   - 핵심 리스크 + 완화 방안
 *   - 레퍼런스 프로젝트 분석
 */
export class ResearchAgent extends EventEmitter {
  constructor(
    private cliBridge: CLIBridge,
    private memoryManager: MemoryManager,
  ) {
    super();
  }

  async run(params: {
    projectId: string;
    specCard: SpecCard;
    workingDir: string;
    focusAreas?: string[];
  }): Promise<ResearchReport> {
    const { projectId, specCard, workingDir, focusAreas } = params;

    this.emit("activity", {
      agentId: "researcher",
      eventType: "system",
      message: "Starting R&D research...",
    });

    const prompt = this.buildResearchPrompt(specCard, focusAreas);

    const session = this.cliBridge.spawn(prompt, {
      workingDir,
      model: "sonnet",
      systemPrompt: `You are a senior technical researcher. Analyze the project requirements and produce a comprehensive research report. Always respond with valid JSON matching the requested format.`,
    });

    let output = "";
    session.on("event", (event: CLIStreamEvent) => {
      if (event.type === "text") output += event.content;
      this.emit("activity", {
        agentId: "researcher",
        eventType: event.type === "text" ? "thinking" : event.type,
        message: event.content.slice(0, 150),
      });
    });

    const result = await session.waitForCompletion();
    const fullOutput = output || result.output;

    const report = this.parseReport(fullOutput, specCard);

    this.emit("activity", {
      agentId: "researcher",
      eventType: "complete",
      message: `Research complete: ${report.recommendations.length} recommendations`,
    });

    return report;
  }

  private buildResearchPrompt(specCard: SpecCard, focusAreas?: string[]): string {
    const decisions = specCard.coreDecisions.map((d) => `- ${d.label}: ${d.value}`).join("\n");
    const expansions = specCard.expansions.filter((e) => e.enabled).map((e) => e.label).join(", ");
    const techStack = specCard.techStack.join(", ");
    const focus = focusAreas?.length ? `\n\nFocus especially on: ${focusAreas.join(", ")}` : "";

    return `Analyze this project and produce a research report.

## Project: ${specCard.projectType}

### Core Decisions:
${decisions}

### Enabled Features: ${expansions}
### Proposed Tech Stack: ${techStack}
${focus}

Respond with JSON in this format:
{
  "techComparison": [
    { "option": "React + Canvas", "pros": [".."], "cons": [".."], "verdict": "recommended|alternative|not-recommended" }
  ],
  "architectureRecommendation": {
    "pattern": "Component-based with game loop",
    "description": "...",
    "keyModules": ["GameEngine", "Renderer", "InputManager", "StateManager"]
  },
  "risks": [
    { "risk": "...", "severity": "high|medium|low", "mitigation": "..." }
  ],
  "recommendations": [
    { "category": "tech|architecture|process", "title": "...", "description": "..." }
  ],
  "estimatedComplexity": "simple|moderate|complex",
  "summary": "1-2 sentence overview"
}`;
  }

  private parseReport(output: string, specCard: SpecCard): ResearchReport {
    try {
      const jsonMatch = output.match(/\{[\s\S]*"summary"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          techComparison: parsed.techComparison ?? [],
          architectureRecommendation: parsed.architectureRecommendation ?? { pattern: "", description: "", keyModules: [] },
          risks: parsed.risks ?? [],
          recommendations: parsed.recommendations ?? [],
          estimatedComplexity: parsed.estimatedComplexity ?? "moderate",
          summary: parsed.summary ?? "",
        };
      }
    } catch { /* parse fail */ }

    // Fallback
    return {
      techComparison: [{
        option: specCard.techStack.join(" + "),
        pros: ["Proposed stack matches project type"],
        cons: ["Research could not be completed automatically"],
        verdict: "recommended" as const,
      }],
      architectureRecommendation: {
        pattern: "Standard",
        description: "Use the proposed tech stack with standard architecture patterns.",
        keyModules: ["Core", "UI", "State"],
      },
      risks: [{ risk: "Auto-research incomplete", severity: "low" as const, mitigation: "Manual review recommended" }],
      recommendations: [{ category: "process" as const, title: "Manual Review", description: "Review tech choices manually before proceeding" }],
      estimatedComplexity: "moderate" as const,
      summary: output.slice(0, 300) || "Research completed with limited results. Manual review recommended.",
    };
  }
}

export interface ResearchReport {
  techComparison: {
    option: string;
    pros: string[];
    cons: string[];
    verdict: "recommended" | "alternative" | "not-recommended";
  }[];
  architectureRecommendation: {
    pattern: string;
    description: string;
    keyModules: string[];
  };
  risks: {
    risk: string;
    severity: "high" | "medium" | "low";
    mitigation: string;
  }[];
  recommendations: {
    category: "tech" | "architecture" | "process";
    title: string;
    description: string;
  }[];
  estimatedComplexity: "simple" | "moderate" | "complex";
  summary: string;
}
