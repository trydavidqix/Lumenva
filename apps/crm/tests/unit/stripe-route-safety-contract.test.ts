import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const route = readFileSync(resolve(process.cwd(), "app/api/v1/stripe/webhook/route.ts"), "utf8");

describe("Stripe route safety contract", () => {
  it("keeps the raw processor error server-side and returns canonical envelopes", () => {
    expect(route).toContain("console.error");
    expect(route).toContain("return fail(");
    expect(route).toContain('"Invalid Stripe webhook."');
    expect(route).toContain('"Stripe webhook unavailable."');
    expect(route).not.toMatch(/return fail\([^\n]+message,\s*status/);
  });

  it("reads the signed provider header and never accepts a client tenant header", () => {
    expect(route).toContain('req.headers.get("stripe-signature")');
    expect(route).not.toContain('req.headers.get("organization_id")');
  });
});
