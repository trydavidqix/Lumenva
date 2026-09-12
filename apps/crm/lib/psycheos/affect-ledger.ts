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

export type TrustInteraction = Readonly<{
  kind: "POSITIVE" | "BREACH" | "REPAIR";
  confidence: number;
}>;

export type TrustInteractionInput = TrustInteraction & Readonly<{
  subjectId: string;
  targetId: string;
  interactionId: string;
}>;

export type TrustEvent = Readonly<{
  subjectId: string;
  targetId: string;
  interactionId: string;
  kind: TrustInteraction["kind"];
  confidence: number;
  before: number;
  after: number;
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

const trustKey = (subjectId: string, targetId: string, interactionId: string): string => `${subjectId}\u0000${targetId}\u0000${interactionId}`;
const trustStreamKey = (subjectId: string, targetId: string): string => `${subjectId}\u0000${targetId}`;

const TRUST_RATES = Object.freeze({ positive: 0.1, breach: 0.5, repair: 0.05 });
const TRUST_RATE_CAPS = Object.freeze({ positive: 0.1, breach: 0.5, repair: 0.05 });

export const applyTrustInteraction = (
  current: number,
  interaction: TrustInteraction,
  rates: Readonly<{ positive: number; breach: number; repair: number }> = TRUST_RATES,
): number => {
  if (!Number.isFinite(current) || current < -1 || current > 1) throw new RangeError("trust must be within [-1, 1]");
  if (!Number.isFinite(interaction.confidence) || interaction.confidence < 0 || interaction.confidence > 1) {
    throw new RangeError("trust confidence must be within [0, 1]");
  }
  if (interaction.kind !== "POSITIVE" && interaction.kind !== "BREACH" && interaction.kind !== "REPAIR") {
    throw new TypeError(`unknown trust interaction kind: ${String(interaction.kind)}`);
  }
  const rateKey = interaction.kind === "POSITIVE" ? "positive" : interaction.kind === "BREACH" ? "breach" : "repair";
  const rate = rates[rateKey];
  if (!Number.isFinite(rate) || rate < 0) throw new RangeError("trust rates must be finite and >= 0");
  const magnitude = interaction.confidence * Math.min(rate, TRUST_RATE_CAPS[rateKey]);
  return clamp(current + (interaction.kind === "POSITIVE" || interaction.kind === "REPAIR" ? magnitude : -magnitude));
};

export class DirectionalTrustLedger {
  private readonly eventLog: TrustEvent[] = [];
  private readonly byKey = new Map<string, TrustEvent>();
  private readonly latest = new Map<string, number>();
  private readonly rates: Readonly<{ positive: number; breach: number; repair: number }>;

  constructor(rates: Readonly<{ positive: number; breach: number; repair: number }> = TRUST_RATES) {
    for (const value of Object.values(rates)) if (!Number.isFinite(value) || value < 0) throw new RangeError("trust rates must be finite and >= 0");
    this.rates = Object.freeze({
      positive: Math.min(rates.positive, TRUST_RATE_CAPS.positive),
      breach: Math.min(rates.breach, TRUST_RATE_CAPS.breach),
      repair: Math.min(rates.repair, TRUST_RATE_CAPS.repair),
    });
  }

  append(input: TrustInteractionInput): TrustEvent {
    if (!input.subjectId || !input.targetId || !input.interactionId) throw new TypeError("subjectId, targetId and interactionId are required");
    const key = trustKey(input.subjectId, input.targetId, input.interactionId);
    const replay = this.byKey.get(key);
    if (replay) return { ...replay };
    const stream = trustStreamKey(input.subjectId, input.targetId);
    const before = this.latest.get(stream) ?? 0;
    const after = applyTrustInteraction(before, input, this.rates);
    const event: TrustEvent = Object.freeze({
      subjectId: input.subjectId,
      targetId: input.targetId,
      interactionId: input.interactionId,
      kind: input.kind,
      confidence: input.confidence,
      before,
      after,
    });
    this.eventLog.push(event);
    this.byKey.set(key, event);
    this.latest.set(stream, after);
    return { ...event };
  }

  read(subjectId: string, targetId: string): number {
    return this.latest.get(trustStreamKey(subjectId, targetId)) ?? 0;
  }

  events(): readonly TrustEvent[] {
    return this.eventLog.map((event) => ({ ...event }));
  }
}

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
