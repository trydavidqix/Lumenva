import { z } from "zod";

import { authorityDomainSchema, memoryRiskSchema, type AuthorityDomain, type MemoryRisk } from "../platform/contracts";

export const graphEpisodeSourceTypeSchema = z.enum(["message", "text", "json"]);
export type GraphEpisodeSourceType = z.infer<typeof graphEpisodeSourceTypeSchema>;

/**
 * A single unit of raw context handed to the temporal graph projection
 * (Graphiti/FalkorDB) so it can extract entities/edges and time-anchor them.
 *
 * `organizationId` is the only tenant signal carried here. The trusted
 * adapter that implements `GraphContextPort` derives FalkorDB's `group_id`
 * from `organizationId` internally — callers never supply a graph-native
 * group/tenant identifier directly.
 */
export const graphEpisodeSchema = z.object({
  organizationId: z.string().min(1),
  sourceId: z.string().min(1),
  sourceVersion: z.string().min(1),
  name: z.string().min(1),
  body: z.string().min(1),
  sourceType: graphEpisodeSourceTypeSchema,
  sourceDescription: z.string().min(1),
  referenceTime: z.string().datetime({ offset: true }),
});

export interface GraphEpisode {
  organizationId: string;
  sourceId: string;
  sourceVersion: string;
  name: string;
  body: string;
  sourceType: GraphEpisodeSourceType;
  sourceDescription: string;
  referenceTime: string;
}

/**
 * A fact retrieved from the temporal graph. Mirrors the authority/risk
 * envelope used by `SemanticMemoryRecord` (Mem0, Phase 2) so downstream
 * context-ranking logic can treat graph facts and semantic memories
 * uniformly. Per Phase 4 doctrine, no `GraphFact` — regardless of
 * `confidence` or `authorityDomain` — may by itself authorize a HIGH-risk
 * action while the feature is OFF/SHADOW.
 */
export const graphFactSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  sourceId: z.string().min(1),
  validFrom: z.string().datetime({ offset: true }).nullable(),
  validUntil: z.string().datetime({ offset: true }).nullable(),
  confidence: z.number().finite().min(0).max(1),
  authorityDomain: authorityDomainSchema,
  risk: memoryRiskSchema,
});

export interface GraphFact {
  id: string;
  text: string;
  sourceId: string;
  validFrom: string | null;
  validUntil: string | null;
  confidence: number;
  authorityDomain: AuthorityDomain;
  risk: MemoryRisk;
}

export const graphSearchInputSchema = z.object({
  organizationId: z.string().min(1),
  query: z.string().min(1),
  limit: z.number().int().positive(),
});

export interface GraphSearchInput {
  organizationId: string;
  query: string;
  limit: number;
}

export const organizationIdSchema = z.string().min(1);
