import { CoreEventBus } from "./event-bus.js";
import { parsePublishedMarkdown, scanKnowledgeBody } from "@lumenva/knowledge";
import { projectPublishedNote, type KnowledgeGraph } from "@lumenva/knowledge-graph";
import { MgcUnavailableError, type ContextRequest, type ContextResult, type MgcAdapter } from "./mcg-adapter.js";
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

  async requestContext(taskId: string, adapter: MgcAdapter, input: Omit<ContextRequest, "taskId" | "traceId">): Promise<ContextResult> {
    if (this.state !== "running") throw new Error("CoreRuntime is not running");
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`task not found: ${taskId}`);
    await this.eventBus.publish({
      id: `context-requested:${taskId}`,
      type: "context.requested",
      taskId,
      traceId: task.traceId,
      payload: { objective: input.objective, budgetChars: input.budgetChars, measurementType: "unavailable" },
    });
    try {
      const result = await adapter.compile({ ...input, taskId, traceId: task.traceId });
      await this.eventBus.publish({
        id: `context-completed:${taskId}`,
        type: "context.completed",
        taskId,
        traceId: task.traceId,
        payload: {
          contextVersion: result.contextVersion,
          measurementType: result.measurementType,
          source: result.source,
          inputChars: input.objective.length,
          outputChars: result.fragments.reduce((total, fragment) => total + fragment.content.length, 0),
          estimatedTokens: Math.ceil(result.fragments.reduce((total, fragment) => total + fragment.content.length, 0) / 4),
        },
      });
      return result;
    } catch (error) {
      const unavailable = new MgcUnavailableError(error);
      await this.eventBus.publish({
        id: `context-failed:${taskId}`,
        type: "context.failed",
        taskId,
        traceId: task.traceId,
        payload: { code: unavailable.code, measurementType: "unavailable" },
      });
      throw unavailable;
    }
  }

  async publishKnowledge(taskId: string, graph: Pick<KnowledgeGraph, "addEpisode">, input: {
    namespace: string;
    sourcePath: string;
    markdown: string;
  }): Promise<{ sourceId: string; version: number; idempotencyKey: string }> {
    if (this.state !== "running") throw new Error("CoreRuntime is not running");
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`task not found: ${taskId}`);
    const note = parsePublishedMarkdown(input.markdown, input.sourcePath);
    scanKnowledgeBody(note.body);
    await this.eventBus.publish({
      id: `knowledge-published:${taskId}`,
      type: "knowledge.published",
      taskId,
      traceId: task.traceId,
      payload: { sourceId: note.sourceId, version: note.version, sourcePath: note.provenance.sourcePath, measurementType: "exact" },
    });
    const idempotencyKey = await projectPublishedNote(graph, { ...note, namespace: input.namespace });
    await this.eventBus.publish({
      id: `graph-projected:${taskId}`,
      type: "graph.projected",
      taskId,
      traceId: task.traceId,
      payload: { sourceId: note.sourceId, version: note.version, namespace: input.namespace, idempotencyKey, measurementType: "exact" },
    });
    return { sourceId: note.sourceId, version: note.version, idempotencyKey };
  }
}
