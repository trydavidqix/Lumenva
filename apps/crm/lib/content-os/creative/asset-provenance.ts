import { z } from "zod";

export const assetProvenanceSchema = z.object({
  source_url: z.string().url().refine((value) => value.startsWith("https://"), "source_url must use HTTPS").nullable().optional(),
  attribution: z.string().trim().max(500).nullable().optional(),
  license: z.string().trim().max(120).nullable().optional(),
}).strict();

export type AssetProvenance = z.infer<typeof assetProvenanceSchema>;
