import path from "path";
import { app } from "electron";
import fs from "fs";

const SCHEMA_VERSION = 100; // v3: 100부터 시작

// better-sqlite3는 네이티브 모듈이라 동적 require로 로드해야
// electron-vite 번들링에서 올바르게 외부화됨
function loadSqlite(): typeof import("better-sqlite3").default {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("better-sqlite3");
}

function getDataDir(): string {
  const dir = path.join(app.getPath("userData"), "harness_data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getDbPath(): string {
  return path.join(getDataDir(), "db.sqlite");
}

export function createDatabase() {
  const Database = loadSqlite();
  const db = new Database(getDbPath());

  // WAL mode for better concurrent read performance
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Initialize schema
  initSchema(db);

  return db;
}

function initSchema(db: ReturnType<typeof createDatabase>): void {
  const version = db.pragma("user_version", { simple: true }) as number;

  // v3 마이그레이션: 기존 테이블 드롭하고 새 스키마로
  if (version < SCHEMA_VERSION) {
    db.exec(`
      -- 기존 v2 테이블 삭제 (있으면)
      DROP TABLE IF EXISTS project_plans;
      DROP TABLE IF EXISTS project_skills;
      DROP TABLE IF EXISTS agent_learnings;
      DROP TABLE IF EXISTS chat_messages;
      DROP TABLE IF EXISTS activities;
      DROP TABLE IF EXISTS agent_runs;
      DROP TABLE IF EXISTS features;
      DROP TABLE IF EXISTS sessions;

      -- v3 테이블 삭제 (재생성)
      DROP TABLE IF EXISTS task_logs;
      DROP TABLE IF EXISTS validations;
      DROP TABLE IF EXISTS handoffs;
      DROP TABLE IF EXISTS tasks;
      DROP TABLE IF EXISTS sprints;
      DROP TABLE IF EXISTS milestones;
      DROP TABLE IF EXISTS projects;

      -- === v3 스키마 ===

      -- 프로젝트
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        spec_card_json TEXT,
        status TEXT DEFAULT 'planning',
        working_dir TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- 마일스톤
      CREATE TABLE milestones (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        order_index INTEGER NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        validation_strategy TEXT DEFAULT '',
        created_at TEXT,
        completed_at TEXT
      );
      CREATE INDEX idx_milestones_project ON milestones(project_id, order_index);

      -- 스프린트
      CREATE TABLE sprints (
        id TEXT PRIMARY KEY,
        milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        order_index INTEGER NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        validation_strategy TEXT DEFAULT '',
        dependencies_json TEXT DEFAULT '[]',
        created_at TEXT,
        completed_at TEXT
      );
      CREATE INDEX idx_sprints_milestone ON sprints(milestone_id, order_index);
      CREATE INDEX idx_sprints_project ON sprints(project_id);

      -- 태스크
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        plan TEXT DEFAULT '',
        order_index INTEGER NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        difficulty TEXT DEFAULT 'medium',
        model TEXT DEFAULT 'sonnet',
        execution_mode TEXT DEFAULT 'single',
        harness_id TEXT,
        dependencies_json TEXT DEFAULT '[]',
        validation_json TEXT DEFAULT '{"auto":["build","typecheck"]}',
        estimated_files_json TEXT DEFAULT '[]',
        actual_files_json TEXT DEFAULT '[]',
        cost REAL DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        retry_count INTEGER DEFAULT 0,
        created_at TEXT,
        started_at TEXT,
        completed_at TEXT
      );
      CREATE INDEX idx_tasks_sprint ON tasks(sprint_id, order_index);
      CREATE INDEX idx_tasks_project ON tasks(project_id);
      CREATE INDEX idx_tasks_status ON tasks(project_id, status);

      -- 핸드오프
      CREATE TABLE handoffs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        summary TEXT DEFAULT '',
        files_changed_json TEXT DEFAULT '[]',
        design_decisions_json TEXT DEFAULT '[]',
        known_issues_json TEXT DEFAULT '[]',
        next_task_notes TEXT,
        created_at TEXT
      );
      CREATE INDEX idx_handoffs_project ON handoffs(project_id);

      -- 검증 결과
      CREATE TABLE validations (
        id TEXT PRIMARY KEY,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        passed INTEGER DEFAULT 0,
        results_json TEXT DEFAULT '[]',
        validated_by TEXT DEFAULT 'auto',
        created_at TEXT
      );
      CREATE INDEX idx_validations_target ON validations(target_type, target_id);

      -- 실행 로그
      CREATE TABLE task_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        message TEXT DEFAULT '',
        timestamp TEXT NOT NULL
      );
      CREATE INDEX idx_task_logs_task ON task_logs(task_id, timestamp);
    `);

    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }
}

export { getDataDir };
