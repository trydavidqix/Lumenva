import type { SupabaseClient } from "@supabase/supabase-js";
import type { StripePlanStatus, StripeWebhookStore } from "./stripe-webhook";

type Row = Record<string, unknown>;
type Result = { error: { code?: string; message: string } | null };
type Query = { select: (s: string) => Query; eq: (c: string, v: unknown) => Query; order: (c: string, o: { ascending: boolean }) => Query; limit: (n: number) => Query; maybeSingle: () => Promise<{ data: Row | null; error: { code?: string; message: string } | null }>; insert: (v: Row) => Query; upsert: (v: Row, o?: { onConflict?: string }) => Query };

export function createStripeWebhookStore(client: SupabaseClient): StripeWebhookStore {
  const db = client as unknown as { from: (table: string) => Query };
  return {
    async resolveOrganizationId({ customerId, subscriptionId, metadata }) {
      const hinted = typeof metadata.organization_id === "string" ? metadata.organization_id : null;
      if (hinted) {
        const { data } = await db.from("organizations").select("id").eq("id", hinted).maybeSingle();
        if (data?.id === hinted) return hinted;
      }
      if (subscriptionId) {
        const { data } = await db.from("organization_plan").select("organization_id").eq("provider_subscription_id", subscriptionId).maybeSingle();
        if (typeof data?.organization_id === "string") return data.organization_id;
      }
      if (customerId) {
        const { data } = await db.from("organization_plan").select("organization_id").eq("provider_customer_id", customerId).maybeSingle();
        if (typeof data?.organization_id === "string") return data.organization_id;
      }
      return null;
    },
    async recordEntitlementEvent(input) {
      const result = await db.from("entitlement_events").insert({ organization_id: input.organizationId, event_type: input.eventType, provider_event_id: input.providerEventId, effective_at: input.occurredAt, metadata: input.payload });
      const outcome = result as unknown as Result;
      if (outcome.error?.code === "23505") return "duplicate";
      if (outcome.error) throw new Error(outcome.error.message);
      return "inserted";
    },
    async getCurrentPlan(organizationId) {
      const { data, error } = await db.from("organization_plan").select("status, effective_at, provider_event_id, plans!inner(slug)").eq("organization_id", organizationId).order("effective_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const planSlug = (data.plans as Row | undefined)?.slug;
      if (typeof planSlug !== "string" || typeof data.status !== "string" || typeof data.effective_at !== "string" || typeof data.provider_event_id !== "string") return null;
      return { status: data.status as StripePlanStatus, planSlug, providerEventId: data.provider_event_id, occurredAt: data.effective_at };
    },
    async assertEntitlementGate({ organizationId, planSlug }) {
      const { data, error } = await db.from("plans").select("id, slug, is_active").eq("slug", planSlug).eq("is_active", true).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data?.id) throw new Error(`[stripe] canonical entitlement gate denied plan for ${organizationId}`);
    },
    async upsertOrganizationPlan(input) {
      const plan = await db.from("plans").select("id").eq("slug", input.planSlug).eq("is_active", true).maybeSingle();
      if (plan.error) throw new Error(plan.error.message);
      if (!plan.data?.id) throw new Error("[stripe] canonical plan not found");
      const result = await db.from("organization_plan").upsert({ organization_id: input.organizationId, plan_id: plan.data.id, status: input.status, effective_at: input.occurredAt, provider_customer_id: input.providerCustomerId, provider_subscription_id: input.providerSubscriptionId, provider_event_id: input.providerEventId }, { onConflict: "organization_id" });
      const outcome = result as unknown as Result;
      if (outcome.error) throw new Error(outcome.error.message);
    },
  };
}
