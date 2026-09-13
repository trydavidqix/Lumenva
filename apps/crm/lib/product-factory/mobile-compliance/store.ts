import type { Queryable } from "../build-plan-state-store";
import type { ComplianceEvidence, ComplianceFinding, MobileComplianceReport, PolicySnapshot, RuntimeReviewReport } from "./contracts";

interface ReportRow {
  tenant_id: string; report_id: string; project_id: string; build_ref: string; artifact_ref: string; artifact_hash: string;
  platform: "IOS" | "ANDROID"; store: "APP_STORE" | "PLAY_STORE"; policy_version: string; policy_snapshot_hash: string;
  verdict: MobileComplianceReport["verdict"]; findings: MobileComplianceReport["findings"]; evidence_refs: string[];
  runtime_review_id: string | null; critical_count: number; high_count: number; medium_count: number; low_count: number; created_at: string;
}

function reportFromRow(row: ReportRow, runtimeReview?: RuntimeReviewReport): MobileComplianceReport {
  return {
    reportId: row.report_id, organizationId: row.tenant_id, projectId: row.project_id, buildRef: row.build_ref,
    artifactRef: row.artifact_ref, artifactHash: row.artifact_hash, platform: row.platform, store: row.store,
    policyVersion: row.policy_version, policySnapshotHash: row.policy_snapshot_hash, findings: row.findings ?? [], evidenceRefs: row.evidence_refs ?? [],
    ...(runtimeReview ? { runtimeReview } : {}),
    criticalCount: row.critical_count, highCount: row.high_count, mediumCount: row.medium_count, lowCount: row.low_count,
    verdict: row.verdict, createdAt: row.created_at,
  };
}

function assertReportIdentity(stored: ReportRow, report: MobileComplianceReport): void {
  const matches = stored.tenant_id === report.organizationId
    && stored.project_id === report.projectId
    && stored.build_ref === report.buildRef
    && stored.artifact_ref === report.artifactRef
    && stored.artifact_hash === report.artifactHash
    && stored.platform === report.platform
    && stored.store === report.store
    && stored.policy_version === report.policyVersion
    && stored.policy_snapshot_hash === report.policySnapshotHash;
  if (!matches) throw new Error("mobile compliance report identity conflict");
}

export class MobileComplianceStore {
  constructor(private readonly db: Queryable) {}

  async getReport(tenantId: string, reportId: string): Promise<MobileComplianceReport | undefined> {
    const result = await this.db.query<ReportRow>("select * from public.mobile_compliance_reports where tenant_id=$1 and report_id=$2", [tenantId, reportId]);
    return result.rows[0] ? reportFromRow(result.rows[0]) : undefined;
  }

  async insertReport(report: MobileComplianceReport): Promise<MobileComplianceReport> {
    const values = [report.organizationId, report.reportId, report.projectId, report.buildRef, report.artifactRef, report.artifactHash, report.platform, report.store, report.policyVersion, report.policySnapshotHash, report.verdict, JSON.stringify(report.findings), JSON.stringify(report.evidenceRefs), report.runtimeReview?.runtimeReviewId ?? null, report.criticalCount, report.highCount, report.mediumCount, report.lowCount, report.createdAt];
    const result = await this.db.query<ReportRow>("insert into public.mobile_compliance_reports (tenant_id,report_id,project_id,build_ref,artifact_ref,artifact_hash,platform,store,policy_version,policy_snapshot_hash,verdict,findings,evidence_refs,runtime_review_id,critical_count,high_count,medium_count,low_count,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18,$19) on conflict (tenant_id,report_id) do update set report_id=public.mobile_compliance_reports.report_id returning *", values);
    const stored = result.rows[0];
    if (!stored) throw new Error("mobile compliance report insert returned no row");
    assertReportIdentity(stored, report);
    return reportFromRow(stored, report.runtimeReview);
  }

  async insertPolicySnapshot(tenantId: string, snapshot: PolicySnapshot): Promise<void> {
    await this.db.query("insert into public.mobile_policy_snapshots (tenant_id,snapshot_id,provider,version,rules_hash,source_refs,retrieved_at) values ($1,$2,$3,$4,$5,$6::jsonb,$7) on conflict (tenant_id,snapshot_id) do nothing", [tenantId, `policy:${snapshot.provider}:${snapshot.rulesHash}`, snapshot.provider, snapshot.version, snapshot.rulesHash, JSON.stringify(snapshot.sourceRefs), snapshot.retrievedAt]);
  }

  async insertEvidence(tenantId: string, reportId: string, evidence: readonly ComplianceEvidence[]): Promise<void> {
    for (const item of evidence) {
      await this.db.query("insert into public.mobile_compliance_evidence (tenant_id,evidence_id,report_id,rule_id,resource,line,excerpt_hash,detector) values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (tenant_id,evidence_id) do nothing", [tenantId, item.evidenceId, reportId, item.ruleId, item.resource, item.line ?? null, item.excerptHash, item.detector]);
    }
  }

  async insertFindings(tenantId: string, reportId: string, findings: readonly ComplianceFinding[]): Promise<void> {
    for (const finding of findings) {
      await this.db.query(
        "insert into public.mobile_compliance_findings (tenant_id,report_id,fingerprint,rule_id,platform,store,severity,source,verification,title,description,resource,line,evidence_refs,autofixable) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15) on conflict (tenant_id,report_id,fingerprint) do update set fingerprint=public.mobile_compliance_findings.fingerprint",
        [tenantId, reportId, finding.fingerprint, finding.ruleId, finding.platform, finding.store, finding.severity, finding.source, finding.verification, finding.title, finding.description, finding.resource, finding.line ?? null, JSON.stringify(finding.evidenceRefs), finding.autofixable],
      );
    }
  }

  async insertRuntimeReview(tenantId: string, reportId: string, review: RuntimeReviewReport): Promise<void> {
    await this.db.query("insert into public.mobile_runtime_reviews (tenant_id,runtime_review_id,report_id,platform,status,evidence_refs,steps,created_at) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8) on conflict (tenant_id,runtime_review_id) do update set runtime_review_id=public.mobile_runtime_reviews.runtime_review_id", [tenantId, review.runtimeReviewId, reportId, review.platform, review.status, JSON.stringify(review.evidenceRefs), JSON.stringify(review.steps), review.createdAt]);
  }
}
