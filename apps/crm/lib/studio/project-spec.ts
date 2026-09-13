import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export type ProjectStatus = "DRAFT" | "BRIEFING" | "IN_REVIEW" | "DECISION_REQUIRED" | "APPROVED" | "REQUEST_CHANGES" | "DELIVERING" | "DELIVERED" | "CANCELLED";
export type VariantLabel = "A" | "B" | "C";
export type PortalScope = "VIEW" | "COMMENT" | "APPROVE" | "REQUEST_CHANGES";

export type ProjectSpec = {
  project_id: string; organization_id: string; client_ref: string; owner_agent_id?: string;
  title: string; objective: string; scope: string[]; constraints: string[]; deliverables: string[];
  budget_ref?: string; deadline?: string; consent_refs: string[]; status: ProjectStatus; version: number;
  source_refs: string[]; evidence_refs: string[];
};

export type StudioVariant = {
  variant_id: string; project_id: string; label: VariantLabel; version: string; summary: string;
  assumptions: string[]; limitations: string[]; artifact_refs: string[]; source_refs: string[];
  evidence_refs: string[]; status: "DRAFT" | "PRESENTED" | "SELECTED" | "REJECTED" | "SUPERSEDED";
};

export type ClientPortalToken = {
  token_id: string; project_id: string; organization_id: string; token_hash: string;
  scope: PortalScope; expires_at: string; revoked_at?: string; single_use?: boolean; created_by: string;
  used_at?: string;
};

type ProjectInput = Omit<ProjectSpec, "project_id" | "status" | "version"> & { project_id?: string };
export function createProjectSpec(input: ProjectInput): ProjectSpec {
  return { ...input, project_id: input.project_id ?? randomUUID(), status: "DRAFT", version: 1 };
}

export function createStudioVariants(project: ProjectSpec, summaries: Record<VariantLabel, string>): StudioVariant[] {
  return (["A", "B", "C"] as const).map((label) => ({ variant_id: randomUUID(), project_id: project.project_id, label, version: `${project.version}.0`, summary: summaries[label], assumptions: [], limitations: [], artifact_refs: [], source_refs: project.source_refs, evidence_refs: project.evidence_refs, status: "DRAFT" as const }));
}

export function issueClientPortalToken(input: { project: ProjectSpec; scope: PortalScope; expires_at: string; created_by: string; single_use?: boolean }): { token: string; record: ClientPortalToken } {
  if (!input.created_by.trim()) throw new Error("created_by is required");
  const expiresAt = Date.parse(input.expires_at); if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error("Client portal token must expire in the future");
  const token = randomBytes(32).toString("base64url");
  return { token, record: { token_id: randomUUID(), project_id: input.project.project_id, organization_id: input.project.organization_id, token_hash: hashToken(token), scope: input.scope, expires_at: input.expires_at, ...(input.single_use === undefined ? {} : { single_use: input.single_use }), created_by: input.created_by } };
}

export function canUseClientPortalToken(record: ClientPortalToken, token: string, request: { project_id: string; organization_id: string; required_scope: PortalScope; now?: string }): boolean {
  if (record.project_id !== request.project_id || record.organization_id !== request.organization_id || record.revoked_at) return false;
  if (record.single_use && record.used_at) return false; const expiresAt = Date.parse(record.expires_at); const now = Date.parse(request.now ?? new Date().toISOString()); if (!Number.isFinite(expiresAt) || !Number.isFinite(now) || expiresAt <= now) return false;
  const expected = Buffer.from(record.token_hash, "hex"); const actual = Buffer.from(hashToken(token), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  const allowed = record.scope === request.required_scope || (record.scope === "COMMENT" && request.required_scope === "VIEW"); if (allowed && record.single_use) record.used_at = request.now ?? new Date().toISOString(); return allowed;
}

function hashToken(token: string): string { return createHash("sha256").update(token, "utf8").digest("hex"); }
