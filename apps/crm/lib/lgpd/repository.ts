/**
 * LGPD data-layer helpers.
 *
 * All admin-client queries include a programmatic `organization_id` filter —
 * the service role bypasses RLS, so we enforce tenancy here (CLAUDE.md §Multi-tenancy).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { computeDueAtGdpr } from "./sla";
import type { LgpdRequest, LgpdRequestType, LgpdScope, RgpdRequestStatus } from "./types";
export { readRgpdStatus } from "./state-machine";

export const RGPD_STATE_MACHINE_V1 = process.env.RGPD_STATE_MACHINE_V1 === "true";


// ---------------------------------------------------------------------------
// createLgpdRequest
// ---------------------------------------------------------------------------

export interface CreateLgpdRequestInput {
  organizationId: string;
  requestType: LgpdRequestType;
  source: "nuvemshop" | "admin_panel" | "api";
  contactId?: string | null;
  externalCustomerId?: string | null;
  receivedAt: Date;
  /** Number of calendar months for the GDPR/RGPD SLA (Art. 12(3) — default 1). */
  slaMonths: number;
  // TODO(RGPD): persist extension_notified, extension_reason and
  // extension_notified_at when the schema scope is explicitly approved.
  /** Extra context to store in request_payload. */
  payload?: Record<string, unknown>;
  /** Whether this is a high-priority emergency request (drives early SLA alarms). Default false. */
  emergency?: boolean;
  /** Scope of the request: contact-level or tenant-level. Default 'contact'. */
  scope?: LgpdScope;
}

export async function createLgpdRequest(
  input: CreateLgpdRequestInput,
): Promise<{ id: string; due_at: string }> {
  const admin = createAdminClient();

  const dueAt = computeDueAtGdpr(input.receivedAt, input.slaMonths);

  const { data, error } = await admin
    .from("lgpd_requests")
    .insert({
      organization_id: input.organizationId,
      request_type: input.requestType,
      source: input.source,
      contact_id: input.contactId ?? null,
      external_customer_id: input.externalCustomerId ?? null,
      received_at: input.receivedAt.toISOString(),
      due_at: dueAt.toISOString(),
      status: "received",
      rgpd_status: "received",
      request_payload: input.payload ?? {},
      emergency: input.emergency ?? false,
      scope: input.scope ?? "contact",
    })
    .select("id, due_at")
    .single();

  if (error) {
    throw new Error(`[lgpd-repository] createLgpdRequest failed: ${error.message}`);
  }

  return { id: data.id, due_at: data.due_at };
}

/** Dual-write transition: legacy status remains populated for old consumers. */
export async function transitionLgpdRequest(
  organizationId: string,
  id: string,
  rgpdStatus: RgpdRequestStatus,
  metadata: { extensionReason?: string; extensionNotifiedAt?: Date; refusalGrounds?: string; refusalCommunicatedAt?: Date } = {},
): Promise<void> {
  const legacyStatus: Record<RgpdRequestStatus, string> = {
    received: "received", in_review: "processing", extension_notified: "processing", responded: "completed", refused: "failed",
  };
  const update: Record<string, unknown> = { rgpd_status: rgpdStatus, status: legacyStatus[rgpdStatus], updated_at: new Date().toISOString() };
  if (metadata.extensionReason !== undefined) update.extension_reason = metadata.extensionReason;
  if (metadata.extensionNotifiedAt) update.extension_notified_at = metadata.extensionNotifiedAt.toISOString();
  if (metadata.refusalGrounds !== undefined) update.refusal_grounds = metadata.refusalGrounds;
  if (metadata.refusalCommunicatedAt) update.refusal_communicated_at = metadata.refusalCommunicatedAt.toISOString();
  const { error } = await createAdminClient().from("lgpd_requests").update(update).eq("organization_id", organizationId).eq("id", id);
  if (error) throw new Error(`[lgpd-repository] transitionLgpdRequest failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// findLgpdRequest
// ---------------------------------------------------------------------------

export async function findLgpdRequest(
  organizationId: string,
  id: string,
): Promise<LgpdRequest | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("lgpd_requests")
    .select("*")
    .eq("organization_id", organizationId) // programmatic tenant filter
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`[lgpd-repository] findLgpdRequest failed: ${error.message}`);
  }

  return (data as LgpdRequest | null) ?? null;
}

// ---------------------------------------------------------------------------
// findContactByExternalId
// ---------------------------------------------------------------------------

/**
 * Find an internal contact by Nuvemshop customer ID stored in source_metadata.
 *
 * Nuvemshop contacts are synced with source='nuvemshop' and their customer ID
 * is stored in `source_metadata->>'nuvemshop_customer_id'`. If that lookup
 * yields nothing (contact never imported), we fall back to email match via
 * the payload (caller provides email if available).
 *
 * L-03: returning null is valid — request is still logged.
 */
export async function findContactByExternalId(
  organizationId: string,
  externalCustomerId: string,
  fallbackEmail?: string | null,
): Promise<{ id: string } | null> {
  const admin = createAdminClient();

  // Primary: match by Nuvemshop customer ID stored in source_metadata
  const { data: bySourceMeta, error: err1 } = await admin
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId) // programmatic tenant filter
    .eq("source", "nuvemshop")
    .eq("source_metadata->>nuvemshop_customer_id", externalCustomerId)
    .maybeSingle();

  if (err1) {
    console.warn(
      `[lgpd-customer-redact] findContactByExternalId (source_metadata) error: ${err1.message}`,
    );
  }

  if (bySourceMeta) return { id: bySourceMeta.id };

  // Fallback: match by normalized email if provided
  if (fallbackEmail) {
    const normalizedEmail = fallbackEmail.trim().toLowerCase();
    const { data: byEmail, error: err2 } = await admin
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId) // programmatic tenant filter
      .eq("email_normalized", normalizedEmail)
      .maybeSingle();

    if (err2) {
      console.warn(
        `[lgpd-customer-redact] findContactByExternalId (email fallback) error: ${err2.message}`,
      );
    }

    if (byEmail) return { id: byEmail.id };
  }

  return null;
}
