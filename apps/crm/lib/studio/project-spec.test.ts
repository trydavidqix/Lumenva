import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createProjectSpec,
  createStudioVariants,
  issueClientPortalToken,
  canUseClientPortalToken,
  type ProjectSpec,
} from "@/lib/studio/project-spec";

const project: ProjectSpec = {
  project_id: "project-1", organization_id: "org-1", client_ref: "client-1",
  owner_agent_id: "agent-1", title: "Campanha", objective: "Objetivo", scope: ["conceito"],
  constraints: ["sem claims"], deliverables: ["proposta"], consent_refs: ["consent-1"],
  status: "DRAFT", version: 1, source_refs: ["brief-1"], evidence_refs: ["evidence-1"],
};

describe("ProjectSpec Studio Commercial", () => {
  it("cria ProjectSpec com status inicial DRAFT e briefing", () => {
    const result = createProjectSpec({ organization_id: "org-1", client_ref: "client-1", title: "Campanha", objective: "Objetivo", scope: ["conceito"], constraints: ["UNKNOWN"], deliverables: ["proposta"], consent_refs: ["consent-1"], source_refs: ["brief-1"], evidence_refs: ["evidence-1"] });
    expect(result.project_id).toMatch(/^[0-9a-f-]{36}$/); expect(result.status).toBe("DRAFT"); expect(result.version).toBe(1); expect(result.constraints).toContain("UNKNOWN");
  });
  it("gera exatamente variantes A, B e C versionadas", () => {
    const variants = createStudioVariants(project, { A: "Direção A", B: "Direção B", C: "Direção C" });
    expect(variants.map((v) => v.label)).toEqual(["A", "B", "C"]); expect(new Set(variants.map((v) => v.variant_id)).size).toBe(3); expect(variants.every((v) => v.project_id === project.project_id && v.status === "DRAFT")).toBe(true);
  });
  it("emite token opaco e persiste apenas hash", () => {
    const issued = issueClientPortalToken({ project, scope: "APPROVE", expires_at: "2026-10-01T00:00:00.000Z", created_by: "owner-1" });
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(issued.record.token_hash).toBe(createHash("sha256").update(issued.token).digest("hex")); expect(JSON.stringify(issued.record)).not.toContain(issued.token);
    expect(canUseClientPortalToken(issued.record, issued.token, { project_id: project.project_id, organization_id: project.organization_id, required_scope: "APPROVE", now: "2026-09-12T00:00:00.000Z" })).toBe(true);
  });
  it("recusa token expirado, revogado, cross-project e scope maior", () => {
    const issued = issueClientPortalToken({ project, scope: "VIEW", expires_at: "2026-10-01T00:00:00.000Z", created_by: "owner-1" });
    const base = { project_id: project.project_id, organization_id: project.organization_id, required_scope: "VIEW" as const, now: "2026-10-02T00:00:00.000Z" };
    expect(canUseClientPortalToken(issued.record, issued.token, base)).toBe(false);
    expect(canUseClientPortalToken({ ...issued.record, revoked_at: "2026-09-10T00:00:00.000Z" }, issued.token, { ...base, now: "2026-09-12T00:00:00.000Z" })).toBe(false);
    expect(canUseClientPortalToken(issued.record, issued.token, { ...base, project_id: "project-2", now: "2026-09-12T00:00:00.000Z" })).toBe(false);
    expect(canUseClientPortalToken(issued.record, issued.token, { ...base, required_scope: "APPROVE", now: "2026-09-12T00:00:00.000Z" })).toBe(false);
  });
});
