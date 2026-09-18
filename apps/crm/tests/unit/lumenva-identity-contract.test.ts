import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("contrato de identidade Lumenva", () => {
  it("mantém a matriz de compatibilidade versionada", () => {
    const matrix = read("docs/audits/lumenva-identity-compatibility-matrix-2026-09-15.md");

    for (const token of ["Lumenva", "DeskcommCRM", "x-lumenva-signature", "x-deskcomm-signature", "crm_leads"]) {
      expect(matrix).toContain(token);
    }
  });

  it("mantém os nomes novos dos pacotes privados", () => {
    const crm = JSON.parse(read("apps/crm/package.json")) as { name: string; private: boolean };
    const site = JSON.parse(read("apps/site/package.json")) as { name: string; private: boolean };

    expect(crm).toMatchObject({ name: "lumenva-crm", private: true });
    expect(site).toMatchObject({ name: "lumenva-website", private: true });
  });

  it("preserva os identificadores técnicos legados que não podem ser renomeados cosmeticamente", () => {
    expect(read("docker-compose.prod.yml")).toContain("deskcommcrm:latest");
    expect(read("docs/runbooks/deploy.md")).toContain("deskcommcrm_mem0-postgres-data");
    expect(read("supabase/baseline.sql")).toContain("crm_leads");
  });
});
