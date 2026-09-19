import { describe, expect, it } from "vitest";
import { parseNuvemshopWebhookPayload } from "@/lib/schemas/nuvemshop-webhook";

describe("Nuvemshop webhook boundary", () => {
  it("validates an object and preserves the original payload shape", () => {
    const result = parseNuvemshopWebhookPayload(JSON.stringify({ store_id: 42, id: 7, customer: { id: 9 } }));
    expect(result).toEqual({
      success: true,
      data: { store_id: 42, id: 7, customer: { id: 9 } },
    });
  });

  it.each([
    ["[]", "invalid_payload"],
    ["{}", "invalid_payload"],
    [JSON.stringify({ store_id: "not-numeric" }), "invalid_payload"],
    ["not-json", "invalid_json"],
  ])("rejects unsafe provider payload (%s)", (rawBody, code) => {
    expect(parseNuvemshopWebhookPayload(rawBody)).toEqual({ success: false, code });
  });
});
