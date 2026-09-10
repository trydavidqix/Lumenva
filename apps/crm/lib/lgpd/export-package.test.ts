import { describe, expect, it } from "vitest";

import { buildExportPackage, sha256Hex, verifyExportPackage } from "@/lib/lgpd/export-package";

describe("LGPD export package", () => {
  it("emite ZIP com manifest/provenance e verifica hashes", () => {
    const files = [{ path: "export.json", content: JSON.stringify({ contact: "fixture" }) }];
    const result = buildExportPackage({
      requestId: "request-1",
      organizationId: "org-1",
      generatedAt: "2026-09-10T18:00:00.000Z",
      files,
    });
    expect(result.zip.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(result.manifest.provenance).toMatchObject({
      generator: "lumenva-lgpd-export",
      signed_pades: false,
    });
    expect(verifyExportPackage(result.manifest, files)).toEqual({ valid: true, errors: [] });
  });

  it("rejeita alteração de conteúdo após o manifesto", () => {
    const files = [{ path: "export.json", content: "original" }];
    const result = buildExportPackage({
      requestId: "request-2",
      organizationId: "org-1",
      generatedAt: "2026-09-10T18:00:00.000Z",
      files,
    });
    const verification = verifyExportPackage(result.manifest, [{ path: "export.json", content: "tampered" }]);
    expect(verification.valid).toBe(false);
    expect(verification.errors).toContain("hash_mismatch:export.json");
  });

  it("registra o hash do PDF sem declarar assinatura PAdES válida", () => {
    const pdf = Buffer.from("%PDF-test-fixture");
    const result = buildExportPackage({
      requestId: "req-pdf",
      organizationId: "org-a",
      generatedAt: "2026-09-10T00:00:00.000Z",
      files: [{ path: "report.pdf", content: pdf }],
      signedPades: false,
      pdfSha256: sha256Hex(pdf),
    });
    expect(result.manifest.provenance.pdf_sha256).toBe(sha256Hex(pdf));
    expect(result.manifest.provenance.signed_pades).toBe(false);
  });
});
