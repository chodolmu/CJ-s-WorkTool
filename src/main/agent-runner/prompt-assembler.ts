import fs from "fs";
import path from "path";
import type { AgentDefinition, SpecCard, Feature } from "@shared/types";
import type { PresetManager } from "../preset/preset-manager";
import type { MemoryManager } from "../memory/memory-manager";
import { LearningManager } from "../memory/learning-manager";
import { getDataDir } from "../memory/database";

interface AssembleParams {
  projectId: string;
  presetId: string;
  agentDef: AgentDefinition;
  taskContext: string;
  previousFeedback?: string;
}

/**
 * 모듈식 프롬프트 조립기
 *
 * 조립 순서:
 *   1. base.md (글로벌 규칙)               ~500 토큰
 *   2. preset rules (프리셋 규칙)           ~300 토큰
 *   3. agent role (에이전트 역할)            ~200 토큰
 *   4. project state 요약                   ~500 토큰
 *   5. task context (이번 태스크)            ~300 토큰
 *   6. output format                        ~100 토큰
 *   ──────────────────────────────────
 *   총 오버헤드: ~1,900 토큰 (~5%)
 */
export class PromptAssembler {
  private learningManager: LearningManager;

  constructor(
    private presetManager: PresetManager,
    private memoryManager: MemoryManager,
  ) {
    this.learningManager = new LearningManager(memoryManager);
  }

  assemble(params: AssembleParams): string {
    const sections: string[] = [];

    // 1. Base instructions
    sections.push(this.getBaseInstructions());

    // 2. Preset rules
    const preset = this.presetManager.getPreset(params.presetId);
    if (preset?.baseGuidelines) {
      sections.push(`## Preset Rules\n${preset.baseGuidelines}`);
    }

    // 3. Agent role
    sections.push(this.buildAgentRoleSection(params.agentDef));

    // 4. Project state
    const stateSection = this.buildProjectStateSection(params.projectId);
    if (stateSection) {
      sections.push(stateSection);
    }

    // 5. Accumulated learnings (에이전트 학습 내용)
    if (params.agentDef.id === "generator") {
      const lessons = this.learningManager.getLessonsForPrompt(params.projectId);
      if (lessons) {
        sections.push(lessons);
      }
    }

    // 6. Task context
    sections.push(`## Current Task\n${params.taskContext}`);

    // 6. Previous feedback (재시도 시)
    if (params.previousFeedback) {
      sections.push(
        `## Previous Evaluator Feedback (FIX THESE ISSUES)\n${params.previousFeedback}`,
      );
    }

    // 7. Output format
    if (params.agentDef.outputFormat) {
      sections.push(
        `## Required Output Format\nRespond with JSON in this format:\n\`\`\`json\n${params.agentDef.outputFormat}\n\`\`\``,
      );
    }

    return sections.join("\n\n---\n\n");
  }

  private getBaseInstructions(): string {
    // 글로벌 기본 지침 로드
    const basePath = path.join(getDataDir(), "guidelines", "base.md");
    if (fs.existsSync(basePath)) {
      return fs.readFileSync(basePath, "utf-8");
    }

    // 기본 내장 지침
    return `## Base Instructions
You are an AI agent working as part of a harness system.
Follow the role and constraints defined below precisely.
When you complete your task, output the result in the required format.
Do not deviate from your assigned role.
Always write a change summary in simple, non-technical language that a non-developer can understand.`;
  }

  private buildAgentRoleSection(agent: AgentDefinition): string {
    const lines: string[] = [
      `## Your Role: ${agent.displayName} ${agent.icon}`,
      `**Role**: ${agent.role}`,
      `**Goal**: ${agent.goal}`,
    ];

    if (agent.constraints.length > 0) {
      lines.push(`\n**Constraints**:`);
      for (const c of agent.constraints) {
        lines.push(`- ${c}`);
      }
    }

    if (agent.guidelines.length > 0) {
      lines.push(`\n**Guidelines**:`);
      for (const g of agent.guidelines) {
        lines.push(`- ${g}`);
      }
    }

    return lines.join("\n");
  }

  private buildProjectStateSection(projectId: string): string | null {
    const project = this.memoryManager.getProject(projectId);
    if (!project) return null;

    const features = this.memoryManager.getFeatures(projectId);
    const lines: string[] = [`## Project State`];

    lines.push(`**Project**: ${project.name}`);
    lines.push(`**Status**: ${project.status}`);

    if (project.specCard) {
      lines.push(`\n**Spec Summary**:`);
      for (const d of project.specCard.coreDecisions) {
        lines.push(`- ${d.label}: ${d.value}`);
      }
      const enabledExpansions = project.specCard.expansions.filter(
        (e) => e.enabled,
      );
      if (enabledExpansions.length > 0) {
        lines.push(
          `- Enabled expansions: ${enabledExpansions.map((e) => e.label).join(", ")}`,
        );
      }
      lines.push(`- Tech stack: ${project.specCard.techStack.join(", ")}`);
    }

    if (features.length > 0) {
      lines.push(`\n**Features** (${features.filter((f) => f.status === "completed").length}/${features.length} done):`);
      for (const f of features) {
        const icon =
          f.status === "completed" ? "✅" :
          f.status === "in_progress" ? "🔄" :
          f.status === "failed" ? "❌" : "⏳";
        lines.push(`  ${icon} ${f.order}. ${f.name}`);
      }
    }

    return lines.join("\n");
  }
}
