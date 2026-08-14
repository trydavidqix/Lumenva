import {
  ContentOsNotFoundError,
  ContentOsValidationError,
  type CompetitorMonitorRecord,
  type CompetitorRecord,
  type IntelligenceRepository,
} from "./source-service";

export type CompetitorWatchProvisioner = {
  createWatch(input: { url: string; title: string }): Promise<string>;
};

export class CompetitorService {
  constructor(
    private readonly repository: IntelligenceRepository,
    private readonly changedetection: CompetitorWatchProvisioner,
  ) {}

  createCompetitor(
    input: Omit<CompetitorRecord, "id" | "status">,
  ): Promise<CompetitorRecord> {
    return this.repository.createCompetitor(input);
  }

  async createMonitor(
    input: Omit<CompetitorMonitorRecord, "id" | "providerMonitorId" | "status">,
  ): Promise<CompetitorMonitorRecord> {
    const competitor = await this.repository.findCompetitor(
      input.organizationId,
      input.competitorId,
    );
    if (!competitor) throw new ContentOsNotFoundError("Competitor");
    if (input.provider !== "changedetection") {
      throw new ContentOsValidationError("Unsupported competitor monitor provider");
    }

    const monitor = await this.repository.createMonitor(input);

    try {
      const providerMonitorId = await this.changedetection.createWatch({
        url: monitor.targetUrl,
        title: `${competitor.name} — ${monitor.monitorType}`,
      });
      const active = await this.repository.updateMonitor(
        input.organizationId,
        monitor.id,
        { providerMonitorId, status: "active" },
      );
      if (!active) throw new ContentOsNotFoundError("Competitor monitor");
      return active;
    } catch {
      const failed = await this.repository.updateMonitor(
        input.organizationId,
        monitor.id,
        { status: "failed" },
      );
      if (!failed) throw new ContentOsNotFoundError("Competitor monitor");
      return failed;
    }
  }
}
