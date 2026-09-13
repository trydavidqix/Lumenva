import type { ComplianceFinding, ComplianceVerdict, MobileComplianceReport } from "./contracts";

export interface MobileComplianceRepository {
  listReports(input: {
    organizationId: string;
    projectId?: string;
    verdict?: ComplianceVerdict;
    limit: number;
  }): Promise<MobileComplianceReport[]>;
  getReport(input: { organizationId: string; reportId: string }): Promise<MobileComplianceReport | null>;
  listFindings(input: { organizationId: string; reportId: string }): Promise<ComplianceFinding[]>;
}

export interface MobileComplianceReadModel {
  listReports(
    organizationId: string,
    filters?: { projectId?: string; verdict?: ComplianceVerdict; limit?: number },
  ): Promise<MobileComplianceReport[]>;
  getReport(
    organizationId: string,
    reportId: string,
  ): Promise<{ report: MobileComplianceReport; findings: ComplianceFinding[] } | null>;
}

export function createMobileComplianceReadModel(repo: MobileComplianceRepository): MobileComplianceReadModel {
  return {
    async listReports(organizationId, filters = {}) {
      const limit = Math.max(1, Math.min(filters.limit ?? 50, 100));
      return repo.listReports({
        organizationId,
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.verdict ? { verdict: filters.verdict } : {}),
        limit,
      });
    },
    async getReport(organizationId, reportId) {
      const report = await repo.getReport({ organizationId, reportId });
      if (!report) return null;
      const findings = await repo.listFindings({ organizationId, reportId });
      return { report, findings };
    },
  };
}
