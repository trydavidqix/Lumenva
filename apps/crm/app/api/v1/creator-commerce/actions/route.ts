import { createHash, randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { decideCreatorCommerceAction, type CreatorCommerceAction } from "@/lib/creator-commerce/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ENDPOINT_TAG = "creator-commerce/actions";
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const creatorUpsert = z.object({
  action: z.literal("creator.upsert"),
  handle: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(160),
  market: z.string().trim().max(16).optional(),
  language: z.string().trim().max(16).optional(),
});
const productShortlist = z.object({ action: z.literal("product.shortlist"), productId: z.string().uuid() });
const campaignCreate = z.object({
  action: z.literal("campaign.create"),
  name: z.string().trim().min(1).max(180),
  creatorProfileId: z.string().uuid().optional(),
  offerId: z.string().uuid().optional(),
  market: z.string().trim().max(16).optional(),
  language: z.string().trim().max(16).optional(),
});
const experimentCreate = z.object({
  action: z.literal("experiment.create"),
  name: z.string().trim().min(1).max(180),
  hypothesis: z.string().trim().min(1).max(2000),
  primaryMetric: z.string().trim().min(1).max(120),
  campaignId: z.string().uuid().optional(),
  minimumSampleSize: z.number().int().min(1).max(1_000_000).default(20),
  minimumWindowSeconds: z.number().int().min(60).max(31_536_000).default(86_400),
});
const providerSync = z.object({ action: z.literal("provider.sync.request"), provider: z.string().trim().min(1).max(80) });
const reconcileRequest = z.object({
  action: z.literal("revenue.reconcile.request"),
  provider: z.string().trim().min(1).max(80),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
const publicationRequest = z.object({
  action: z.literal("publication.request_commercial"),
  contentId: z.string().uuid(),
  connectionId: z.string().uuid(),
  provider: z.string().trim().min(1).max(80),
  country: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  evidenceRefs: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
});
const actionSchema = z.discriminatedUnion("action", [
  creatorUpsert,
  productShortlist,
  campaignCreate,
  experimentCreate,
  providerSync,
  reconcileRequest,
  publicationRequest,
]);
type ActionInput = z.infer<typeof actionSchema>;

function requestHash(input: ActionInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "creator_commerce_actions" });
  if (!authz.ok) return authz.response;
  const organizationId = authz.org.orgId;

  let raw: unknown;
  try { raw = await req.json(); } catch { return fail("invalid_request", "Body JSON inválido.", 400, { requestId }); }
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Ação inválida.", 422, { requestId, details: parsed.error.flatten() });
  const input = parsed.data;

  const idempotencyKey = req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
  if (!idempotencyKey) return fail("validation_failed", "Idempotency-Key é obrigatório.", 422, { requestId });

  const supabase = await createClient();
  const hash = requestHash(input);
  const { error: reserveError } = await supabase.from("idempotency_keys").insert({
    organization_id: organizationId,
    endpoint: ENDPOINT_TAG,
    key: idempotencyKey,
    request_hash: hash,
    response_body: {},
    status_code: 0,
    expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString(),
  });
  if (reserveError) {
    if (reserveError.code !== "23505") return fail("internal_error", "Falha ao reservar idempotência.", 500, { requestId });
    const { data: existing } = await supabase.from("idempotency_keys")
      .select("request_hash,response_body,status_code")
      .eq("organization_id", organizationId).eq("endpoint", ENDPOINT_TAG).eq("key", idempotencyKey).maybeSingle();
    if (!existing || existing.request_hash !== hash) return fail("idempotency_conflict", "Idempotency-Key já usada com payload diferente.", 409, { requestId });
    if (existing.status_code === 0) return fail("state_conflict", "Ação idempotente ainda em processamento.", 409, { requestId });
    return ok(existing.response_body as Record<string, unknown>, { status: existing.status_code, requestId });
  }

  let responseBody: Record<string, unknown>;
  let status = 201;
  try {
    const decision = decideCreatorCommerceAction({
      action: input.action as CreatorCommerceAction,
      complianceStatus: "PASS",
      capabilityAvailable: true,
    });

    if (decision.kind === "deny") {
      responseBody = { action: input.action, status: "denied", reason: decision.reason };
      status = 403;
    } else if (decision.kind === "require_approval") {
      const approvalId = randomUUID();
      const { error } = await supabase.from("event_log").insert({
        id: approvalId,
        organization_id: organizationId,
        event_type: "commerce.approval_requested",
        entity_kind: "creator_commerce_action",
        entity_id: approvalId,
        payload: {
          action: input.action,
          request_id: requestId,
          ...(input.action === "publication.request_commercial" ? {
            content_id: input.contentId,
            connection_id: input.connectionId,
            provider: input.provider,
            country: input.country,
            evidence_refs: input.evidenceRefs,
          } : {}),
        },
        metadata: { idempotency_key: idempotencyKey, risk: "r3_sensitive_commercial" },
      });
      if (error) throw new Error("approval_event_write_failed");
      responseBody = { action: input.action, status: "approval_required", approvalId, reason: decision.reason };
      status = 202;
    } else if (input.action === "creator.upsert") {
      const { data, error } = await supabase.from("creator_profiles").upsert({
        organization_id: organizationId,
        handle: input.handle,
        display_name: input.displayName,
        market: input.market ?? null,
        language: input.language ?? null,
        status: "active",
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,handle" }).select("id,handle,display_name,status,market,language").single();
      if (error || !data) throw new Error("creator_upsert_failed");
      responseBody = { action: input.action, creator: data };
    } else if (input.action === "product.shortlist") {
      const { data: product, error: readError } = await supabase.from("commerce_products")
        .select("id,metadata").eq("organization_id", organizationId).eq("id", input.productId).maybeSingle();
      if (readError) throw new Error("product_read_failed");
      if (!product) { responseBody = { action: input.action, status: "not_found" }; status = 404; }
      else {
        const metadata = product.metadata && typeof product.metadata === "object" && !Array.isArray(product.metadata) ? product.metadata as Record<string, unknown> : {};
        const { error } = await supabase.from("commerce_products").update({ metadata: { ...metadata, shortlisted: true, shortlisted_at: new Date().toISOString() }, updated_at: new Date().toISOString() })
          .eq("organization_id", organizationId).eq("id", input.productId);
        if (error) throw new Error("product_shortlist_failed");
        responseBody = { action: input.action, productId: input.productId, shortlisted: true };
      }
    } else if (input.action === "campaign.create") {
      const { data, error } = await supabase.from("commerce_campaigns").insert({
        organization_id: organizationId,
        creator_profile_id: input.creatorProfileId ?? null,
        offer_id: input.offerId ?? null,
        name: input.name,
        market: input.market ?? null,
        language: input.language ?? null,
        status: "draft",
      }).select("id,name,status,market,language").single();
      if (error || !data) throw new Error("campaign_create_failed");
      responseBody = { action: input.action, campaign: data };
    } else if (input.action === "experiment.create") {
      const { data, error } = await supabase.from("commerce_experiments").insert({
        organization_id: organizationId,
        campaign_id: input.campaignId ?? null,
        name: input.name,
        hypothesis: input.hypothesis,
        primary_metric: input.primaryMetric,
        minimum_sample_size: input.minimumSampleSize,
        minimum_window_seconds: input.minimumWindowSeconds,
        status: "draft",
      }).select("id,name,status,primary_metric").single();
      if (error || !data) throw new Error("experiment_create_failed");
      responseBody = { action: input.action, experiment: data };
    } else {
      const eventType = input.action === "provider.sync.request" ? "commerce.provider_sync_requested" : "commerce.reconciliation_requested";
      const entityId = randomUUID();
      const { error } = await supabase.from("event_log").insert({
        id: entityId,
        organization_id: organizationId,
        event_type: eventType,
        entity_kind: "creator_commerce_job_request",
        entity_id: entityId,
        payload: input,
        metadata: { request_id: requestId, idempotency_key: idempotencyKey },
      });
      if (error) throw new Error("commerce_job_request_failed");
      responseBody = { action: input.action, status: "queued", requestEventId: entityId };
      status = 202;
    }

    await supabase.from("idempotency_keys").update({ response_body: responseBody, status_code: status })
      .eq("organization_id", organizationId).eq("endpoint", ENDPOINT_TAG).eq("key", idempotencyKey);
    return status >= 400
      ? fail(status === 404 ? "not_found" : "forbidden", String(responseBody.reason ?? responseBody.status ?? "Ação recusada."), status, { requestId, details: responseBody })
      : ok(responseBody, { status, requestId });
  } catch {
    await supabase.from("idempotency_keys").delete().eq("organization_id", organizationId).eq("endpoint", ENDPOINT_TAG).eq("key", idempotencyKey).eq("status_code", 0);
    return fail("internal_error", "Não foi possível concluir a ação de Creator Commerce.", 500, { requestId });
  }
}
