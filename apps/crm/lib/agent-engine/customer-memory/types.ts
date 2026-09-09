import { z } from "zod";

export const CustomerMemorySourceSchema = z.enum([
  "crm",
  "order",
  "customer_confirmed",
  "conversation_derived",
  "system",
]);
export type CustomerMemorySource = z.infer<typeof CustomerMemorySourceSchema>;

export const CustomerMemoryFactSchema = z.object({
  value: z.string().trim().min(1).max(1000),
  source: CustomerMemorySourceSchema,
  confidence: z.number().min(0).max(1),
  confirmed: z.boolean(),
  conflicted: z.boolean(),
  actionable: z.boolean(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime().nullable(),
  sourceRef: z.string().max(500).nullable(),
});
export type CustomerMemoryFact = z.infer<typeof CustomerMemoryFactSchema>;

const IdentitySchema = z.object({
  displayName: z.string().trim().min(1).max(200).nullable().optional(),
  primaryPhone: z.string().trim().min(3).max(40).nullable().optional(),
});

export const CustomerQuickMemorySchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  identity: IdentitySchema,
  addresses: z.array(CustomerMemoryFactSchema).max(5),
  preferences: z.array(CustomerMemoryFactSchema).max(20),
  habitualOrders: z.array(CustomerMemoryFactSchema).max(10),
  recentOrderRefs: z.array(z.string().trim().min(1).max(200)).max(10),
  relationshipSummary: z.string().max(2000).nullable(),
  channelFacts: z.array(CustomerMemoryFactSchema).max(10),
  importantEvents: z.array(CustomerMemoryFactSchema).max(20),
  updatedAt: z.string().datetime(),
});

export type CustomerQuickMemory = z.infer<typeof CustomerQuickMemorySchema>;

export type CustomerMemoryField =
  | "recent_order_ref"
  | "payment_state"
  | "consent_state"
  | "address"
  | "phone"
  | "preference"
  | "habitual_order"
  | "relationship_summary"
  | "channel_fact"
  | "important_event";

export type CustomerMemoryAuthority = "authoritative" | "mutable" | "derived";
