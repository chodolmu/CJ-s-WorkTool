import { CLIBridge } from "./cli-bridge";
import { MemoryManager } from "../memory/memory-manager";
import { PresetManager } from "../preset/preset-manager";
import type { AgentDefinition } from "@shared/types";

interface GuidelineGenParams {
  projectId: string;
  presetId: string;
  roughDescription: string;
}

interface ClarificationQuestion {
  question: string;
  options: { label: string; value: string }[];
  allowFreeText: boolean;
}

interface GuidelineGenResult {
  needsClarification: boolean;
  clarificationQuestions?: ClarificationQuestion[];
  generatedAgent?: AgentDefinition;
}

/**
 * 사용자의 대략적 역할 설명 → AI가 세부 지침 자동 생성
 *
 * 플로우:
 * 1. 프로젝트 맥락 수집 (스펙 카드, 기존 에이전트, 프리셋)
 * 2. Claude에게 지침 생성 요청
 * 3. 불명확 시 추가 질문 반환
 * 4. 최종 에이전트 정의 반환
 */
export class GuidelineGenerator {
  constructor(
    private cliBridge: CLIBridge,
    private memoryManager: MemoryManager,
    private presetManager: PresetManager,
  ) {}

  async generate(params: GuidelineGenParams): Promise<GuidelineGenResult> {
    const project = this.memoryManager.getProject(params.projectId);
    const existingAgents = this.presetManager.getAgents(params.presetId);
    const preset = this.presetManager.getPreset(params.presetId);

    const prompt = `You are an AI agent architect. Based on the following context, create a detailed agent definition.

## User's Description (rough)
"${params.roughDescription}"

## Project Context
- Project: ${project?.name ?? "Unknown"}
- Preset: ${preset?.name ?? params.presetId}
- Tech stack: ${project?.specCard?.techStack?.join(", ") ?? "Unknown"}
- Core decisions: ${project?.specCard?.coreDecisions?.map((d) => `${d.label}: ${d.value}`).join(", ") ?? "None"}

## Existing Agents (avoid role conflicts)
${existingAgents.map((a) => `- ${a.displayName} (${a.role}): ${a.goal}`).join("\n")}

## Instructions
1. If the description is clear enough, generate a complete agent definition in JSON format.
2. If the description is ambiguous, return clarification questions in JSON format.
3. The agent's guidelines should be specific, actionable, and tailored to this project.
4. Constraints should prevent the agent from stepping outside its role.
5. Choose the appropriate model: opus for analysis/planning, sonnet for implementation.

Respond with ONLY valid JSON in one of these formats:

Format A (agent ready):
{
  "type": "agent",
  "agent": {
    "id": "kebab-case-id",
    "displayName": "Display Name",
    "icon": "emoji",
    "role": "one line role",
    "goal": "one line goal",
    "constraints": ["constraint 1", "constraint 2"],
    "model": "sonnet",
    "trigger": "after_evaluator",
    "guidelines": ["guideline 1", "guideline 2", "guideline 3"],
    "outputFormat": "{ \\"status\\": \\"...\\" }"
  }
}

Format B (need clarification):
{
  "type": "clarification",
  "questions": [
    {
      "question": "What should this agent focus on?",
      "options": [
        { "label": "Option A", "value": "a" },
        { "label": "Option B", "value": "b" }
      ],
      "allowFreeText": true
    }
  ]
}`;

    const session = this.cliBridge.spawn(prompt, {
      workingDir: process.cwd(),
      model: "opus",
    });

    const result = await session.waitForCompletion();
    return this.parseResult(result.output);
  }

  private parseResult(output: string): GuidelineGenResult {
    try {
      // JSON 블록 추출
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");

      const parsed = JSON.parse(jsonMatch[0]);

      if (parsed.type === "clarification" && parsed.questions) {
        return {
          needsClarification: true,
          clarificationQuestions: parsed.questions,
        };
      }

      if (parsed.type === "agent" && parsed.agent) {
        return {
          needsClarification: false,
          generatedAgent: {
            id: parsed.agent.id ?? "custom-agent",
            displayName: parsed.agent.displayName ?? "Custom Agent",
            icon: parsed.agent.icon ?? "🤖",
            role: parsed.agent.role ?? "",
            goal: parsed.agent.goal ?? "",
            constraints: parsed.agent.constraints ?? [],
            model: parsed.agent.model ?? "sonnet",
            trigger: parsed.agent.trigger ?? "manual",
            guidelines: parsed.agent.guidelines ?? [],
            outputFormat: parsed.agent.outputFormat ?? "",
          },
        };
      }
    } catch {
      // 파싱 실패
    }

    // 파싱 실패 시 기본 에이전트 반환
    return {
      needsClarification: false,
      generatedAgent: {
        id: "custom-agent",
        displayName: "Custom Agent",
        icon: "🤖",
        role: "Custom role",
        goal: output.slice(0, 200),
        constraints: [],
        model: "sonnet",
        trigger: "manual",
        guidelines: [],
        outputFormat: "",
      },
    };
  }
}
