import { z } from "zod";

const keyId = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "key_invalid_format");
const base = { key: keyId, label: z.string().min(1).max(80), required: z.boolean().default(false), deprecated: z.boolean().default(false) };
const options = z.array(z.string().min(1)).min(1).max(100);

export const pipelineFieldDefinitionSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("text"), max_length: z.number().int().positive().max(4096).optional() }),
  z.object({ ...base, type: z.literal("textarea"), max_length: z.number().int().positive().max(16384).optional() }),
  z.object({ ...base, type: z.literal("number"), min: z.number().optional(), max: z.number().optional() }),
  z.object({ ...base, type: z.literal("currency"), currency: z.string().regex(/^[A-Z]{3}$/).default("BRL") }),
  z.object({ ...base, type: z.literal("date") }),
  z.object({ ...base, type: z.literal("boolean") }),
  z.object({ ...base, type: z.literal("select"), options }),
  z.object({ ...base, type: z.literal("multiselect"), options }),
  z.object({ ...base, type: z.literal("url") }),
  z.object({ ...base, type: z.literal("email") }),
]);
export type PipelineFieldDefinition = z.infer<typeof pipelineFieldDefinitionSchema>;
export const pipelineFieldsSchema = z.array(pipelineFieldDefinitionSchema).max(30);
