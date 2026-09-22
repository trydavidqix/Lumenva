import type { CoreEvent } from "./sqlite-store.js";
import { SqliteStore } from "./sqlite-store.js";

export type CoreEventSubscriber = (event: CoreEvent) => unknown | Promise<unknown>;

export class CoreEventBus {
  private readonly subscribers = new Set<CoreEventSubscriber>();

  constructor(private readonly store: SqliteStore) {}

  subscribe(subscriber: CoreEventSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  async publish(event: CoreEvent): Promise<CoreEvent> {
    const existed = this.store.replayEvents().some((candidate) => candidate.id === event.id);
    const persisted = this.store.appendEvent(event);
    if (!existed) {
      await Promise.all([...this.subscribers].map((subscriber) => subscriber(persisted)));
    }
    return persisted;
  }
}
