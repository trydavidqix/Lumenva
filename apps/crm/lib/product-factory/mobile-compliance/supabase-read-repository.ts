import { createAdminClient } from "@/lib/supabase/admin";
import type { ComplianceFinding, MobileComplianceReport } from "./contracts";
import type { MobileComplianceRepository } from "./read-model";

type DbError = { code?: string; message: string };
type DbResult<T> = { data: T | null; error: DbError | null };
type Row = Record<string, unknown>;
type Query = {
  select(columns?: string): Query;
  eq(column: string, value: unknown): Query;
  order(column: string, options?: { ascending?: boolean }): Query;
  limit(value: number): Promise<DbResult<Row[]>>;
  maybeSingle(): Promise<DbResult<Row>>;
};

function query(table: string): Query {
  return createAdminClient().from(table as never) as unknown as Query;
}

function string(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`mobile_compliance_invalid_row:${key}`);
  return value;
}

function number(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number") throw new Error(`mobile_compliance_invalid_row:${key}`);
  return value;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapReport(row: Row): MobileComplianceReport {
  const findings = Array.isArray(row.findings) ? row.findings as ComplianceFinding[] : [];
  return {
    reportId: string(row, "report_id"),
    organizationId: string(row, "tenant_id"),
    projectId: string(row, "project_id"),
    buildRef: string(row, "build_ref"),
    artifactRef: string(row, "artifact_ref"),
    artifactHash: string(row, "artifact_hash"),
    platform: string(row, "platform") as MobileComplianceReport["platform"],
    store: string(row, "store") as MobileComplianceReport["store"],
    policyVersion: string(row, "policy_version"),
    policySnapshotHash: string(row, "policy_snapshot_hash"),
    findings,
    evidenceRefs: stringArray(row.evidence_refs),
    criticalCount: number(row, "critical_count"),
    highCount: number(row, "high_count"),
    mediumCount: number(row, "medium_count"),
    lowCount: number(row, "low_count"),
    verdict: string(row, "verdict") as MobileComplianceReport["verdict"],
    createdAt: string(row, "created_at"),
  };
}

function mapFinding(row: Row): ComplianceFinding {
  return {
    ruleId: string(row, "rule_id"),
    platform: string(row, "platform") as ComplianceFinding["platform"],
    store: string(row, "store") as ComplianceFinding["store"],
    severity: string(row, "severity") as ComplianceFinding["severity"],
    source: string(row, "source") as ComplianceFinding["source"],
    verification: string(row, "verification") as ComplianceFinding["verification"],
    title: string(row, "title"),
    description: string(row, "description"),
    resource: string(row, "resource"),
    ...(typeof row.line === "number" ? { line: row.line } : {}),
    evidenceRefs: stringArray(row.evidence_refs),
    fingerprint: string(row, "fingerprint"),
    autofixable: row.autofixable === true,
  };
}

function fail(error: DbError | null): never {
  throw new Error(`mobile_compliance_read_failed:${error?.code ?? "unknown"}`);
}

export function createSupabaseMobileComplianceRepository(): MobileComplianceRepository {
  return {
    async listReports(input) {
      let builder = query("mobile_compliance_reports")
        .select("*")
        .eq("tenant_id", input.organizationId);
      if (input.projectId) builder = builder.eq("project_id", input.projectId);
      if (input.verdict) builder = builder.eq("verdict", input.verdict);
      const result = await builder.order("created_at", { ascending: false }).limit(input.limit);
      if (result.error) fail(result.error);
      return (result.data ?? []).map(mapReport);
    },
    async getReport(input) {
      const result = await query("mobile_compliance_reports")
        .select("*")
        .eq("tenant_id", input.organizationId)
        .eq("report_id", input.reportId)
        .maybeSingle();
      if (result.error) fail(result.error);
      return result.data ? mapReport(result.data) : null;
    },
    async listFindings(input) {
      const result = await query("mobile_compliance_findings")
        .select("*")
        .eq("tenant_id", input.organizationId)
        .eq("report_id", input.reportId)
        .order("severity", { ascending: false })
        .limit(500);
      if (result.error) fail(result.error);
      return (result.data ?? []).map(mapFinding);
    },
  };
}
