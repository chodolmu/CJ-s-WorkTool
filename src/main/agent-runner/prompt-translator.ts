import type { SpecCard, AgentDefinition } from "@shared/types";

/**
 * Prompt Translator
 *
 * 사용자의 자연어 입력을 AI 에이전트가 이해하기 좋은
 * 구조화된 프롬프트로 변환
 *
 * 변환 과정:
 *   1. 의도 분석 (intent detection)
 *   2. 컨텍스트 주입 (프로젝트 상태, 이전 작업)
 *   3. 구조화 (action + target + constraints + expected output)
 *   4. 에이전트별 최적화 (역할에 맞게 톤 조정)
 */
export class PromptTranslator {
  /**
   * 사용자 자연어 → 에이전트용 구조화 프롬프트
   */
  translate(params: {
    userMessage: string;
    targetAgent: AgentDefinition;
    projectContext: ProjectContext;
    conversationHistory?: string[];
  }): TranslatedPrompt {
    const { userMessage, targetAgent, projectContext, conversationHistory } = params;

    // 1. 의도 분석
    const intent = this.detectIntent(userMessage);

    // 2. 구조화된 프롬프트 생성
    const sections: string[] = [];

    // 프로젝트 컨텍스트
    sections.push(this.buildContextSection(projectContext));

    // 에이전트 역할 리마인더
    sections.push(this.buildRoleReminder(targetAgent));

    // 사용자 의도를 구조화된 지시로 변환
    sections.push(this.buildTaskSection(userMessage, intent));

    // 이전 대화 컨텍스트 (있으면)
    if (conversationHistory?.length) {
      sections.push(this.buildHistorySection(conversationHistory));
    }

    // 출력 가이드
    sections.push(this.buildOutputGuide(intent, targetAgent));

    return {
      prompt: sections.join("\n\n---\n\n"),
      intent,
      estimatedTokens: Math.ceil(sections.join("").length / 4),
    };
  }

  /**
   * 사용자 의도 감지
   */
  private detectIntent(message: string): Intent {
    const msg = message.toLowerCase();

    // 생성 의도
    if (/만들|create|add|추가|생성|build|implement|구현/.test(msg)) {
      return {
        type: "create",
        action: "새로운 기능/컴포넌트 생성",
        urgency: this.detectUrgency(msg),
        scope: this.detectScope(msg),
      };
    }

    // 수정 의도
    if (/바꿔|수정|change|modify|update|fix|고쳐|변경/.test(msg)) {
      return {
        type: "modify",
        action: "기존 코드 수정",
        urgency: this.detectUrgency(msg),
        scope: this.detectScope(msg),
      };
    }

    // 삭제 의도
    if (/삭제|제거|remove|delete|지워/.test(msg)) {
      return {
        type: "delete",
        action: "기존 기능/코드 제거",
        urgency: this.detectUrgency(msg),
        scope: this.detectScope(msg),
      };
    }

    // 분석/설명 의도
    if (/설명|explain|왜|why|어떻게|how|분석|analyze/.test(msg)) {
      return {
        type: "analyze",
        action: "코드/구조 분석 및 설명",
        urgency: "low",
        scope: "single",
      };
    }

    // 리팩토링
    if (/리팩토|refactor|정리|clean|개선|improve|최적화|optimize/.test(msg)) {
      return {
        type: "refactor",
        action: "코드 구조 개선",
        urgency: this.detectUrgency(msg),
        scope: this.detectScope(msg),
      };
    }

    // 기본: 생성으로 처리
    return {
      type: "create",
      action: "작업 수행",
      urgency: "normal",
      scope: this.detectScope(msg),
    };
  }

  private detectUrgency(msg: string): "low" | "normal" | "high" {
    if (/급하|urgent|asap|빨리|지금 당장/.test(msg)) return "high";
    if (/나중에|when you can|여유/.test(msg)) return "low";
    return "normal";
  }

  private detectScope(msg: string): "single" | "multi" | "system" {
    if (/전체|all|시스템|system|아키텍처|architecture/.test(msg)) return "system";
    if (/여러|multiple|몇 개|various/.test(msg)) return "multi";
    return "single";
  }

  private buildContextSection(ctx: ProjectContext): string {
    const lines = ["## Project Context"];
    lines.push(`Project: ${ctx.projectName} (${ctx.projectType})`);
    lines.push(`Tech Stack: ${ctx.techStack.join(", ")}`);
    lines.push(`Current Phase: ${ctx.currentPhase}`);

    if (ctx.completedFeatures > 0 || ctx.totalFeatures > 0) {
      lines.push(`Progress: ${ctx.completedFeatures}/${ctx.totalFeatures} features done`);
    }

    if (ctx.recentChanges.length > 0) {
      lines.push("\nRecent changes:");
      for (const change of ctx.recentChanges.slice(-3)) {
        lines.push(`- ${change}`);
      }
    }

    return lines.join("\n");
  }

  private buildRoleReminder(agent: AgentDefinition): string {
    return `## Your Role: ${agent.displayName} (${agent.role})\nGoal: ${agent.goal}\nConstraints: ${agent.constraints.join(", ") || "None"}`;
  }

  private buildTaskSection(userMessage: string, intent: Intent): string {
    return [
      "## Task",
      `**User Request**: "${userMessage}"`,
      `**Detected Intent**: ${intent.type} — ${intent.action}`,
      `**Scope**: ${intent.scope}`,
      "",
      "Translate the above user request into concrete implementation steps.",
      "Focus on what needs to be done, not what the user said.",
    ].join("\n");
  }

  private buildHistorySection(history: string[]): string {
    return [
      "## Recent Conversation Context",
      ...history.slice(-5).map((h) => `> ${h}`),
    ].join("\n");
  }

  private buildOutputGuide(intent: Intent, agent: AgentDefinition): string {
    const guides: Record<string, string> = {
      create: "After completing the task, write a change summary in simple language explaining what was created.",
      modify: "After completing the task, write a change summary explaining what was changed and why.",
      delete: "After completing the task, write a change summary explaining what was removed.",
      analyze: "Provide a clear, non-technical explanation that someone without coding experience can understand.",
      refactor: "After completing the task, write a change summary explaining what was improved.",
    };

    return [
      "## Output Requirements",
      guides[intent.type] ?? guides.create,
      agent.outputFormat ? `\nExpected format:\n\`\`\`json\n${agent.outputFormat}\n\`\`\`` : "",
    ].filter(Boolean).join("\n");
  }
}

export interface Intent {
  type: "create" | "modify" | "delete" | "analyze" | "refactor";
  action: string;
  urgency: "low" | "normal" | "high";
  scope: "single" | "multi" | "system";
}

export interface TranslatedPrompt {
  prompt: string;
  intent: Intent;
  estimatedTokens: number;
}

export interface ProjectContext {
  projectName: string;
  projectType: string;
  techStack: string[];
  currentPhase: string;
  completedFeatures: number;
  totalFeatures: number;
  recentChanges: string[];
}
