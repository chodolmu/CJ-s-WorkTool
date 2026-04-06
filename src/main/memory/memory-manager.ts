import { v4 as uuid } from "uuid";
import type {
  Project,
  SpecCard,
  Milestone,
  Sprint,
  Task,
  TaskHandoff,
  ValidationResult,
  TaskLog,
  ProjectTree,
  ProjectStats,
  TaskStatus,
} from "@shared/types";

export class MemoryManager {
  constructor(private db: any) {}

  // ════════════════════════════════════
  // Projects
  // ════════════════════════════════════

  createProject(name: string, description: string = "", workingDir: string = ""): Project {
    const now = new Date().toISOString();
    const project: Project = {
      id: uuid(),
      name,
      description,
      specCard: null,
      status: "planning",
      workingDir,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO projects (id, name, description, spec_card_json, status, working_dir, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(project.id, project.name, project.description, null, project.status, project.workingDir, project.createdAt, project.updatedAt);

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
      .prepare("UPDATE projects SET spec_card_json = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(specCard), new Date().toISOString(), id);
  }

  deleteProject(id: string): void {
    this.db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  }

  getLastProject(): Project | null {
    const row = this.db
      .prepare("SELECT * FROM projects ORDER BY updated_at DESC LIMIT 1")
      .get() as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToProject(row);
  }

  private rowToProject(row: Record<string, unknown>): Project {
    return {
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string) ?? "",
      specCard: row.spec_card_json ? JSON.parse(row.spec_card_json as string) : null,
      status: row.status as Project["status"],
      workingDir: (row.working_dir as string) ?? "",
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  // ════════════════════════════════════
  // Milestones
  // ════════════════════════════════════

  createMilestone(data: Omit<Milestone, "sprints">): void {
    this.db
      .prepare(
        `INSERT INTO milestones (id, project_id, name, description, order_index, status, validation_strategy, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(data.id, data.projectId, data.name, data.description, data.orderIndex, data.status, data.validationStrategy, new Date().toISOString());
  }

  getMilestones(projectId: string): Milestone[] {
    const rows = this.db
      .prepare("SELECT * FROM milestones WHERE project_id = ? ORDER BY order_index")
      .all(projectId) as Record<string, unknown>[];
    return rows.map((r) => this.rowToMilestone(r));
  }

  updateMilestoneStatus(id: string, status: string): void {
    const completedAt = status === "completed" ? new Date().toISOString() : null;
    this.db
      .prepare("UPDATE milestones SET status = ?, completed_at = COALESCE(?, completed_at) WHERE id = ?")
      .run(status, completedAt, id);
  }

  private rowToMilestone(r: Record<string, unknown>): Milestone {
    return {
      id: r.id as string,
      projectId: r.project_id as string,
      name: r.name as string,
      description: (r.description as string) ?? "",
      orderIndex: r.order_index as number,
      status: r.status as Milestone["status"],
      validationStrategy: (r.validation_strategy as string) ?? "",
      createdAt: (r.created_at as string) ?? undefined,
      completedAt: (r.completed_at as string) ?? undefined,
    };
  }

  // ════════════════════════════════════
  // Sprints
  // ════════════════════════════════════

  createSprint(data: Omit<Sprint, "tasks">): void {
    this.db
      .prepare(
        `INSERT INTO sprints (id, milestone_id, project_id, name, description, order_index, status, validation_strategy, dependencies_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(data.id, data.milestoneId, data.projectId, data.name, data.description, data.orderIndex, data.status, data.validationStrategy, JSON.stringify(data.dependencies), new Date().toISOString());
  }

  getSprints(milestoneId: string): Sprint[] {
    const rows = this.db
      .prepare("SELECT * FROM sprints WHERE milestone_id = ? ORDER BY order_index")
      .all(milestoneId) as Record<string, unknown>[];
    return rows.map((r) => this.rowToSprint(r));
  }

  getSprintsByProject(projectId: string): Sprint[] {
    const rows = this.db
      .prepare("SELECT * FROM sprints WHERE project_id = ? ORDER BY order_index")
      .all(projectId) as Record<string, unknown>[];
    return rows.map((r) => this.rowToSprint(r));
  }

  updateSprintStatus(id: string, status: string): void {
    const completedAt = status === "completed" ? new Date().toISOString() : null;
    this.db
      .prepare("UPDATE sprints SET status = ?, completed_at = COALESCE(?, completed_at) WHERE id = ?")
      .run(status, completedAt, id);
  }

  private rowToSprint(r: Record<string, unknown>): Sprint {
    return {
      id: r.id as string,
      milestoneId: r.milestone_id as string,
      projectId: r.project_id as string,
      name: r.name as string,
      description: (r.description as string) ?? "",
      orderIndex: r.order_index as number,
      status: r.status as Sprint["status"],
      validationStrategy: (r.validation_strategy as string) ?? "",
      dependencies: JSON.parse((r.dependencies_json as string) ?? "[]"),
      createdAt: (r.created_at as string) ?? undefined,
      completedAt: (r.completed_at as string) ?? undefined,
    };
  }

  // ════════════════════════════════════
  // Tasks
  // ════════════════════════════════════

  createTask(data: Omit<Task, "actualFiles" | "cost" | "durationMs" | "retryCount">): void {
    this.db
      .prepare(
        `INSERT INTO tasks (id, sprint_id, project_id, name, description, plan, order_index, status, difficulty, model, execution_mode, harness_id, dependencies_json, validation_json, estimated_files_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.id, data.sprintId, data.projectId, data.name, data.description, data.plan,
        data.orderIndex, data.status, data.difficulty, data.model, data.executionMode,
        data.harnessId ?? null, JSON.stringify(data.dependencies),
        JSON.stringify(data.validation), JSON.stringify(data.estimatedFiles),
        new Date().toISOString(),
      );
  }

  getTasks(sprintId: string): Task[] {
    const rows = this.db
      .prepare("SELECT * FROM tasks WHERE sprint_id = ? ORDER BY order_index")
      .all(sprintId) as Record<string, unknown>[];
    return rows.map((r) => this.rowToTask(r));
  }

  getTasksByProject(projectId: string): Task[] {
    const rows = this.db
      .prepare("SELECT * FROM tasks WHERE project_id = ? ORDER BY order_index")
      .all(projectId) as Record<string, unknown>[];
    return rows.map((r) => this.rowToTask(r));
  }

  getTask(id: string): Task | null {
    const row = this.db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToTask(row);
  }

  updateTaskStatus(id: string, status: TaskStatus): void {
    const now = new Date().toISOString();
    const updates: Record<string, string | null> = { status };
    if (status === "running") updates.started_at = now;
    if (status === "completed" || status === "failed") updates.completed_at = now;

    const sets = Object.keys(updates).map(k => `${k} = ?`).join(", ");
    const vals = Object.values(updates);
    vals.push(id);
    this.db.prepare(`UPDATE tasks SET ${sets} WHERE id = ?`).run(...vals);
  }

  updateTaskCost(id: string, cost: number, durationMs: number): void {
    this.db.prepare("UPDATE tasks SET cost = ?, duration_ms = ? WHERE id = ?").run(cost, durationMs, id);
  }

  updateTaskActualFiles(id: string, files: string[]): void {
    this.db.prepare("UPDATE tasks SET actual_files_json = ? WHERE id = ?").run(JSON.stringify(files), id);
  }

  incrementTaskRetry(id: string): void {
    this.db.prepare("UPDATE tasks SET retry_count = retry_count + 1 WHERE id = ?").run(id);
  }

  updateTask(id: string, changes: Partial<Pick<Task, "name" | "description" | "plan" | "difficulty" | "model" | "orderIndex">>): void {
    const sets: string[] = [];
    const vals: unknown[] = [];

    if (changes.name !== undefined) { sets.push("name = ?"); vals.push(changes.name); }
    if (changes.description !== undefined) { sets.push("description = ?"); vals.push(changes.description); }
    if (changes.plan !== undefined) { sets.push("plan = ?"); vals.push(changes.plan); }
    if (changes.difficulty !== undefined) { sets.push("difficulty = ?"); vals.push(changes.difficulty); }
    if (changes.model !== undefined) { sets.push("model = ?"); vals.push(changes.model); }
    if (changes.orderIndex !== undefined) { sets.push("order_index = ?"); vals.push(changes.orderIndex); }

    if (sets.length === 0) return;
    vals.push(id);
    this.db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }

  deleteTask(id: string): void {
    this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  }

  getNextPendingTask(projectId: string): Task | null {
    const row = this.db
      .prepare(
        `SELECT * FROM tasks WHERE project_id = ? AND status = 'pending'
         ORDER BY order_index LIMIT 1`,
      )
      .get(projectId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToTask(row);
  }

  private rowToTask(r: Record<string, unknown>): Task {
    return {
      id: r.id as string,
      sprintId: r.sprint_id as string,
      projectId: r.project_id as string,
      name: r.name as string,
      description: (r.description as string) ?? "",
      plan: (r.plan as string) ?? "",
      orderIndex: r.order_index as number,
      status: r.status as Task["status"],
      difficulty: r.difficulty as Task["difficulty"],
      model: r.model as Task["model"],
      executionMode: r.execution_mode as Task["executionMode"],
      harnessId: (r.harness_id as string) ?? undefined,
      dependencies: JSON.parse((r.dependencies_json as string) ?? "[]"),
      validation: JSON.parse((r.validation_json as string) ?? '{"auto":[]}'),
      estimatedFiles: JSON.parse((r.estimated_files_json as string) ?? "[]"),
      actualFiles: JSON.parse((r.actual_files_json as string) ?? "[]"),
      cost: (r.cost as number) ?? 0,
      durationMs: (r.duration_ms as number) ?? 0,
      retryCount: (r.retry_count as number) ?? 0,
      createdAt: (r.created_at as string) ?? undefined,
      startedAt: (r.started_at as string) ?? undefined,
      completedAt: (r.completed_at as string) ?? undefined,
    };
  }

  // ════════════════════════════════════
  // Handoffs
  // ════════════════════════════════════

  createHandoff(data: TaskHandoff): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO handoffs (id, task_id, project_id, summary, files_changed_json, design_decisions_json, known_issues_json, next_task_notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.id, data.taskId, data.projectId, data.summary,
        JSON.stringify(data.filesChanged), JSON.stringify(data.designDecisions),
        JSON.stringify(data.knownIssues), data.nextTaskNotes ?? null,
        new Date().toISOString(),
      );
  }

  getHandoff(taskId: string): TaskHandoff | null {
    const row = this.db
      .prepare("SELECT * FROM handoffs WHERE task_id = ?")
      .get(taskId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      taskId: row.task_id as string,
      projectId: row.project_id as string,
      summary: (row.summary as string) ?? "",
      filesChanged: JSON.parse((row.files_changed_json as string) ?? "[]"),
      designDecisions: JSON.parse((row.design_decisions_json as string) ?? "[]"),
      knownIssues: JSON.parse((row.known_issues_json as string) ?? "[]"),
      nextTaskNotes: (row.next_task_notes as string) ?? undefined,
      createdAt: (row.created_at as string) ?? undefined,
    };
  }

  getHandoffsByProject(projectId: string): TaskHandoff[] {
    const rows = this.db
      .prepare("SELECT * FROM handoffs WHERE project_id = ? ORDER BY created_at")
      .all(projectId) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: r.id as string,
      taskId: r.task_id as string,
      projectId: r.project_id as string,
      summary: (r.summary as string) ?? "",
      filesChanged: JSON.parse((r.files_changed_json as string) ?? "[]"),
      designDecisions: JSON.parse((r.design_decisions_json as string) ?? "[]"),
      knownIssues: JSON.parse((r.known_issues_json as string) ?? "[]"),
      nextTaskNotes: (r.next_task_notes as string) ?? undefined,
      createdAt: (r.created_at as string) ?? undefined,
    }));
  }

  // ════════════════════════════════════
  // Validations
  // ════════════════════════════════════

  createValidation(data: ValidationResult): void {
    this.db
      .prepare(
        `INSERT INTO validations (id, target_type, target_id, passed, results_json, validated_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(data.id, data.targetType, data.targetId, data.passed ? 1 : 0, JSON.stringify(data.results), data.validatedBy, new Date().toISOString());
  }

  getValidation(targetType: string, targetId: string): ValidationResult | null {
    const row = this.db
      .prepare("SELECT * FROM validations WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(targetType, targetId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      targetType: row.target_type as ValidationResult["targetType"],
      targetId: row.target_id as string,
      passed: !!(row.passed as number),
      results: JSON.parse((row.results_json as string) ?? "[]"),
      validatedBy: row.validated_by as ValidationResult["validatedBy"],
      createdAt: (row.created_at as string) ?? undefined,
    };
  }

  // ════════════════════════════════════
  // Task Logs
  // ════════════════════════════════════

  addTaskLog(taskId: string, eventType: string, message: string): void {
    this.db
      .prepare("INSERT INTO task_logs (task_id, event_type, message, timestamp) VALUES (?, ?, ?, ?)")
      .run(taskId, eventType, message, new Date().toISOString());
  }

  getTaskLogs(taskId: string): TaskLog[] {
    const rows = this.db
      .prepare("SELECT * FROM task_logs WHERE task_id = ? ORDER BY timestamp")
      .all(taskId) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: r.id as number,
      taskId: r.task_id as string,
      eventType: r.event_type as TaskLog["eventType"],
      message: (r.message as string) ?? "",
      timestamp: r.timestamp as string,
    }));
  }

  // ════════════════════════════════════
  // Project Tree (조회 헬퍼)
  // ════════════════════════════════════

  getProjectTree(projectId: string): ProjectTree | null {
    const project = this.getProject(projectId);
    if (!project) return null;

    const milestones = this.getMilestones(projectId).map((m) => ({
      ...m,
      sprints: this.getSprints(m.id).map((s) => ({
        ...s,
        tasks: this.getTasks(s.id),
      })),
    }));

    return { project, milestones };
  }

  getProjectStats(projectId: string): ProjectStats {
    const tasks = this.getTasksByProject(projectId);
    const totalCost = tasks.reduce((sum, t) => sum + t.cost, 0);
    const completed = tasks.filter((t) => t.status === "completed").length;
    const failed = tasks.filter((t) => t.status === "failed").length;
    const running = tasks.filter((t) => t.status === "running").length;
    const pending = tasks.filter((t) => t.status === "pending" || t.status === "queued").length;

    const costByModel = { haiku: 0, sonnet: 0, opus: 0 };
    for (const t of tasks) {
      if (t.cost > 0) costByModel[t.model] += t.cost;
    }

    return {
      totalTasks: tasks.length,
      completedTasks: completed,
      failedTasks: failed,
      runningTasks: running,
      pendingTasks: pending,
      totalCost,
      costByModel,
      progressPercent: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
    };
  }

  // ════════════════════════════════════
  // Bulk Save (Plan 저장용)
  // ════════════════════════════════════

  savePlan(projectId: string, plan: { milestones: any[] }): void {
    const transaction = this.db.transaction(() => {
      // 기존 데이터 삭제
      this.db.prepare("DELETE FROM tasks WHERE project_id = ?").run(projectId);
      this.db.prepare("DELETE FROM sprints WHERE project_id = ?").run(projectId);
      this.db.prepare("DELETE FROM milestones WHERE project_id = ?").run(projectId);

      for (const m of plan.milestones) {
        this.createMilestone({
          id: m.id,
          projectId,
          name: m.name,
          description: m.description ?? "",
          orderIndex: m.orderIndex ?? 0,
          status: m.status ?? "pending",
          validationStrategy: m.validationStrategy ?? "",
        });

        for (const s of m.sprints ?? []) {
          this.createSprint({
            id: s.id,
            milestoneId: m.id,
            projectId,
            name: s.name,
            description: s.description ?? "",
            orderIndex: s.orderIndex ?? 0,
            status: s.status ?? "pending",
            validationStrategy: s.validationStrategy ?? "",
            dependencies: s.dependencies ?? [],
          });

          for (const t of s.tasks ?? []) {
            this.createTask({
              id: t.id,
              sprintId: s.id,
              projectId,
              name: t.name,
              description: t.description ?? "",
              plan: t.plan ?? "",
              orderIndex: t.orderIndex ?? 0,
              status: t.status ?? "pending",
              difficulty: t.difficulty ?? "medium",
              model: t.model ?? "sonnet",
              executionMode: t.executionMode ?? "single",
              harnessId: t.harnessId,
              dependencies: t.dependencies ?? [],
              validation: t.validation ?? { auto: ["build", "typecheck"] },
              estimatedFiles: t.estimatedFiles ?? [],
            });
          }
        }
      }
    });
    transaction();
  }
}
