import type { Queryable } from "../queue/queue";
import { claimToolLoopLock, completeToolLoopLock, ToolLoopLockError, type ToolLoopLock } from "./session-service";

type LockRow = ToolLoopLock & { version: number; active_tool_call_id: string | null; lock_id: string; session_id: string; execution_epoch: number; iteration: number; max_iterations: number; expires_at: string | Date };
function map(row: LockRow): ToolLoopLock { return { lock_id: row.lock_id, session_id: row.session_id, execution_epoch: row.execution_epoch, iteration: row.iteration, max_iterations: row.max_iterations, expires_at: row.expires_at instanceof Date ? row.expires_at.toISOString() : new Date(row.expires_at).toISOString(), ...(row.active_tool_call_id == null ? {} : { active_tool_call_id: row.active_tool_call_id }) }; }
export class PostgresToolLoopLockStore {
  constructor(private readonly db: Queryable, private readonly lockId: string, private readonly table = "hermes_tool_loop_locks") { if (!/^\w+$/.test(table)) throw new Error("tool_loop_table_invalid"); }
  async claim(toolCallId: string, executionEpoch: number, now = new Date()): Promise<ToolLoopLock> {
    const result = await this.db.query<LockRow>(`UPDATE ${this.table} SET iteration = iteration + 1, active_tool_call_id = $1, version = version + 1 WHERE lock_id = $2 AND execution_epoch = $3 AND active_tool_call_id IS NULL AND expires_at > $4 AND iteration < max_iterations RETURNING *`, [toolCallId, this.lockId, executionEpoch, now]);
    if (result.rows[0]) return map(result.rows[0]);
    const current = await this.db.query<LockRow>(`SELECT * FROM ${this.table} WHERE lock_id = $1`, [this.lockId]);
    if (!current.rows[0]) throw new ToolLoopLockError("TOOL_LOOP_BUSY", "tool_loop_lock_missing");
    const lock = map(current.rows[0]);
    if (lock.execution_epoch !== executionEpoch) throw new ToolLoopLockError("INVALID_EXECUTION_EPOCH", "tool_loop_execution_epoch_mismatch");
    if (Date.parse(lock.expires_at) <= now.getTime()) throw new ToolLoopLockError("LOCK_EXPIRED", "tool_loop_lock_expired");
    if (lock.active_tool_call_id !== undefined) throw new ToolLoopLockError("TOOL_LOOP_BUSY", "tool_loop_call_already_active");
    throw new ToolLoopLockError("MAX_ITERATIONS_EXCEEDED", "tool_loop_max_iterations");
  }
  async complete(toolCallId: string, executionEpoch: number, now = new Date()): Promise<ToolLoopLock> {
    const result = await this.db.query<LockRow>(`UPDATE ${this.table} SET active_tool_call_id = NULL, version = version + 1 WHERE lock_id = $1 AND execution_epoch = $2 AND active_tool_call_id = $3 AND expires_at > $4 RETURNING *`, [this.lockId, executionEpoch, toolCallId, now]);
    if (result.rows[0]) return map(result.rows[0]);
    throw new ToolLoopLockError("TOOL_CALL_MISMATCH", "tool_loop_call_not_owned");
  }
}
