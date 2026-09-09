import type { EngineName } from "./types";

export type SessionHealth = "up" | "degraded" | "down";
export type SessionAuthState = "authenticated" | "connecting" | "disconnected" | "expired";

export interface SessionHealthSignals {
  authState: SessionAuthState;
  nowMs: number;
  heartbeatAtMs: number | null;
  lastEventAtMs: number | null;
  lastSuccessfulSendAtMs: number | null;
  lastAckAtMs: number | null;
  consecutiveErrors: number;
  latencyMs?: number | null;
}

export interface SessionHealthPolicy {
  heartbeatStaleMs: number;
  eventStaleMs: number;
  degradedErrorCount: number;
  downErrorCount: number;
  maxHealthyLatencyMs: number;
}

export const DEFAULT_SESSION_HEALTH_POLICY: SessionHealthPolicy = {
  heartbeatStaleMs: 120_000,
  eventStaleMs: 600_000,
  degradedErrorCount: 5,
  downErrorCount: 10,
  maxHealthyLatencyMs: 10_000,
};

export interface SessionHealthResult {
  state: SessionHealth;
  reasons: string[];
}

function olderThan(nowMs: number, timestampMs: number | null, thresholdMs: number): boolean {
  return timestampMs != null && nowMs - timestampMs > thresholdMs;
}

export function classifySessionHealth(
  signals: SessionHealthSignals,
  policy: SessionHealthPolicy = DEFAULT_SESSION_HEALTH_POLICY,
): SessionHealthResult {
  const reasons: string[] = [];

  if (signals.authState === "expired") reasons.push("auth_expired");
  if (signals.authState === "disconnected") reasons.push("auth_disconnected");
  if (olderThan(signals.nowMs, signals.heartbeatAtMs, policy.heartbeatStaleMs)) {
    reasons.push("heartbeat_stale");
  }
  if (signals.consecutiveErrors >= policy.downErrorCount) reasons.push("too_many_errors");

  if (reasons.length > 0) return { state: "down", reasons };

  if (signals.authState === "connecting") reasons.push("connecting");
  if (signals.heartbeatAtMs == null) reasons.push("heartbeat_missing");
  if (olderThan(signals.nowMs, signals.lastEventAtMs, policy.eventStaleMs)) {
    reasons.push("event_flow_stale");
  }
  if (signals.consecutiveErrors >= policy.degradedErrorCount) {
    reasons.push("repeated_errors");
  }
  if ((signals.latencyMs ?? 0) > policy.maxHealthyLatencyMs) reasons.push("latency_high");

  return reasons.length > 0
    ? { state: "degraded", reasons }
    : { state: "up", reasons: [] };
}

export interface SessionLeaseScope {
  organizationId: string;
  accountId: string;
  sessionRef: string;
}

export function sessionLeaseKey(scope: SessionLeaseScope): string {
  return [
    "channel-gateway",
    "lease",
    scope.organizationId,
    scope.accountId,
    scope.sessionRef,
  ].join(":");
}

export interface SessionLeaseStore {
  acquire(key: string, owner: string, ttlMs: number): Promise<boolean>;
  renew(key: string, owner: string, ttlMs: number): Promise<boolean>;
  release(key: string, owner: string): Promise<boolean>;
}

export type RecoveryAction =
  | { type: "none" }
  | { type: "reconnect_current_engine"; engine: EngineName }
  | { type: "restart_current_runtime"; engine: EngineName }
  | { type: "operator_attention_required"; engine: EngineName; reason: string };

export function chooseRecoveryAction(input: {
  health: SessionHealthResult;
  engine: EngineName;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}): RecoveryAction {
  if (input.health.state === "up") return { type: "none" };

  if (input.health.reasons.includes("auth_expired")) {
    return {
      type: "operator_attention_required",
      engine: input.engine,
      reason: "reauthentication_required",
    };
  }

  if (input.reconnectAttempts < input.maxReconnectAttempts) {
    return { type: "reconnect_current_engine", engine: input.engine };
  }

  if (input.reconnectAttempts === input.maxReconnectAttempts) {
    return { type: "restart_current_runtime", engine: input.engine };
  }

  return {
    type: "operator_attention_required",
    engine: input.engine,
    reason: "recovery_exhausted",
  };
}

export function assertNoAutomaticEngineMigration(
  currentEngine: EngineName,
  requestedEngine: EngineName,
): void {
  if (currentEngine !== requestedEngine) {
    throw new Error("automatic_engine_migration_forbidden");
  }
}
