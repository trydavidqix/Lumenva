import { createPublicKey, verify } from "node:crypto";

export interface TelnyxNumberDirectory {
  resolveOrganizationByCalledNumber(calledE164: string): Promise<string | null>;
}

export interface VerifyTelnyxWebhookInput {
  rawBody: string;
  signatureBase64: string | null | undefined;
  timestamp: string | null | undefined;
  publicKey: string;
  nowMs?: number;
}

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const MAX_WEBHOOK_AGE_SECONDS = 300;

function importEd25519PublicKey(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("BEGIN PUBLIC KEY")) return createPublicKey(trimmed);
  const raw = Buffer.from(trimmed, "base64");
  if (raw.length !== 32) throw new Error("invalid Telnyx Ed25519 public key");
  return createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, raw]), format: "der", type: "spki" });
}

export function verifyTelnyxWebhook(input: VerifyTelnyxWebhookInput): boolean {
  try {
    if (!input.signatureBase64 || !input.timestamp || !input.publicKey.trim()) return false;
    const timestampSeconds = Number(input.timestamp);
    if (!Number.isSafeInteger(timestampSeconds)) return false;
    const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
    if (Math.abs(nowSeconds - timestampSeconds) > MAX_WEBHOOK_AGE_SECONDS) return false;
    const signature = Buffer.from(input.signatureBase64, "base64");
    if (signature.length === 0) return false;
    const signed = Buffer.from(`${input.timestamp}|${input.rawBody}`);
    return verify(null, signed, importEd25519PublicKey(input.publicKey), signature);
  } catch {
    return false;
  }
}

function normalizeE164(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`[voice] Telnyx ${field} must be E.164`);
  const normalized = value.trim();
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error(`[voice] Telnyx ${field} must be E.164`);
  return normalized;
}

interface TelnyxEnvelope {
  data?: {
    id?: unknown;
    event_type?: unknown;
    occurred_at?: unknown;
    payload?: Record<string, unknown>;
  };
}

export interface NormalizedTelnyxCallEvent {
  organizationId: string;
  providerEventId: string;
  eventType: string;
  occurredAt: string;
  direction: "inbound" | "outbound";
  callerE164: string;
  calledE164: string;
  attributes: {
    callControlId: string | null;
    callSessionId: string | null;
  };
}

function optionalScalarString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function parseTelnyxCallEvent(input: {
  rawBody: string;
  directory: TelnyxNumberDirectory;
}): Promise<NormalizedTelnyxCallEvent> {
  let envelope: TelnyxEnvelope;
  try {
    envelope = JSON.parse(input.rawBody) as TelnyxEnvelope;
  } catch {
    throw new Error("[voice] invalid Telnyx JSON");
  }
  const data = envelope.data;
  const payload = data?.payload;
  if (!data || !payload || typeof data.id !== "string" || typeof data.event_type !== "string" || typeof data.occurred_at !== "string") {
    throw new Error("[voice] invalid Telnyx call event envelope");
  }
  if (!data.event_type.startsWith("call.")) throw new Error("[voice] unsupported Telnyx event type");

  const callerE164 = normalizeE164(payload.from, "from");
  const calledE164 = normalizeE164(payload.to, "to");
  const direction = payload.direction === "outgoing" ? "outbound" : payload.direction === "incoming" ? "inbound" : null;
  if (direction === null) throw new Error("[voice] invalid Telnyx call direction");

  // Critical isolation rule: identify the tenant from OUR technical number first.
  // Caller identity is never searched globally across tenants.
  const technicalNumber = direction === "inbound" ? calledE164 : callerE164;
  const organizationId = await input.directory.resolveOrganizationByCalledNumber(technicalNumber);
  if (!organizationId) throw new Error("[voice] organization not found for Telnyx technical number");

  return {
    organizationId,
    providerEventId: data.id,
    eventType: data.event_type,
    occurredAt: data.occurred_at,
    direction,
    callerE164,
    calledE164,
    attributes: {
      callControlId: optionalScalarString(payload.call_control_id),
      callSessionId: optionalScalarString(payload.call_session_id),
    },
  };
}
