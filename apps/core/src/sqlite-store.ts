import { DatabaseSync } from "node:sqlite";
import type { ExecutionResult } from "@lumenva/operating-core";

export type CoreTask = {
  id: string;
  type: string;
  status: "QUEUED" | "RECOVERING" | "COMPLETED" | "FAILED" | "CANCELLED" | "BLOCKED_OWNER";
  idempotencyKey: string;
  traceId: string;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
};

export type CoreEvent = {
  sequence?: number;
  id: string;
  type: string;
  taskId: string | null;
  traceId: string;
  payload: unknown;
  createdAt?: string;
};

export type ExecutionRecord = {
  id: string;
  taskId: string;
  traceId: string;
  provider: string;
  status: ExecutionResult["status"];
  result: ExecutionResult;
  createdAt: string;
};

type TaskRow = {
  id: string;
  type: string;
  status: CoreTask["status"];
  idempotency_key: string;
  trace_id: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
};
type EventRow = {
  sequence: number;
  id: string;
  type: string;
  task_id: string | null;
  trace_id: string;
  payload_json: string;
  created_at: string;
};
type ExecutionRow = {
  id: string;
  task_id: string;
  trace_id: string;
  provider: string;
  status: ExecutionRecord["status"];
  result_json: string;
  created_at: string;
};

export class SqliteStore {
  private database: DatabaseSync | null = null;

  constructor(private readonly filePath: string) {}

  open(): void {
    if (this.database) return;
    this.database = new DatabaseSync(this.filePath);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        trace_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        task_id TEXT,
        trace_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        trace_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        status TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    this.database.prepare(
      "INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)",
    ).run(1, new Date().toISOString());
    this.database.prepare(
      "INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)",
    ).run(2, new Date().toISOString());
  }

  close(): void {
    this.database?.close();
    this.database = null;
  }

  schemaVersion(): number {
    return Number(this.db().prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get()?.version ?? 0);
  }

  createTask(input: {
    id: string;
    type: string;
    idempotencyKey: string;
    traceId: string;
    payload: unknown;
  }): CoreTask {
    const now = new Date().toISOString();
    this.db().prepare(`
      INSERT OR IGNORE INTO tasks
        (id, type, status, idempotency_key, trace_id, payload_json, created_at, updated_at)
      VALUES (?, ?, 'QUEUED', ?, ?, ?, ?, ?)
    `).run(input.id, input.type, input.idempotencyKey, input.traceId, JSON.stringify(input.payload), now, now);
    return this.getTaskByIdempotencyKey(input.idempotencyKey) as CoreTask;
  }

  getTaskByIdempotencyKey(key: string): CoreTask | null {
    return this.getTaskByIdempotencyKeyInternal(key);
  }

  getTask(id: string): CoreTask | null {
    const row = this.db().prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
    return row ? mapTask(row) : null;
  }

  listNonTerminalTasks(): CoreTask[] {
    const rows = this.db().prepare(
      "SELECT * FROM tasks WHERE status NOT IN ('COMPLETED', 'FAILED', 'CANCELLED', 'BLOCKED_OWNER') ORDER BY created_at ASC",
    ).all() as unknown as TaskRow[];
    return rows.map(mapTask);
  }

  updateTaskStatus(id: string, status: CoreTask["status"]): CoreTask {
    this.db().prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), id);
    const task = this.getTask(id);
    if (!task) throw new Error(`task not found: ${id}`);
    return task;
  }

  appendEvent(input: CoreEvent): CoreEvent {
    const createdAt = input.createdAt ?? new Date().toISOString();
    this.db().prepare(`
      INSERT OR IGNORE INTO events (id, type, task_id, trace_id, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(input.id, input.type, input.taskId, input.traceId, JSON.stringify(input.payload), createdAt);
    const row = this.db().prepare("SELECT * FROM events WHERE id = ?").get(input.id) as EventRow;
    return mapEvent(row);
  }

  recordExecution(input: Pick<ExecutionRecord, "id" | "taskId" | "traceId" | "provider" | "result"> & { createdAt?: string }): ExecutionRecord {
    const createdAt = input.createdAt ?? new Date().toISOString();
    this.db().prepare(`
      INSERT OR REPLACE INTO executions
        (id, task_id, trace_id, provider, status, result_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(input.id, input.taskId, input.traceId, input.provider, input.result.status, JSON.stringify(input.result), createdAt);
    return this.getExecution(input.id) as ExecutionRecord;
  }

  getExecution(id: string): ExecutionRecord | null {
    const row = this.db().prepare("SELECT * FROM executions WHERE id = ?").get(id) as ExecutionRow | undefined;
    return row ? mapExecution(row) : null;
  }

  listExecutions(): ExecutionRecord[] {
    const rows = this.db().prepare("SELECT * FROM executions ORDER BY created_at ASC, id ASC").all() as unknown as ExecutionRow[];
    return rows.map(mapExecution);
  }

  replayEvents(): CoreEvent[] {
    const rows = this.db().prepare("SELECT * FROM events ORDER BY sequence ASC").all() as unknown as EventRow[];
    return rows.map(mapEvent);
  }

  private getTaskByIdempotencyKeyInternal(key: string): CoreTask | null {
    const row = this.db().prepare("SELECT * FROM tasks WHERE idempotency_key = ?").get(key) as TaskRow | undefined;
    return row ? mapTask(row) : null;
  }

  private db(): DatabaseSync {
    if (!this.database) throw new Error("SqliteStore is not open");
    return this.database;
  }
}

function mapTask(row: TaskRow): CoreTask {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    traceId: row.trace_id,
    payload: JSON.parse(row.payload_json) as unknown,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: EventRow): CoreEvent {
  return {
    sequence: row.sequence,
    id: row.id,
    type: row.type,
    taskId: row.task_id,
    traceId: row.trace_id,
    payload: JSON.parse(row.payload_json) as unknown,
    createdAt: row.created_at,
  };
}

function mapExecution(row: ExecutionRow): ExecutionRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    traceId: row.trace_id,
    provider: row.provider,
    status: row.status,
    result: JSON.parse(row.result_json) as ExecutionResult,
    createdAt: row.created_at,
  };
}
