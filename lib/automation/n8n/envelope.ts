import crypto from "crypto";
import { sanitizeMemoryCandidate } from "../../agent-engine/memory/sanitize";

/**
 * N8n integration envelope — the wire format for events sent to external
 * n8n instances. Contains event metadata and a sanitized data payload.
 *
 * The envelope enforces:
 * - Secret/credential detection reused from sanitizeMemoryCandidate (Phase 2)
 * - Opaque organization reference (SHA256 truncated to 32 hex chars)
 * - Deterministic idempotency key (no randomness; must survive retries)
 * - Fail-closed sanitization: any secret-like value blocks the entire envelope
 */
export interface N8nIntegrationEnvelope {
  event_id: string;
  event_type: string;
  occurred_at: string;
  organization_ref: string;
  idempotency_key: string;
  data: Record<string, unknown>;
}

export interface BuildN8nEnvelopeInput {
  eventId: string;
  eventType: string;
  occurredAt: string;
  organizationId: string;
  idempotencyKey: string;
  data: Record<string, unknown>;
}

/**
 * Recursively scans all string values in an object (including nested
 * objects and arrays) for secrets/credentials using the same regex patterns
 * as sanitizeMemoryCandidate. This is the reused implementation from Phase 2,
 * following the precedent set by sanitizeGraphEpisode (Phase 4) and
 * sanitizeExternalGuardrailCandidate (Phase 5).
 *
 * Fails closed: if any string value looks like a secret, throws immediately
 * with the reason from sanitizeMemoryCandidate.
 *
 * Does NOT modify the data; only validates it. If validation passes, the
 * original data is returned as-is to be included in the envelope.
 */
function validateDataFieldsNoSecrets(data: Record<string, unknown>): void {
  const stack: unknown[] = [data];

  while (stack.length > 0) {
    const current = stack.pop();

    if (current === null || current === undefined) {
      continue;
    }

    if (typeof current === "string") {
      const result = sanitizeMemoryCandidate({ text: current, type: "behavior" });
      if (!result.allowed) {
        throw new Error(
          `Secret/credential detected in data field: ${result.reason}`,
        );
      }
      continue;
    }

    if (typeof current === "object") {
      if (Array.isArray(current)) {
        for (const item of current) {
          stack.push(item);
        }
      } else {
        for (const value of Object.values(current)) {
          stack.push(value);
        }
      }
    }
  }
}

/**
 * Creates an opaque deterministic reference from an organization ID.
 * The reference is used for correlation in external systems (n8n) without
 * revealing the raw UUID format or containing PII.
 *
 * Implementation: SHA256 hash of the organization ID, truncated to 32 hex
 * characters. This is deterministic (same org ID always produces same ref),
 * does not leak the UUID format, and is non-invertible.
 */
function createOrganizationRef(organizationId: string): string {
  const hash = crypto.createHash("sha256").update(organizationId).digest("hex");
  return hash.slice(0, 32);
}

/**
 * Builds a canonical n8n integration envelope from input fields.
 *
 * Responsibilities:
 * 1. Validate all required fields are non-empty
 * 2. Sanitize the data payload (reject if any secret-like values detected)
 * 3. Transform camelCase input field names to snake_case output
 * 4. Create deterministic organization reference
 * 5. Preserve the idempotency key as-is (must be deterministic from caller)
 *
 * Throws if:
 * - Any required field is empty
 * - Any string in the data looks like a secret/credential
 */
export function buildN8nEnvelope(input: BuildN8nEnvelopeInput): N8nIntegrationEnvelope {
  const {
    eventId,
    eventType,
    occurredAt,
    organizationId,
    idempotencyKey,
    data,
  } = input;

  // Validate required fields are not empty
  if (!eventId || eventId.trim() === "") {
    throw new Error("eventId is required and cannot be empty");
  }
  if (!eventType || eventType.trim() === "") {
    throw new Error("eventType is required and cannot be empty");
  }
  if (!idempotencyKey || idempotencyKey.trim() === "") {
    throw new Error("idempotencyKey is required and cannot be empty");
  }
  if (!organizationId || organizationId.trim() === "") {
    throw new Error("organizationId is required and cannot be empty");
  }
  // occurredAt has no default here on purpose: every caller (currently only
  // executeN8nWebhook) passes `new Date().toISOString()` explicitly, so the
  // envelope stays a pure function of its inputs instead of silently
  // stamping "now" itself. Still validated like the other required fields —
  // an empty/non-string value would otherwise reach the external n8n
  // instance as a broken timestamp instead of failing closed here.
  if (!occurredAt || typeof occurredAt !== "string" || occurredAt.trim() === "") {
    throw new Error("occurredAt is required and must be a non-empty ISO-8601 string");
  }

  // Sanitize data payload (fail-closed: any secret blocks the envelope)
  validateDataFieldsNoSecrets(data);

  // Build the envelope with camelCase→snake_case transformation
  const envelope: N8nIntegrationEnvelope = {
    event_id: eventId,
    event_type: eventType,
    occurred_at: occurredAt,
    organization_ref: createOrganizationRef(organizationId),
    idempotency_key: idempotencyKey,
    data,
  };

  return envelope;
}
