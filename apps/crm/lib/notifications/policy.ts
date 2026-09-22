export interface NotificationDeliveryPolicy {
  timezone: string;
  voiceEscalationEnabled: boolean;
  allowedVoiceDestinations: string[];
  whatsappMaxAttempts: number;
  voiceMaxAttempts: number;
  maxVoiceCallsPerHour: number;
  maxVoiceCallsPerDay: number;
  voiceCooldownSeconds: number;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

export interface VoicePolicySnapshot {
  notificationVoiceAttempts: number;
  callsLastHour: number;
  callsLastDay: number;
  lastCallAt: Date | null;
  oldestCallLastHourAt: Date | null;
  oldestCallLastDayAt: Date | null;
}

export type VoicePolicyDecision =
  | { kind: "allow" }
  | { kind: "block"; reason: string }
  | { kind: "defer"; reason: string; retryAt: Date };

export const DEFAULT_NOTIFICATION_DELIVERY_POLICY: NotificationDeliveryPolicy = {
  timezone: "UTC",
  voiceEscalationEnabled: false,
  allowedVoiceDestinations: [],
  whatsappMaxAttempts: 2,
  voiceMaxAttempts: 1,
  maxVoiceCallsPerHour: 2,
  maxVoiceCallsPerDay: 4,
  voiceCooldownSeconds: 600,
  quietHoursStart: null,
  quietHoursEnd: null,
};

const E164 = /^\+[1-9]\d{6,14}$/;

function minutesFromSqlTime(value: string): number {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) throw new Error("notification_policy_invalid_quiet_hours");
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    throw new Error("notification_policy_invalid_quiet_hours");
  }
  return hours * 60 + minutes;
}

function localMinuteOfDay(date: Date, timezone: string): number {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new Error("notification_policy_invalid_timezone");
  }
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error("notification_policy_invalid_timezone");
  }
  return hour * 60 + minute;
}

export function isInsideQuietHours(
  date: Date,
  timezone: string,
  start: string | null,
  end: string | null,
): boolean {
  if (start === null || end === null) return false;
  const startMinute = minutesFromSqlTime(start);
  const endMinute = minutesFromSqlTime(end);
  if (startMinute === endMinute) return true;
  const local = localMinuteOfDay(date, timezone);
  return startMinute < endMinute
    ? local >= startMinute && local < endMinute
    : local >= startMinute || local < endMinute;
}

export function firstTimeOutsideQuietHours(
  now: Date,
  timezone: string,
  start: string | null,
  end: string | null,
): Date {
  if (!isInsideQuietHours(now, timezone, start, end)) return now;
  // Quiet-hour windows are bounded to one local day. Scanning minute-by-minute
  // avoids timezone-offset arithmetic bugs at DST boundaries and runs at most
  // 1,501 cheap iterations for a single deferred notification.
  for (let minute = 1; minute <= 1501; minute += 1) {
    const candidate = new Date(now.getTime() + minute * 60_000);
    if (!isInsideQuietHours(candidate, timezone, start, end)) return candidate;
  }
  throw new Error("notification_policy_quiet_hours_unresolvable");
}

function after(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}

function later(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

export function evaluateVoicePolicy(input: {
  now: Date;
  destination: string;
  policy: NotificationDeliveryPolicy;
  snapshot: VoicePolicySnapshot;
}): VoicePolicyDecision {
  const { now, destination, policy, snapshot } = input;

  if (!E164.test(destination)) return { kind: "block", reason: "voice_destination_invalid" };
  if (!policy.voiceEscalationEnabled) {
    return { kind: "block", reason: "voice_escalation_policy_disabled" };
  }
  if (!policy.allowedVoiceDestinations.includes(destination)) {
    return { kind: "block", reason: "voice_destination_not_allowed" };
  }
  if (snapshot.notificationVoiceAttempts >= policy.voiceMaxAttempts) {
    return { kind: "block", reason: "voice_notification_attempts_exhausted" };
  }

  let retryAt = now;
  let deferReason: string | null = null;

  if (isInsideQuietHours(now, policy.timezone, policy.quietHoursStart, policy.quietHoursEnd)) {
    retryAt = later(
      retryAt,
      firstTimeOutsideQuietHours(now, policy.timezone, policy.quietHoursStart, policy.quietHoursEnd),
    );
    deferReason = "voice_quiet_hours";
  }

  if (snapshot.lastCallAt && policy.voiceCooldownSeconds > 0) {
    const cooldownEnd = after(snapshot.lastCallAt, policy.voiceCooldownSeconds * 1000);
    if (cooldownEnd.getTime() > now.getTime()) {
      retryAt = later(retryAt, cooldownEnd);
      deferReason = deferReason ?? "voice_cooldown";
    }
  }

  if (policy.maxVoiceCallsPerHour === 0) {
    return { kind: "block", reason: "voice_hourly_limit_zero" };
  }
  if (
    snapshot.callsLastHour >= policy.maxVoiceCallsPerHour &&
    snapshot.oldestCallLastHourAt
  ) {
    retryAt = later(retryAt, after(snapshot.oldestCallLastHourAt, 60 * 60_000));
    deferReason = deferReason ?? "voice_hourly_limit";
  }

  if (policy.maxVoiceCallsPerDay === 0) {
    return { kind: "block", reason: "voice_daily_limit_zero" };
  }
  if (
    snapshot.callsLastDay >= policy.maxVoiceCallsPerDay &&
    snapshot.oldestCallLastDayAt
  ) {
    retryAt = later(retryAt, after(snapshot.oldestCallLastDayAt, 24 * 60 * 60_000));
    deferReason = deferReason ?? "voice_daily_limit";
  }

  if (retryAt.getTime() > now.getTime()) {
    return { kind: "defer", reason: deferReason ?? "voice_policy_deferred", retryAt };
  }
  return { kind: "allow" };
}
