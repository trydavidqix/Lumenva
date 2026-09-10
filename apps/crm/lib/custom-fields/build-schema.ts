import { z } from "zod";
import type { PipelineFieldDefinition } from "./schema";

export function buildLeadCustomFieldsSchema(fields: PipelineFieldDefinition[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    if (f.deprecated) continue;
    let valueSchema: z.ZodTypeAny;
    switch (f.type) {
      case "text": valueSchema = z.string().max(f.max_length ?? 4096); break;
      case "textarea": valueSchema = z.string().max(f.max_length ?? 16384); break;
      case "number": valueSchema = z.number().refine(v => (f.min == null || v >= f.min) && (f.max == null || v <= f.max), "out_of_range"); break;
      case "currency": valueSchema = z.number().int().nonnegative(); break;
      case "date": valueSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/); break;
      case "boolean": valueSchema = z.boolean(); break;
      case "select": valueSchema = z.enum(f.options as [string, ...string[]]); break;
      case "multiselect": valueSchema = z.array(z.enum(f.options as [string, ...string[]])).max(f.options.length); break;
      case "url": valueSchema = z.string().url(); break;
      case "email": valueSchema = z.string().email(); break;
    }
    shape[f.key] = f.required ? valueSchema : valueSchema.optional().nullable();
  }
  return z.object(shape).strict();
}
