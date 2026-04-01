import path from "path";
import { app } from "electron";
import fs from "fs";

const SCHEMA_VERSION = 6;

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

  if (version < 1) {
    db.exec(`
      -- Projects
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        preset_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'discovery',
        spec_card_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Features
      CREATE TABLE IF NOT EXISTS features (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        order_num INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_features_project ON features(project_id);

      -- Agent Runs
      CREATE TABLE IF NOT EXISTS agent_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        feature_id TEXT REFERENCES features(id),
        agent_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        token_input INTEGER DEFAULT 0,
        token_output INTEGER DEFAULT 0,
        change_summary TEXT,
        files_changed_json TEXT,
        verdict TEXT,
        score INTEGER,
        findings_json TEXT,
        error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_agent_runs_project ON agent_runs(project_id);

      -- Activities
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        timestamp TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        feature_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_activities_project_time
        ON activities(project_id, timestamp DESC);

      -- Sessions
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        summary TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
    `);

    db.pragma(`user_version = 1`);
  }

  if (version < 2) {
    db.exec(`
      -- Chat Messages
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_project_time
        ON chat_messages(project_id, timestamp ASC);
    `);

    db.pragma(`user_version = 2`);
  }

  if (version < 3) {
    db.exec(`
      -- Phase state + Agent learnings
      ALTER TABLE projects ADD COLUMN phase_state_json TEXT;

      CREATE TABLE IF NOT EXISTS agent_learnings (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        agent_id TEXT NOT NULL,
        pattern TEXT NOT NULL,
        lesson TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_learnings_project
        ON agent_learnings(project_id, agent_id);

      CREATE TABLE IF NOT EXISTS project_skills (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        pattern TEXT NOT NULL,
        template TEXT NOT NULL,
        usage_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_skills_project
        ON project_skills(project_id);
    `);

    db.pragma(`user_version = 3`);
  }

  if (version < 4) {
    db.exec(`
      ALTER TABLE projects ADD COLUMN working_dir TEXT DEFAULT '';
      ALTER TABLE projects ADD COLUMN agents_json TEXT;
    `);

    db.pragma(`user_version = 4`);
  }

  if (version < 5) {
    db.exec(`
      -- 피처 일정 컬럼 (PM 일정 자동 반영)
      ALTER TABLE features ADD COLUMN estimated_start TEXT;
      ALTER TABLE features ADD COLUMN estimated_end TEXT;
      ALTER TABLE features ADD COLUMN actual_start TEXT;
      ALTER TABLE features ADD COLUMN actual_end TEXT;
      ALTER TABLE features ADD COLUMN assigned_agent TEXT;
      ALTER TABLE features ADD COLUMN priority INTEGER DEFAULT 0;
    `);

    db.pragma(`user_version = 5`);
  }

  if (version < 6) {
    db.exec(`
      -- 프로젝트 계획 문서 자동 관리
      CREATE TABLE IF NOT EXISTS project_plans (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        version INTEGER NOT NULL DEFAULT 1,
        content_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_plans_project ON project_plans(project_id);
    `);

    db.pragma(`user_version = 6`);
  }

  if (version < 7) {
    db.exec(`
      ALTER TABLE chat_messages ADD COLUMN step_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_chat_step ON chat_messages(project_id, step_id, timestamp ASC);
    `);

    db.pragma(`user_version = 7`);
  }
}

export { getDataDir };
