import { v4 as uuid } from "uuid";
import type {
  Project,
  Feature,
  AgentRun,
  ActivityEntry,
  Session,
  ChatMessage,
  SpecCard,
  FeatureStatus,
  AgentStatus,
  ActivityEventType,
  Finding,
  ScheduleItem,
} from "@shared/types";

export class MemoryManager {
  constructor(private db: any) {}

  // ════════════════════════════════════
  // Projects
  // ════════════════════════════════════

  createProject(name: string, presetId: string, workingDir?: string, agents?: unknown[]): Project {
    const now = new Date().toISOString();
    const project: Project = {
      id: uuid(),
      name,
      presetId,
      specCard: null,
      status: "discovery",
      workingDir: workingDir ?? "",
      selectedAgents: (agents ?? []) as Project["selectedAgents"],
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO projects (id, name, preset_id, status, spec_card_json, working_dir, agents_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        project.id,
        project.name,
        project.presetId,
        project.status,
        null,
        project.workingDir,
        agents ? JSON.stringify(agents) : null,
        project.createdAt,
        project.updatedAt,
      );

    return project;
  }

  getProject(id: string): Project | null {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;

    if (!row) return null;
    return this.rowToProject(row);
  }

  listProjects(): Project[] {
    const rows = this.db
      .prepare("SELECT * FROM projects ORDER BY updated_at DESC")
      .all() as Record<string, unknown>[];

    return rows.map((r) => this.rowToProject(r));
  }

  updateProjectStatus(id: string, status: string): void {
    this.db
      .prepare("UPDATE projects SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, new Date().toISOString(), id);
  }

  updateProjectSpecCard(id: string, specCard: SpecCard): void {
    this.db
      .prepare(
        "UPDATE projects SET spec_card_json = ?, updated_at = ? WHERE id = ?",
      )
      .run(JSON.stringify(specCard), new Date().toISOString(), id);
  }

  private rowToProject(row: Record<string, unknown>): Project {
    return {
      id: row.id as string,
      name: row.name as string,
      presetId: row.preset_id as string,
      specCard: row.spec_card_json
        ? (JSON.parse(row.spec_card_json as string) as SpecCard)
        : null,
      status: row.status as Project["status"],
      workingDir: (row.working_dir as string) ?? "",
      selectedAgents: row.agents_json
        ? JSON.parse(row.agents_json as string)
        : [],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  // ════════════════════════════════════
  // Features
  // ════════════════════════════════════

  createFeature(
    projectId: string,
    name: string,
    description: string,
    order: number,
  ): Feature {
    const now = new Date().toISOString();
    const feature: Feature = {
      id: uuid(),
      projectId,
      name,
      description,
      order,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      estimatedStart: null,
      estimatedEnd: null,
      actualStart: null,
      actualEnd: null,
      assignedAgent: null,
      priority: 0,
    };

    this.db
      .prepare(
        `INSERT INTO features (id, project_id, name, description, order_num, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        feature.id,
        feature.projectId,
        feature.name,
        feature.description,
        feature.order,
        feature.status,
        feature.createdAt,
        feature.updatedAt,
      );

    return feature;
  }

  getFeatures(projectId: string): Feature[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM features WHERE project_id = ? ORDER BY order_num",
      )
      .all(projectId) as Record<string, unknown>[];

    return rows.map((r) => this.rowToFeature(r));
  }

  private rowToFeature(r: Record<string, unknown>): Feature {
    return {
      id: r.id as string,
      projectId: r.project_id as string,
      name: r.name as string,
      description: (r.description as string) || "",
      order: r.order_num as number,
      status: r.status as FeatureStatus,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      estimatedStart: (r.estimated_start as string) ?? null,
      estimatedEnd: (r.estimated_end as string) ?? null,
      actualStart: (r.actual_start as string) ?? null,
      actualEnd: (r.actual_end as string) ?? null,
      assignedAgent: (r.assigned_agent as string) ?? null,
      priority: (r.priority as number) ?? 0,
    };
  }

  updateFeatureStatus(id: string, status: FeatureStatus): void {
    this.db
      .prepare("UPDATE features SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, new Date().toISOString(), id);
  }

  // ════════════════════════════════════
  // Agent Runs
  // ════════════════════════════════════

  createAgentRun(
    projectId: string,
    agentId: string,
    featureId: string | null,
  ): AgentRun {
    const now = new Date().toISOString();
    const run: AgentRun = {
      id: uuid(),
      projectId,
      featureId,
      agentId,
      status: "queued",
      startedAt: now,
      completedAt: null,
      tokenInput: 0,
      tokenOutput: 0,
      changeSummary: null,
      filesChanged: [],
      verdict: null,
      score: null,
      findings: [],
      error: null,
    };

    this.db
      .prepare(
        `INSERT INTO agent_runs (id, project_id, feature_id, agent_id, status, started_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(run.id, run.projectId, run.featureId, run.agentId, run.status, run.startedAt);

    return run;
  }

  completeAgentRun(
    id: string,
    updates: {
      status: AgentStatus;
      tokenInput?: number;
      tokenOutput?: number;
      changeSummary?: string;
      filesChanged?: string[];
      verdict?: "pass" | "fail";
      score?: number;
      findings?: Finding[];
      error?: string;
    },
  ): void {
    this.db
      .prepare(
        `UPDATE agent_runs SET
          status = ?, completed_at = ?,
          token_input = COALESCE(?, token_input),
          token_output = COALESCE(?, token_output),
          change_summary = COALESCE(?, change_summary),
          files_changed_json = COALESCE(?, files_changed_json),
          verdict = COALESCE(?, verdict),
          score = COALESCE(?, score),
          findings_json = COALESCE(?, findings_json),
          error = COALESCE(?, error)
         WHERE id = ?`,
      )
      .run(
        updates.status,
        new Date().toISOString(),
        updates.tokenInput ?? null,
        updates.tokenOutput ?? null,
        updates.changeSummary ?? null,
        updates.filesChanged ? JSON.stringify(updates.filesChanged) : null,
        updates.verdict ?? null,
        updates.score ?? null,
        updates.findings ? JSON.stringify(updates.findings) : null,
        updates.error ?? null,
        id,
      );
  }

  // ════════════════════════════════════
  // Activities
  // ════════════════════════════════════

  addActivity(
    projectId: string,
    agentId: string,
    eventType: ActivityEventType,
    message: string,
    details?: string,
    featureId?: string,
  ): ActivityEntry {
    const entry: ActivityEntry = {
      id: uuid(),
      projectId,
      timestamp: new Date().toISOString(),
      agentId,
      eventType,
      message,
      details: details ?? null,
      featureId: featureId ?? null,
    };

    this.db
      .prepare(
        `INSERT INTO activities (id, project_id, timestamp, agent_id, event_type, message, details, feature_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.projectId,
        entry.timestamp,
        entry.agentId,
        entry.eventType,
        entry.message,
        entry.details,
        entry.featureId,
      );

    return entry;
  }

  getActivities(
    projectId: string,
    limit: number = 100,
    offset: number = 0,
  ): ActivityEntry[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM activities WHERE project_id = ?
         ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      )
      .all(projectId, limit, offset) as Record<string, unknown>[];

    return rows.map((r) => ({
      id: r.id as string,
      projectId: r.project_id as string,
      timestamp: r.timestamp as string,
      agentId: r.agent_id as string,
      eventType: r.event_type as ActivityEventType,
      message: r.message as string,
      details: (r.details as string) ?? null,
      featureId: (r.feature_id as string) ?? null,
    }));
  }

  // ════════════════════════════════════
  // Sessions
  // ════════════════════════════════════

  createSession(projectId: string): Session {
    const session: Session = {
      id: uuid(),
      projectId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      summary: null,
    };

    this.db
      .prepare(
        `INSERT INTO sessions (id, project_id, started_at)
         VALUES (?, ?, ?)`,
      )
      .run(session.id, session.projectId, session.startedAt);

    return session;
  }

  endSession(id: string, summary: string): void {
    this.db
      .prepare("UPDATE sessions SET ended_at = ?, summary = ? WHERE id = ?")
      .run(new Date().toISOString(), summary, id);
  }

  /** 프로젝트의 마지막 세션 요약 가져오기 */
  getLastSessionSummary(projectId: string): string | null {
    const row = this.db
      .prepare(
        `SELECT summary FROM sessions
         WHERE project_id = ? AND summary IS NOT NULL
         ORDER BY started_at DESC LIMIT 1`,
      )
      .get(projectId) as { summary: string } | undefined;

    return row?.summary ?? null;
  }

  /** 프로젝트 삭제 (CASCADE로 관련 데이터 모두 삭제) */
  deleteProject(id: string): void {
    this.db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  }

  // ════════════════════════════════════
  // Chat Messages
  // ════════════════════════════════════

  addChatMessage(
    projectId: string,
    role: "user" | "assistant",
    content: string,
    stepId?: string,
  ): ChatMessage {
    const msg: ChatMessage = {
      id: uuid(),
      projectId,
      role,
      content,
      timestamp: new Date().toISOString(),
      stepId,
    };

    this.db
      .prepare(
        `INSERT INTO chat_messages (id, project_id, role, content, timestamp, step_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(msg.id, msg.projectId, msg.role, msg.content, msg.timestamp, msg.stepId ?? null);

    return msg;
  }

  getChatMessages(projectId: string, limit: number = 100, offset: number = 0, stepId?: string): ChatMessage[] {
    const query = stepId
      ? `SELECT * FROM chat_messages WHERE project_id = ? AND step_id = ?
         ORDER BY timestamp ASC LIMIT ? OFFSET ?`
      : `SELECT * FROM chat_messages WHERE project_id = ?
         ORDER BY timestamp ASC LIMIT ? OFFSET ?`;

    const params = stepId
      ? [projectId, stepId, limit, offset]
      : [projectId, limit, offset];

    const rows = this.db.prepare(query).all(...params) as Record<string, unknown>[];

    return rows.map((r) => ({
      id: r.id as string,
      projectId: r.project_id as string,
      role: r.role as ChatMessage["role"],
      content: r.content as string,
      timestamp: r.timestamp as string,
      stepId: (r.step_id as string) ?? undefined,
    }));
  }

  // ════════════════════════════════════
  // Phase State
  // ════════════════════════════════════

  updateProjectPhaseState(projectId: string, phaseState: unknown): void {
    this.db
      .prepare("UPDATE projects SET phase_state_json = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(phaseState), new Date().toISOString(), projectId);
  }

  getProjectPhaseState(projectId: string): unknown | null {
    const row = this.db
      .prepare("SELECT phase_state_json FROM projects WHERE id = ?")
      .get(projectId) as { phase_state_json: string | null } | undefined;

    if (!row?.phase_state_json) return null;
    return JSON.parse(row.phase_state_json);
  }

  // ════════════════════════════════════
  // Agent Learnings
  // ════════════════════════════════════

  addLearning(
    projectId: string,
    agentId: string,
    pattern: string,
    lesson: string,
    source: string,
  ): { id: string } {
    const id = uuid();
    this.db
      .prepare(
        `INSERT INTO agent_learnings (id, project_id, agent_id, pattern, lesson, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, projectId, agentId, pattern, lesson, source, new Date().toISOString());
    return { id };
  }

  getLearnings(projectId: string, agentId?: string): { id: string; agentId: string; pattern: string; lesson: string; source: string; createdAt: string }[] {
    const query = agentId
      ? "SELECT * FROM agent_learnings WHERE project_id = ? AND agent_id = ? ORDER BY created_at DESC"
      : "SELECT * FROM agent_learnings WHERE project_id = ? ORDER BY created_at DESC";
    const params = agentId ? [projectId, agentId] : [projectId];

    const rows = this.db.prepare(query).all(...params) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: r.id as string,
      agentId: r.agent_id as string,
      pattern: r.pattern as string,
      lesson: r.lesson as string,
      source: r.source as string,
      createdAt: r.created_at as string,
    }));
  }

  // ════════════════════════════════════
  // Project Skills (auto-detected patterns)
  // ════════════════════════════════════

  addSkill(
    projectId: string,
    name: string,
    description: string,
    pattern: string,
    template: string,
  ): { id: string } {
    const id = uuid();
    this.db
      .prepare(
        `INSERT INTO project_skills (id, project_id, name, description, pattern, template, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, projectId, name, description, pattern, template, new Date().toISOString());
    return { id };
  }

  getSkills(projectId: string): { id: string; name: string; description: string; pattern: string; template: string; usageCount: number }[] {
    const rows = this.db
      .prepare("SELECT * FROM project_skills WHERE project_id = ? ORDER BY usage_count DESC")
      .all(projectId) as Record<string, unknown>[];

    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      description: r.description as string,
      pattern: r.pattern as string,
      template: r.template as string,
      usageCount: r.usage_count as number,
    }));
  }

  incrementSkillUsage(skillId: string): void {
    this.db.prepare("UPDATE project_skills SET usage_count = usage_count + 1 WHERE id = ?").run(skillId);
  }

  deleteSkill(skillId: string): void {
    this.db.prepare("DELETE FROM project_skills WHERE id = ?").run(skillId);
  }

  /** 기본 스킬 시드 (프로젝트 생성 시 호출) */
  seedDefaultSkills(projectId: string, skillsDir: string): void {
    const existing = this.getSkills(projectId);
    if (existing.length > 0) return;

    try {
      const fs = require("fs");
      const path = require("path");
      if (!fs.existsSync(skillsDir)) return;

      for (const file of fs.readdirSync(skillsDir)) {
        if (!file.endsWith(".json")) continue;
        const skill = JSON.parse(fs.readFileSync(path.join(skillsDir, file), "utf-8"));
        this.addSkill(projectId, skill.name, skill.description, skill.pattern, skill.template);
      }
    } catch {
      // 스킬 시드 실패는 무시 (앱 동작에 영향 없음)
    }
  }

  /** 가장 최근에 업데이트된 프로젝트 가져오기 */
  getLastProject(): Project | null {
    const row = this.db
      .prepare("SELECT * FROM projects ORDER BY updated_at DESC LIMIT 1")
      .get() as Record<string, unknown> | undefined;

    if (!row) return null;
    return this.rowToProject(row);
  }

  // ════════════════════════════════════
  // Schedule (일정)
  // ════════════════════════════════════

  updateFeatureSchedule(
    featureId: string,
    schedule: {
      estimatedStart?: string | null;
      estimatedEnd?: string | null;
      actualStart?: string | null;
      actualEnd?: string | null;
      assignedAgent?: string | null;
      priority?: number;
    },
  ): void {
    const sets: string[] = [];
    const vals: unknown[] = [];

    if (schedule.estimatedStart !== undefined) { sets.push("estimated_start = ?"); vals.push(schedule.estimatedStart); }
    if (schedule.estimatedEnd !== undefined) { sets.push("estimated_end = ?"); vals.push(schedule.estimatedEnd); }
    if (schedule.actualStart !== undefined) { sets.push("actual_start = ?"); vals.push(schedule.actualStart); }
    if (schedule.actualEnd !== undefined) { sets.push("actual_end = ?"); vals.push(schedule.actualEnd); }
    if (schedule.assignedAgent !== undefined) { sets.push("assigned_agent = ?"); vals.push(schedule.assignedAgent); }
    if (schedule.priority !== undefined) { sets.push("priority = ?"); vals.push(schedule.priority); }

    if (sets.length === 0) return;

    sets.push("updated_at = ?");
    vals.push(new Date().toISOString());
    vals.push(featureId);

    this.db.prepare(`UPDATE features SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }

  /** 전체 프로젝트의 일정 아이템 가져오기 (캘린더/간트 뷰용) */
  getAllScheduleItems(): ScheduleItem[] {
    const rows = this.db
      .prepare(
        `SELECT f.*, p.name as project_name
         FROM features f
         JOIN projects p ON f.project_id = p.id
         WHERE f.estimated_start IS NOT NULL
         ORDER BY f.estimated_start ASC`,
      )
      .all() as Record<string, unknown>[];

    return rows.map((r) => ({
      id: r.id as string,
      featureId: r.id as string,
      projectId: r.project_id as string,
      projectName: r.project_name as string,
      featureName: r.name as string,
      estimatedStart: r.estimated_start as string,
      estimatedEnd: r.estimated_end as string,
      actualStart: (r.actual_start as string) ?? null,
      actualEnd: (r.actual_end as string) ?? null,
      status: r.status as FeatureStatus,
      assignedAgent: (r.assigned_agent as string) ?? null,
      priority: (r.priority as number) ?? 0,
    }));
  }

  /** 특정 프로젝트의 일정 아이템 */
  getProjectScheduleItems(projectId: string): ScheduleItem[] {
    const rows = this.db
      .prepare(
        `SELECT f.*, p.name as project_name
         FROM features f
         JOIN projects p ON f.project_id = p.id
         WHERE f.project_id = ? AND f.estimated_start IS NOT NULL
         ORDER BY f.estimated_start ASC`,
      )
      .all(projectId) as Record<string, unknown>[];

    return rows.map((r) => ({
      id: r.id as string,
      featureId: r.id as string,
      projectId: r.project_id as string,
      projectName: r.project_name as string,
      featureName: r.name as string,
      estimatedStart: r.estimated_start as string,
      estimatedEnd: r.estimated_end as string,
      actualStart: (r.actual_start as string) ?? null,
      actualEnd: (r.actual_end as string) ?? null,
      status: r.status as FeatureStatus,
      assignedAgent: (r.assigned_agent as string) ?? null,
      priority: (r.priority as number) ?? 0,
    }));
  }

  /** PM이 일정을 일괄 설정 (Planner 결과에서 자동 호출) */
  bulkSetFeatureSchedule(
    items: { featureId: string; estimatedStart: string; estimatedEnd: string; assignedAgent?: string; priority?: number }[],
  ): void {
    const stmt = this.db.prepare(
      `UPDATE features SET estimated_start = ?, estimated_end = ?, assigned_agent = COALESCE(?, assigned_agent), priority = COALESCE(?, priority), updated_at = ? WHERE id = ?`,
    );

    const now = new Date().toISOString();
    const transaction = this.db.transaction(() => {
      for (const item of items) {
        stmt.run(item.estimatedStart, item.estimatedEnd, item.assignedAgent ?? null, item.priority ?? null, now, item.featureId);
      }
    });
    transaction();
  }
}
