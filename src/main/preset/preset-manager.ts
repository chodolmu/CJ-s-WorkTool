import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import type { Preset, AgentDefinition, DiscoveryQuestion } from "@shared/types";

export class PresetManager {
  private builtinDir: string;
  private customDir: string;

  constructor(builtinDir: string, customDir: string) {
    this.builtinDir = builtinDir;
    this.customDir = customDir;
    if (!fs.existsSync(this.customDir)) {
      fs.mkdirSync(this.customDir, { recursive: true });
    }
  }

  /** 모든 프리셋 목록 (builtin + custom) */
  listPresets(): Preset[] {
    const presets: Preset[] = [];

    // Builtin presets
    if (fs.existsSync(this.builtinDir)) {
      for (const dir of this.readDirs(this.builtinDir)) {
        const preset = this.loadPreset(path.join(this.builtinDir, dir));
        if (preset) presets.push(preset);
      }
    }

    // Custom presets
    if (fs.existsSync(this.customDir)) {
      for (const dir of this.readDirs(this.customDir)) {
        const preset = this.loadPreset(path.join(this.customDir, dir));
        if (preset) presets.push(preset);
      }
    }

    return presets;
  }

  /** 특정 프리셋 로드 */
  getPreset(presetId: string): Preset | null {
    // Check builtin first, then custom
    const builtinPath = path.join(this.builtinDir, presetId);
    if (fs.existsSync(builtinPath)) {
      return this.loadPreset(builtinPath);
    }

    const customPath = path.join(this.customDir, presetId);
    if (fs.existsSync(customPath)) {
      return this.loadPreset(customPath);
    }

    return null;
  }

  /** 프리셋의 에이전트 목록 */
  getAgents(presetId: string): AgentDefinition[] {
    const preset = this.getPreset(presetId);
    return preset?.agents ?? [];
  }

  /** 특정 에이전트 정의 로드 */
  getAgent(presetId: string, agentId: string): AgentDefinition | null {
    const agents = this.getAgents(presetId);
    return agents.find((a) => a.id === agentId) ?? null;
  }

  /** 에이전트 정의를 YAML 파일로 저장 */
  saveAgent(presetId: string, agent: AgentDefinition): void {
    // custom 디렉토리에 저장
    const presetDir = path.join(this.customDir, presetId);
    const agentsDir = path.join(presetDir, "agents");

    if (!fs.existsSync(presetDir)) {
      // builtin에서 preset.yaml 복사
      const builtinPresetFile = path.join(this.builtinDir, presetId, "preset.yaml");
      fs.mkdirSync(presetDir, { recursive: true });
      if (fs.existsSync(builtinPresetFile)) {
        fs.copyFileSync(builtinPresetFile, path.join(presetDir, "preset.yaml"));
      }
    }
    if (!fs.existsSync(agentsDir)) {
      fs.mkdirSync(agentsDir, { recursive: true });
    }

    const agentFile = path.join(agentsDir, `${agent.id}.yaml`);
    const yamlContent = yaml.dump(agent, { lineWidth: 120 });
    fs.writeFileSync(agentFile, yamlContent, "utf-8");
  }

  /** 에이전트 YAML 파일 삭제 */
  deleteAgent(presetId: string, agentId: string): boolean {
    // custom 먼저, 없으면 builtin에서 삭제 (보호된 에이전트는 호출자가 체크)
    const customFile = path.join(this.customDir, presetId, "agents", `${agentId}.yaml`);
    if (fs.existsSync(customFile)) {
      fs.unlinkSync(customFile);
      return true;
    }

    const builtinFile = path.join(this.builtinDir, presetId, "agents", `${agentId}.yaml`);
    if (fs.existsSync(builtinFile)) {
      fs.unlinkSync(builtinFile);
      return true;
    }

    return false;
  }

  /** 프리셋 폴더에서 preset.yaml + agents/*.yaml 로드 */
  private loadPreset(presetDir: string): Preset | null {
    const presetFile = path.join(presetDir, "preset.yaml");
    if (!fs.existsSync(presetFile)) return null;

    try {
      const raw = yaml.load(fs.readFileSync(presetFile, "utf-8")) as Record<
        string,
        unknown
      >;

      // Load agents from agents/ directory
      const agents = this.loadAgents(path.join(presetDir, "agents"));

      // Load guidelines
      const guidelinesDir = path.join(presetDir, "guidelines");
      let baseGuidelines = (raw.baseGuidelines as string) ?? "";
      const rulesFile = path.join(guidelinesDir, "rules.md");
      if (fs.existsSync(rulesFile)) {
        baseGuidelines = fs.readFileSync(rulesFile, "utf-8");
      }

      return {
        id: raw.id as string,
        name: raw.name as string,
        description: (raw.description as string) ?? "",
        discoveryQuestions: this.parseQuestions(raw.discoveryQuestions),
        agents,
        evaluatorCriteria: (raw.evaluatorCriteria as string[]) ?? [],
        baseGuidelines,
      };
    } catch {
      console.error(`Failed to load preset from ${presetDir}`);
      return null;
    }
  }

  /** agents/ 디렉토리에서 YAML 에이전트 정의 로드 */
  private loadAgents(agentsDir: string): AgentDefinition[] {
    if (!fs.existsSync(agentsDir)) return [];

    const agents: AgentDefinition[] = [];
    for (const file of fs.readdirSync(agentsDir)) {
      if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;

      try {
        const raw = yaml.load(
          fs.readFileSync(path.join(agentsDir, file), "utf-8"),
        ) as Record<string, unknown>;

        agents.push({
          id: raw.id as string,
          displayName: (raw.displayName as string) ?? raw.id,
          icon: (raw.icon as string) ?? "🤖",
          role: (raw.role as string) ?? "",
          goal: (raw.goal as string) ?? "",
          constraints: (raw.constraints as string[]) ?? [],
          model: (raw.model as AgentDefinition["model"]) ?? "sonnet",
          trigger:
            (raw.trigger as AgentDefinition["trigger"]) ?? "manual",
          guidelines: (raw.guidelines as string[]) ?? [],
          outputFormat: (raw.outputFormat as string) ?? "",
        });
      } catch {
        console.error(`Failed to load agent from ${file}`);
      }
    }

    return agents;
  }

  private parseQuestions(raw: unknown): DiscoveryQuestion[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((q: Record<string, unknown>) => ({
      id: q.id as string,
      question: q.question as string,
      options: ((q.options as Array<Record<string, string>>) ?? []).map(
        (o) => ({
          label: o.label,
          value: o.value,
          description: o.description,
        }),
      ),
      allowFreeText: (q.allowFreeText as boolean) ?? false,
      order: (q.order as number) ?? 0,
      conditional: q.conditional as DiscoveryQuestion["conditional"],
    }));
  }

  private readDirs(dir: string): string[] {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  }
}
