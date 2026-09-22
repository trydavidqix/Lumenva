import { CoreEventBus } from "./event-bus.js";
import type { CoreTask } from "./sqlite-store.js";
import { SqliteStore } from "./sqlite-store.js";

type RuntimeState = "stopped" | "running";

export class CoreRuntime {
  private readonly eventBus: CoreEventBus;
  private state: RuntimeState = "stopped";

  constructor(private readonly store: SqliteStore) {
    this.eventBus = new CoreEventBus(store);
  }

  async start(): Promise<void> {
    if (this.state === "running") return;
    this.store.open();
    this.state = "running";
    for (const task of this.store.listNonTerminalTasks()) {
      const recovering = this.store.updateTaskStatus(task.id, "RECOVERING");
      await this.eventBus.publish({
        id: `recovery:${recovering.id}`,
        type: "core.recovered",
        taskId: recovering.id,
        traceId: recovering.traceId,
        payload: { previousStatus: task.status, status: recovering.status },
      });
    }
  }

  async stop(): Promise<void> {
    if (this.state === "stopped") return;
    this.store.close();
    this.state = "stopped";
  }

  health(): { ok: boolean; state: RuntimeState; schemaVersion: number } {
    return {
      ok: this.state === "running",
      state: this.state,
      schemaVersion: this.state === "running" ? this.store.schemaVersion() : 0,
    };
  }

  task(id: string): CoreTask | null {
    if (this.state !== "running") return null;
    return this.store.getTask(id);
  }

  async startTask(input: {
    id: string;
    type: string;
    idempotencyKey: string;
    traceId: string;
    payload: unknown;
  }): Promise<{ task: CoreTask; created: boolean }> {
    if (this.state !== "running") throw new Error("CoreRuntime is not running");
    const existing = this.store.getTaskByIdempotencyKey(input.idempotencyKey);
    const task = this.store.createTask(input);
    if (!existing) {
      await this.eventBus.publish({
        id: `task-created:${task.id}`,
        type: "task.created",
        taskId: task.id,
        traceId: task.traceId,
        payload: { type: task.type, status: task.status },
      });
    }
    return { task, created: existing === null };
  }

  events(): CoreEventBus {
    return this.eventBus;
  }

  eventsList() {
    return this.store.replayEvents();
  }
}
