import { describe, expect, it, vi } from "vitest";

import { audit } from "@/lib/audit";
import { buildExportPackage, verifyExportPackage } from "@/lib/lgpd/export-package";
import { recordExportEvent } from "@/lib/lgpd/export-events";

vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

describe("LGPD export provider-free flow", () => {
  it("empacota, verifica e regista geração sem PII", async () => {
    const files = [{ path: "export.json", content: JSON.stringify({ contact: { id: "c1" } }) }];
    const packaged = buildExportPackage({
      requestId: "request-1",
      organizationId: "org-1",
      generatedAt: "2026-09-10T20:00:00.000Z",
      files,
    });
    expect(verifyExportPackage(packaged.manifest, files).valid).toBe(true);
    await recordExportEvent({
      event: "generated",
      requestId: "request-1",
      organizationId: "org-1",
      exportSha256: packaged.sha256,
      manifestSha256: packaged.manifest.provenance.manifest_sha256,
      fileCount: files.length,
    });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "lgpd.export_generated",
      resourceType: "lgpd_export",
      resourceId: "request-1",
      metadata: expect.objectContaining({ signed_pades: false, file_count: 1 }),
    }));
    expect(JSON.stringify(vi.mocked(audit).mock.calls[0]?.[0])).not.toContain("contact@example");
  });

  it("regista falha apenas por código, sem payload", async () => {
    await recordExportEvent({ event: "failed", requestId: "request-2", organizationId: "org-1", errorCode: "verification_failed" });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "lgpd.export_failed",
      metadata: expect.objectContaining({ error_code: "verification_failed" }),
    }));
  });

  it("fecha JSON → ZIP → manifest → verify e audita tampering", async () => {
    const files = [{ path: "export.json", content: JSON.stringify({ contact_id: "contact-fixture" }) }];
    const packaged = buildExportPackage({
      requestId: "request-e2e",
      organizationId: "org-1",
      generatedAt: "2026-09-10T20:30:00.000Z",
      files,
    });
    expect(packaged.zip.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(verifyExportPackage(packaged.manifest, files)).toEqual({ valid: true, errors: [] });

    const tamperedManifest = { ...packaged.manifest, organization_id: "org-attacker" };
    const verification = verifyExportPackage(tamperedManifest, files);
    expect(verification).toEqual({ valid: false, errors: ["manifest_hash_mismatch"] });
    await recordExportEvent({
      event: "failed",
      requestId: "request-e2e",
      organizationId: "org-1",
      exportSha256: packaged.sha256,
      manifestSha256: packaged.manifest.provenance.manifest_sha256,
      errorCode: verification.errors[0],
    });
    expect(audit).toHaveBeenLastCalledWith(expect.objectContaining({
      action: "lgpd.export_failed",
      resourceId: "request-e2e",
      metadata: expect.objectContaining({ error_code: "manifest_hash_mismatch" }),
    }));
  });
});
