import { describe, expect, it } from "vitest";

import {
  assertNoAutomaticEngineMigration,
  chooseRecoveryAction,
  classifySessionHealth,
  sessionLeaseKey,
  type SessionHealthSignals,
} from "./session-supervisor";

const nowMs = Date.parse("2026-08-24T13:30:00.000Z");

function healthy(overrides: Partial<SessionHealthSignals> = {}): SessionHealthSignals {
  return {
    authState: "authenticated",
    nowMs,
    heartbeatAtMs: nowMs - 1_000,
    lastEventAtMs: nowMs - 2_000,
    lastSuccessfulSendAtMs: nowMs - 3_000,
    lastAckAtMs: nowMs - 2_500,
    consecutiveErrors: 0,
    latencyMs: 250,
    ...overrides,
  };
}

describe("session supervisor", () => {
  it("classifies a healthy session as up", () => {
    expect(classifySessionHealth(healthy())).toEqual({ state: "up", reasons: [] });
  });

  it("marks socket-connected but stale event flow as degraded", () => {
    const result = classifySessionHealth(
      healthy({ lastEventAtMs: nowMs - 700_000 }),
    );
    expect(result.state).toBe("degraded");
    expect(result.reasons).toContain("event_flow_stale");
  });

  it("marks stale heartbeat and expired auth as down", () => {
    expect(
      classifySessionHealth(
        healthy({
          authState: "expired",
          heartbeatAtMs: nowMs - 180_000,
        }),
      ),
    ).toEqual({
      state: "down",
      reasons: ["auth_expired", "heartbeat_stale"],
    });
  });

  it("degrades on repeated errors before reaching the down threshold", () => {
    const result = classifySessionHealth(healthy({ consecutiveErrors: 6 }));
    expect(result.state).toBe("degraded");
    expect(result.reasons).toContain("repeated_errors");
  });

  it("scopes lease keys by tenant, account and session", () => {
    expect(
      sessionLeaseKey({
        organizationId: "org-a",
        accountId: "account-b",
        sessionRef: "session-c",
      }),
    ).toBe("channel-gateway:lease:org-a:account-b:session-c");
  });

  it("never chooses a different engine as a recovery action", () => {
    expect(
      chooseRecoveryAction({
        health: { state: "down", reasons: ["heartbeat_stale"] },
        engine: "baileys",
        reconnectAttempts: 0,
        maxReconnectAttempts: 2,
      }),
    ).toEqual({ type: "reconnect_current_engine", engine: "baileys" });

    expect(() => assertNoAutomaticEngineMigration("baileys", "waha")).toThrow(
      "automatic_engine_migration_forbidden",
    );
  });

  it("requires operator attention when auth has expired", () => {
    expect(
      chooseRecoveryAction({
        health: { state: "down", reasons: ["auth_expired"] },
        engine: "waha",
        reconnectAttempts: 0,
        maxReconnectAttempts: 2,
      }),
    ).toEqual({
      type: "operator_attention_required",
      engine: "waha",
      reason: "reauthentication_required",
    });
  });
});
