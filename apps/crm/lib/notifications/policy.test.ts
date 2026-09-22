import { describe, expect, it } from "vitest";

import {
  DEFAULT_NOTIFICATION_DELIVERY_POLICY,
  evaluateVoicePolicy,
  firstTimeOutsideQuietHours,
  isInsideQuietHours,
  type NotificationDeliveryPolicy,
  type VoicePolicySnapshot,
} from "./policy";

const destination = "+351912345678";
const allowPolicy: NotificationDeliveryPolicy = {
  ...DEFAULT_NOTIFICATION_DELIVERY_POLICY,
  timezone: "Europe/Lisbon",
  voiceEscalationEnabled: true,
  allowedVoiceDestinations: [destination],
  voiceMaxAttempts: 2,
  maxVoiceCallsPerHour: 2,
  maxVoiceCallsPerDay: 4,
  voiceCooldownSeconds: 600,
};
const emptySnapshot: VoicePolicySnapshot = {
  notificationVoiceAttempts: 0,
  callsLastHour: 0,
  callsLastDay: 0,
  lastCallAt: null,
  oldestCallLastHourAt: null,
  oldestCallLastDayAt: null,
};

describe("notification voice policy", () => {
  it("fails closed without an explicit voice policy and exact destination allowlist", () => {
    expect(evaluateVoicePolicy({
      now: new Date("2026-09-22T12:00:00Z"),
      destination,
      policy: DEFAULT_NOTIFICATION_DELIVERY_POLICY,
      snapshot: emptySnapshot,
    })).toEqual({ kind: "block", reason: "voice_escalation_policy_disabled" });

    expect(evaluateVoicePolicy({
      now: new Date("2026-09-22T12:00:00Z"),
      destination: "+351911111111",
      policy: allowPolicy,
      snapshot: emptySnapshot,
    })).toEqual({ kind: "block", reason: "voice_destination_not_allowed" });
  });

  it("allows an exact E.164 destination when all anti-fraud gates are clear", () => {
    expect(evaluateVoicePolicy({
      now: new Date("2026-09-22T12:00:00Z"),
      destination,
      policy: allowPolicy,
      snapshot: emptySnapshot,
    })).toEqual({ kind: "allow" });
  });

  it("blocks when per-notification voice attempts are exhausted", () => {
    expect(evaluateVoicePolicy({
      now: new Date("2026-09-22T12:00:00Z"),
      destination,
      policy: allowPolicy,
      snapshot: { ...emptySnapshot, notificationVoiceAttempts: 2 },
    })).toEqual({ kind: "block", reason: "voice_notification_attempts_exhausted" });
  });

  it("defers during same-day and overnight quiet hours", () => {
    expect(isInsideQuietHours(
      new Date("2026-09-22T22:30:00Z"),
      "Europe/Lisbon",
      "22:00:00",
      "23:30:00",
    )).toBe(true);

    expect(isInsideQuietHours(
      new Date("2026-09-22T23:30:00Z"),
      "Europe/Lisbon",
      "22:00:00",
      "07:00:00",
    )).toBe(true);

    const retry = firstTimeOutsideQuietHours(
      new Date("2026-09-22T23:30:00Z"),
      "Europe/Lisbon",
      "22:00:00",
      "07:00:00",
    );
    expect(retry.getTime()).toBeGreaterThan(new Date("2026-09-22T23:30:00Z").getTime());
    expect(isInsideQuietHours(retry, "Europe/Lisbon", "22:00:00", "07:00:00")).toBe(false);
  });

  it("defers for cooldown and hourly/daily ceilings instead of dialing in a loop", () => {
    const now = new Date("2026-09-22T12:00:00Z");
    const decision = evaluateVoicePolicy({
      now,
      destination,
      policy: allowPolicy,
      snapshot: {
        notificationVoiceAttempts: 0,
        callsLastHour: 2,
        callsLastDay: 4,
        lastCallAt: new Date("2026-09-22T11:59:00Z"),
        oldestCallLastHourAt: new Date("2026-09-22T11:10:00Z"),
        oldestCallLastDayAt: new Date("2026-09-21T13:00:00Z"),
      },
    });
    expect(decision.kind).toBe("defer");
    if (decision.kind === "defer") {
      expect(decision.retryAt.getTime()).toBeGreaterThan(now.getTime());
    }
  });

  it("treats zero hourly or daily budget as a hard stop", () => {
    expect(evaluateVoicePolicy({
      now: new Date("2026-09-22T12:00:00Z"),
      destination,
      policy: { ...allowPolicy, maxVoiceCallsPerHour: 0 },
      snapshot: emptySnapshot,
    })).toEqual({ kind: "block", reason: "voice_hourly_limit_zero" });

    expect(evaluateVoicePolicy({
      now: new Date("2026-09-22T12:00:00Z"),
      destination,
      policy: { ...allowPolicy, maxVoiceCallsPerDay: 0 },
      snapshot: emptySnapshot,
    })).toEqual({ kind: "block", reason: "voice_daily_limit_zero" });
  });
});
