import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { loadP12Fixture, verifyPdfSignature } from "@/lib/lgpd/pades-signer";

describe("PAdES scaffold", () => {
  it("ships a test-only PKCS#12 fixture", () => {
    const path = "apps/crm/tests/fixtures/pades-test.p12";
    expect(existsSync(path)).toBe(true);
    expect(loadP12Fixture(path).length).toBeGreaterThan(0);
  });

  it("fails closed when the signing backend is not provisioned", () => {
    expect(verifyPdfSignature(Buffer.from("%PDF-test"))).toEqual({
      valid: false,
      reason: "signature_backend_unavailable",
    });
    expect(verifyPdfSignature(Buffer.alloc(0))).toEqual({
      valid: false,
      reason: "empty_document",
    });
  });
});
