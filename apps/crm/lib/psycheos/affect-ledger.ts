export type PadState = Readonly<{
  pleasure: number;
  arousal: number;
  dominance: number;
}>;

export type PadDelta = {
  pleasure: number;
  arousal: number;
  dominance: number;
};

export type AffectEventInput = {
  agentId: string;
  sessionId: string;
  eventId: string;
  atMs: number;
  delta: PadDelta;
};

export type AffectEvent = Readonly<{
  agentId: string;
  sessionId: string;
  eventId: string;
  atMs: number;
  before: PadState;
  after: PadState;
  decayLambda: number;
}>;

type Key = string;

const ZERO: PadState = Object.freeze({ pleasure: 0, arousal: 0, dominance: 0 });

const clamp = (value: number): number => Math.max(-1, Math.min(1, value));

/** Pure exponential decay from the last event; input and output are immutable snapshots. */
export const decayPad = (pad: PadState, elapsedSeconds: number, lambda: number, baseline: PadState = ZERO): PadState => {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw new RangeError("elapsedSeconds must be finite and >= 0");
  if (!Number.isFinite(lambda) || lambda < 0) throw new RangeError("lambda must be finite and >= 0");
  const factor = Math.exp(-lambda * elapsedSeconds);
  return Object.freeze({
    pleasure: clamp(baseline.pleasure + (pad.pleasure - baseline.pleasure) * factor),
    arousal: clamp(baseline.arousal + (pad.arousal - baseline.arousal) * factor),
    dominance: clamp(baseline.dominance + (pad.dominance - baseline.dominance) * factor),
  });
};

const freezePad = (pad: PadDelta): PadState =>
  Object.freeze({ pleasure: clamp(pad.pleasure), arousal: clamp(pad.arousal), dominance: clamp(pad.dominance) });

const copyPad = (pad: PadState): PadState => Object.freeze({ ...pad });

const keyFor = (agentId: string, sessionId: string, eventId: string): Key => `${agentId}\u0000${sessionId}\u0000${eventId}`;
const streamKey = (agentId: string, sessionId: string): string => `${agentId}\u0000${sessionId}`;

export class AffectLedger {
  private readonly eventLog: AffectEvent[] = [];
  private readonly byKey = new Map<Key, AffectEvent>();
  private readonly latestAt = new Map<string, number>();
  private readonly lambda: number;

  constructor(options: { lambda: number }) {
    if (!Number.isFinite(options.lambda) || options.lambda < 0) throw new RangeError("lambda must be finite and >= 0");
    this.lambda = options.lambda;
  }

  append(input: AffectEventInput): AffectEvent {
    this.validateInput(input);
    const key = keyFor(input.agentId, input.sessionId, input.eventId);
    const replay = this.byKey.get(key);
    if (replay) return this.cloneEvent(replay);

    const stream = streamKey(input.agentId, input.sessionId);
    const previousAt = this.latestAt.get(stream);
    if (previousAt !== undefined && input.atMs < previousAt) throw new RangeError("events must be appended in timestamp order");

    const before = this.readState(input.agentId, input.sessionId, input.atMs);
    const after = freezePad({
      pleasure: before.pleasure + input.delta.pleasure,
      arousal: before.arousal + input.delta.arousal,
      dominance: before.dominance + input.delta.dominance,
    });
    const event: AffectEvent = Object.freeze({
      agentId: input.agentId,
      sessionId: input.sessionId,
      eventId: input.eventId,
      atMs: input.atMs,
      before: copyPad(before),
      after: copyPad(after),
      decayLambda: this.lambda,
    });
    this.eventLog.push(event);
    this.byKey.set(key, event);
    this.latestAt.set(stream, input.atMs);
    return this.cloneEvent(event);
  }

  readState(agentId: string, sessionId: string, atMs: number): PadState {
    if (!Number.isFinite(atMs) || atMs < 0) throw new RangeError("atMs must be finite and >= 0");
    const events = this.eventLog.filter((event) => event.agentId === agentId && event.sessionId === sessionId && event.atMs <= atMs);
    const latest = events.at(-1);
    if (!latest) return copyPad(ZERO);
    const elapsedSeconds = (atMs - latest.atMs) / 1000;
    return decayPad(latest.after, elapsedSeconds, this.lambda);
  }

  events(): readonly AffectEvent[] {
    return this.eventLog.map((event) => this.cloneEvent(event));
  }

  private cloneEvent(event: AffectEvent): AffectEvent {
    return Object.freeze({ ...event, before: copyPad(event.before), after: copyPad(event.after) });
  }

  private validateInput(input: AffectEventInput): void {
    if (!input.agentId || !input.sessionId || !input.eventId) throw new TypeError("agentId, sessionId and eventId are required");
    if (!Number.isFinite(input.atMs) || input.atMs < 0) throw new RangeError("atMs must be finite and >= 0");
    for (const value of [input.delta.pleasure, input.delta.arousal, input.delta.dominance]) {
      if (!Number.isFinite(value) || value < -1 || value > 1) throw new RangeError("PAD delta must be within [-1, 1]");
    }
  }
}
