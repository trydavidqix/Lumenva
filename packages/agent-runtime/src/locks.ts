import type { ModelDefinition } from "./model.js";
import { modelKey } from "./model.js";

export interface ModelLock {
  readonly sessionId: string;
  readonly epoch: number;
  readonly model: ModelDefinition;
}

export type ModelResolver = () => ModelDefinition;

export class ModelLockManager {
  private readonly locks = new Map<string, ModelLock>();
  acquire(sessionId: string, epoch: number, resolve: ModelResolver): ModelLock {
    if (!sessionId.trim() || epoch < 1) throw new Error("E_MODEL_LOCK_CONTEXT_INVALID");
    const key = `${sessionId}:${epoch}`;
    const existing = this.locks.get(key);
    if (existing) return existing;
    const lock = { sessionId, epoch, model: resolve() };
    this.locks.set(key, lock);
    return lock;
  }
  get(sessionId: string, epoch: number): ModelLock | undefined {
    return this.locks.get(`${sessionId}:${epoch}`);
  }
  release(sessionId: string, epoch: number, reason: "session_closed" | "emergency_handoff" | "approved_switch"): void {
    if (reason === "session_closed" || reason === "emergency_handoff" || reason === "approved_switch") this.locks.delete(`${sessionId}:${epoch}`);
  }
  assertSame(lock: ModelLock, model: Pick<ModelDefinition, "provider" | "model">): void {
    if (modelKey(lock.model) !== modelKey(model)) throw new Error("E_MODEL_LOCK_MISMATCH");
  }
}

interface ToolLoopState {
  readonly sessionId: string;
  readonly ownerModel: string;
}

export class ToolLoopLock {
  private readonly active = new Map<string, ToolLoopState>();
  begin(sessionId: string, model: Pick<ModelDefinition, "provider" | "model">): void {
    if (!sessionId.trim()) throw new Error("E_TOOL_LOOP_SESSION_REQUIRED");
    const ownerModel = modelKey(model);
    const existing = this.active.get(sessionId);
    if (existing && existing.ownerModel !== ownerModel) throw new Error("E_TOOL_LOOP_MODEL_SWITCH");
    this.active.set(sessionId, { sessionId, ownerModel });
  }
  assertOwner(sessionId: string, model: Pick<ModelDefinition, "provider" | "model">): void {
    const existing = this.active.get(sessionId);
    if (existing && existing.ownerModel !== modelKey(model)) throw new Error("E_TOOL_LOOP_MODEL_SWITCH");
  }
  complete(sessionId: string, model: Pick<ModelDefinition, "provider" | "model">, hasToolCalls: boolean): void {
    this.assertOwner(sessionId, model);
    if (hasToolCalls) throw new Error("E_TOOL_LOOP_PENDING_TOOLS");
    this.active.delete(sessionId);
  }
  owner(sessionId: string): string | undefined { return this.active.get(sessionId)?.ownerModel; }
}
