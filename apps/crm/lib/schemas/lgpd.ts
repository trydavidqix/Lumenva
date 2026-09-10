import { z } from "zod";

/** Formats supported by the provider-free F6 export route. */
export const lgpdExportQuerySchema = z.object({
  format: z.enum(["json", "zip", "pdf"]).default("zip"),
});

export const lgpdExportPackageSchema = z.object({
  version: z.literal("f6"),
  request_id: z.string().uuid(),
  generated_at: z.string().datetime(),
  signed_pades: z.literal(false),
  files: z.array(z.object({ name: z.string().min(1), media_type: z.string().min(1) })),
});

export type LgpdExportQuery = z.infer<typeof lgpdExportQuerySchema>;
export type LgpdExportPackage = z.infer<typeof lgpdExportPackageSchema>;
