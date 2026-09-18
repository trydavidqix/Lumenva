import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { isPadesConfigured, loadP12Fixture, isApprovedTestP12, verifyPdfSignature } from "@/lib/lgpd/pades-signer";

afterEach(() => vi.unstubAllEnvs());

describe("PAdES scaffold", () => {
  it("carrega e identifica a fixture PKCS#12 de teste", () => {
    const fixture = loadP12Fixture("apps/crm/tests/fixtures/pades-test.p12");
    expect(existsSync("apps/crm/tests/fixtures/pades-test.p12")).toBe(true);
    expect(isApprovedTestP12(fixture)).toBe(true);
  });

  it("falha fechado mesmo contra a fixture quando backend PAdES não existe", () => {
    const fixture = loadP12Fixture("apps/crm/tests/fixtures/pades-test.p12");
    expect(verifyPdfSignature(Buffer.from("%PDF-test"), fixture)).toEqual({ valid: false, reason: "signature_backend_unavailable" });
    expect(verifyPdfSignature(Buffer.from("%PDF-test"), Buffer.from("wrong-fixture"))).toEqual({ valid: false, reason: "invalid_fixture" });
    expect(verifyPdfSignature(Buffer.alloc(0), fixture)).toEqual({ valid: false, reason: "empty_document" });
  });

  it("não trata a presença da chave como backend PAdES configurado", () => {
    vi.stubEnv("LGPD_SIGNING_KEY", "configured-but-unsupported");
    expect(isPadesConfigured()).toBe(false);
  });
});
