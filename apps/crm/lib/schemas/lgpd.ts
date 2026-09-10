import { z } from "zod";

/** Query contract for the provider-free LGPD export scaffold. */
export const lgpdExportQuerySchema = z.object({
  format: z.enum(["json", "pdf"]).default("json"),
});

export type LgpdExportQuery = z.infer<typeof lgpdExportQuerySchema>;
