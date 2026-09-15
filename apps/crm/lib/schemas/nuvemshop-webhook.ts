import { z } from "zod";

const STORE_ID = /^[0-9]{1,32}$/;
const MAX_WEBHOOK_BYTES = 256 * 1024;

const NuvemshopWebhookObjectSchema = z
  .record(z.string(), z.unknown())
  .superRefine((value, ctx) => {
    const storeId = value.store_id;
    if (storeId === undefined || !STORE_ID.test(String(storeId))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["store_id"], message: "invalid store_id" });
    }
  });

export type NuvemshopWebhookObject = z.infer<typeof NuvemshopWebhookObjectSchema>;

export type NuvemshopWebhookParseResult =
  | { success: true; data: NuvemshopWebhookObject }
  | { success: false; code: "payload_too_large" | "invalid_json" | "invalid_payload" };

/** Validate untrusted provider input without changing the bytes used for HMAC. */
export function parseNuvemshopWebhookPayload(rawBody: string): NuvemshopWebhookParseResult {
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) {
    return { success: false, code: "payload_too_large" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { success: false, code: "invalid_json" };
  }

  const result = NuvemshopWebhookObjectSchema.safeParse(parsed);
  return result.success
    ? result
    : { success: false, code: "invalid_payload" };
}
