import {
  createSessionState,
  reduceState,
  replaySession,
  type SessionEvent,
  type SessionSnapshot,
  type SessionState,
} from "../contracts/wave1-operating-core";

export interface SessionEventStore {
  append(event: SessionEvent): Promise<{ deduped: boolean }>;
  list(sessionId: string): Promise<readonly SessionEvent[]>;
}

export interface SessionSnapshotStore {
  load(sessionId: string): Promise<SessionSnapshot | null>;
  save(snapshot: SessionSnapshot): Promise<void>;
}

export class InMemorySessionPersistence implements SessionEventStore, SessionSnapshotStore {
  private readonly events = new Map<string, SessionEvent>();
  private readonly snapshots = new Map<string, SessionSnapshot>();

  async append(event: SessionEvent): Promise<{ deduped: boolean }> {
    if (this.events.has(event.id)) return { deduped: true };
    this.events.set(event.id, event);
    return { deduped: false };
  }

  async list(sessionId: string): Promise<readonly SessionEvent[]> {
    return [...this.events.values()]
      .filter((event) => event.sessionId === sessionId)
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id));
  }

  async load(sessionId: string): Promise<SessionSnapshot | null> {
    const snapshot = this.snapshots.get(sessionId);
    return snapshot
      ? { ...snapshot, state: { ...snapshot.state, knownFacts: { ...snapshot.state.knownFacts } } }
      : null;
  }

  async save(snapshot: SessionSnapshot): Promise<void> {
    this.snapshots.set(snapshot.sessionId, {
      ...snapshot,
      state: { ...snapshot.state, knownFacts: { ...snapshot.state.knownFacts } },
    });
  }
}

export class SessionService {
  constructor(
    private readonly events: SessionEventStore,
    private readonly snapshots: SessionSnapshotStore,
  ) {}

  async start(sessionId: string): Promise<SessionSnapshot> {
    const existing = await this.snapshots.load(sessionId);
    if (existing) return existing;
    const snapshot: SessionSnapshot = {
      sessionId,
      eventCount: 0,
      state: createSessionState(sessionId),
    };
    await this.snapshots.save(snapshot);
    return snapshot;
  }

  async apply(sessionId: string, input: unknown): Promise<{
    snapshot: SessionSnapshot;
    events: readonly SessionEvent[];
    rejected: ReturnType<typeof reduceState>["rejected"];
  }> {
    const current = (await this.snapshots.load(sessionId)) ?? (await this.start(sessionId));
    const result = reduceState(current.state, input);
    for (const event of result.events) await this.events.append(event);
    const snapshot: SessionSnapshot = {
      sessionId,
      eventCount: current.eventCount + result.events.length,
      state: result.state,
    };
    await this.snapshots.save(snapshot);
    return { snapshot, events: result.events, rejected: result.rejected };
  }

  async replay(sessionId: string): Promise<SessionState> {
    const snapshot = { sessionId, eventCount: 0, state: createSessionState(sessionId) };
    return replaySession(snapshot, await this.events.list(sessionId));
  }
}
