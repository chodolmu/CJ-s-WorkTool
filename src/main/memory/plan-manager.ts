import { v4 as uuid } from "uuid";
import type {
  PlanDocument,
  PlanChangeLog,
  Feature,
  FeatureStatus,
  SpecCard,
  AgentDefinition,
} from "@shared/types";

export class PlanManager {
  constructor(private db: any) {}

  /** Discovery 완료 시 Plan 자동 생성 */
  createFromSpecCard(
    projectId: string,
    specCard: SpecCard,
    agents: AgentDefinition[],
  ): void {
    const plan: PlanDocument = {
      overview: specCard.projectType,
      specSummary: {
        projectType: specCard.projectType,
        coreDecisions: specCard.coreDecisions,
        techStack: specCard.techStack,
        expansions: specCard.expansions.map((e) => ({ label: e.label, enabled: e.enabled })),
      },
      features: [],
      agentTeam: agents.map((a) => ({
        id: a.id,
        displayName: a.displayName,
        icon: a.icon,
        role: a.role,
      })),
      changeLog: [
        {
          date: new Date().toISOString(),
          action: "plan_created",
          detail: `프로젝트 "${specCard.projectType}" 계획 생성`,
          trigger: "system",
        },
      ],
    };

    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO project_plans (id, project_id, version, content_json, created_at, updated_at)
         VALUES (?, ?, 1, ?, ?, ?)`,
      )
      .run(uuid(), projectId, JSON.stringify(plan), now, now);
  }

  /** Feature 목록 동기화 (Planner 완료 후) */
  syncFeatures(projectId: string, features: Feature[]): void {
    const plan = this.getPlan(projectId);
    if (!plan) return;

    const oldNames = new Set(plan.features.map((f) => f.name));

    for (const f of features) {
      if (!oldNames.has(f.name)) {
        plan.changeLog.push({
          date: new Date().toISOString(),
          action: "feature_added",
          detail: `기능 "${f.name}" 추가`,
          trigger: "pipeline",
        });
      }
    }

    const newNames = new Set(features.map((f) => f.name));
    for (const f of plan.features) {
      if (!newNames.has(f.name)) {
        plan.changeLog.push({
          date: new Date().toISOString(),
          action: "feature_removed",
          detail: `기능 "${f.name}" 제거`,
          trigger: "pipeline",
        });
      }
    }

    plan.features = features.map((f) => ({
      featureId: f.id,
      name: f.name,
      description: f.description,
      status: f.status,
      estimatedStart: f.estimatedStart,
      estimatedEnd: f.estimatedEnd,
      assignedAgent: f.assignedAgent,
    }));

    this.savePlan(projectId, plan);
  }

  /** 변경 로그 추가 */
  addChangeLog(
    projectId: string,
    action: PlanChangeLog["action"],
    detail: string,
    trigger: PlanChangeLog["trigger"],
  ): void {
    const plan = this.getPlan(projectId);
    if (!plan) return;
    plan.changeLog.push({ date: new Date().toISOString(), action, detail, trigger });
    this.savePlan(projectId, plan);
  }

  /** Feature 상태 업데이트 반영 */
  updateFeatureStatus(projectId: string, featureId: string, status: FeatureStatus): void {
    const plan = this.getPlan(projectId);
    if (!plan) return;
    const entry = plan.features.find((f) => f.featureId === featureId);
    if (entry) {
      entry.status = status;
      plan.changeLog.push({
        date: new Date().toISOString(),
        action: status === "completed" ? "feature_completed" : "feature_status_changed",
        detail: `"${entry.name}" 상태 → ${status}`,
        trigger: "pipeline",
      });
      this.savePlan(projectId, plan);
    }
  }

  /** 스펙 ↔ 기능 일치도 (P0-03 연동) */
  getSpecMatchRate(projectId: string): { rate: number; missing: string[]; extra: string[] } {
    const plan = this.getPlan(projectId);
    if (!plan) return { rate: 100, missing: [], extra: [] };

    const specKeywords = this.extractSpecKeywords(plan.specSummary);
    const featureNames = plan.features.map((f) => f.name.toLowerCase());

    const missing = specKeywords.filter(
      (k) => !featureNames.some((fn) => fn.includes(k)),
    );
    const rate =
      specKeywords.length === 0
        ? 100
        : Math.round(((specKeywords.length - missing.length) / specKeywords.length) * 100);

    return { rate, missing, extra: [] };
  }

  /** Plan 조회 */
  getPlan(projectId: string): PlanDocument | null {
    const row = this.db
      .prepare(
        "SELECT content_json FROM project_plans WHERE project_id = ? ORDER BY version DESC LIMIT 1",
      )
      .get(projectId) as { content_json: string } | undefined;

    if (!row) return null;
    return JSON.parse(row.content_json);
  }

  private savePlan(projectId: string, plan: PlanDocument): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        "UPDATE project_plans SET content_json = ?, version = version + 1, updated_at = ? WHERE project_id = ?",
      )
      .run(JSON.stringify(plan), now, projectId);
  }

  private extractSpecKeywords(spec: PlanDocument["specSummary"]): string[] {
    const keywords: string[] = [];
    for (const d of spec.coreDecisions) {
      keywords.push(d.value.toLowerCase());
    }
    for (const e of spec.expansions) {
      if (e.enabled) keywords.push(e.label.toLowerCase());
    }
    return keywords;
  }
}
