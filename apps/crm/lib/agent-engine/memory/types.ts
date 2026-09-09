import { z } from "zod";

import {
  authorityDomainSchema,
  memoryRiskSchema,
  type AuthorityDomain,
  type MemoryRisk,
} from "../platform/contracts";

export const semanticMemoryTypeSchema = z.enum([
  "preference",
  "interest",
  "constraint",
  "relationship",
  "behavior",
  "commercial_context",
]);
export type SemanticMemoryType = z.infer<typeof semanticMemoryTypeSchema>;

export const semanticMemoryRecordSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  contactId: z.string().min(1),
  sourceId: z.string().min(1),
  sourceVersion: z.string().min(1),
  type: semanticMemoryTypeSchema,
  authorityDomain: authorityDomainSchema,
  risk: memoryRiskSchema,
  actionable: z.boolean(),
  confidence: z.number().finite().min(0).max(1),
  validFrom: z.string().nullable(),
  validUntil: z.string().nullable(),
  text: z.string().min(1),
});

export interface SemanticMemoryRecord {
  id: string;
  organizationId: string;
  contactId: string;
  sourceId: string;
  sourceVersion: string;
  type: SemanticMemoryType;
  authorityDomain: AuthorityDomain;
  risk: MemoryRisk;
  actionable: boolean;
  confidence: number;
  validFrom: string | null;
  validUntil: string | null;
  text: string;
}

export const memorySearchInputSchema = z.object({
  organizationId: z.string().min(1),
  contactId: z.string().min(1),
  query: z.string().min(1),
  topK: z.number().int().positive(),
});

export interface MemorySearchInput {
  organizationId: string;
  contactId: string;
  query: string;
  topK: number;
}

export const memoryContactInputSchema = z.object({
  organizationId: z.string().min(1),
  contactId: z.string().min(1),
});
