import { z } from "zod";

export const featureModeSchema = z.enum(["off", "shadow", "canary", "on"]);
export type FeatureMode = z.infer<typeof featureModeSchema>;

export const memoryRiskSchema = z.enum(["low", "medium", "high"]);
export type MemoryRisk = z.infer<typeof memoryRiskSchema>;

export const authorityDomainSchema = z.enum([
  "commercial_status",
  "customer_preference",
  "consent",
  "legal",
  "product_policy",
  "relationship",
  "behavior",
  "operational_state",
]);
export type AuthorityDomain = z.infer<typeof authorityDomainSchema>;

export const aiPlatformFeatureSchema = z.enum([
  "langsmith",
  "mem0",
  "llamaindex",
  "graphiti",
  "external_guardrails",
  "n8n",
  "langgraph_proposal_workflow",
  "langgraph_automation_workflow",
  "langgraph_lead_scoring_workflow",
]);
export type AiPlatformFeature = z.infer<typeof aiPlatformFeatureSchema>;

export const projectionEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  organizationId: z.string().uuid(),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  sourceVersion: z.string().min(1),
  occurredAt: z.string().datetime({ offset: true }),
  projectionType: z.enum(["memory", "graph"]),
  projectionVersion: z.number().int().positive(),
  idempotencyKey: z.string().min(1),
  payload: z.unknown(),
});
export type ProjectionEnvelope<TPayload = unknown> = Omit<
  z.infer<typeof projectionEnvelopeSchema>,
  "payload"
> & { payload: TPayload };

export const contextRequestSchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  conversationId: z.string().uuid(),
  agentId: z.string().uuid(),
  query: z.string().min(1),
  now: z.string().datetime({ offset: true }),
});
export type ContextRequest = z.infer<typeof contextRequestSchema>;

export const contextItemSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  authorityDomain: authorityDomainSchema,
  authorityLevel: z.number().finite(),
  confidence: z.number().min(0).max(1),
  occurredAt: z.string().datetime({ offset: true }).nullable(),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
  risk: memoryRiskSchema,
  /** Missing authority is never prompt-eligible; providers must propagate it explicitly. */
  actionable: z.boolean().optional(),
  sourceId: z.string().min(1),
  text: z.string().min(1),
});
export type ContextItem = z.infer<typeof contextItemSchema>;

export const contextProviderResultSchema = z.object({
  provider: z.string().min(1),
  items: z.array(contextItemSchema),
  degraded: z.boolean().default(false),
  reason: z.string().min(1).optional(),
});
export type ContextProviderResult = z.infer<typeof contextProviderResultSchema>;
