import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildExportPackage } from "@/lib/lgpd/export-package";

const read = (path: string) => readFileSync(path, "utf8");

describe("LGPD export PII and retention contract", () => {
  it("mantém PII fora do manifest e limita retenção por expiração", () => {
    const payload = { contact: { email: "titular@example.com", phone: "+351911111111" } };
    const result = buildExportPackage({ requestId: "r1", organizationId: "org1", generatedAt: "2026-09-10T20:00:00.000Z", files: [{ path: "data.json", content: JSON.stringify(payload) }] });
    const manifest = JSON.stringify(result.manifest);
    expect(manifest).not.toContain("titular@example.com");
    expect(manifest).not.toContain("+351911111111");
    expect(result.manifest.provenance.signed_pades).toBe(false);
    expect(read("apps/crm/workers/lgpd-export-worker.ts")).toContain("LGPD_EXPORT_EXPIRES_HOURS");
  });

  it("não grava erro bruto nem payload em logs/auditoria do worker", () => {
    const worker = read("apps/crm/workers/lgpd-export-worker.ts");
    const events = read("apps/crm/lib/lgpd/export-events.ts");
    expect(worker).toContain("error_hash: sha256");
    expect(worker).toContain('error_message: "export_failed"');
    expect(worker).not.toContain("error_message: detail.slice");
    expect(events).toContain("without putting payload/PII");
    expect(events).not.toMatch(/metadata:[^}]*payload/i);
  });
});
