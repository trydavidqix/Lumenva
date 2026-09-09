import { describe, expect, it, vi } from "vitest";

import {
  ContentSourceService,
  ContentOsNotFoundError,
  ContentOsValidationError,
  type IntelligenceRepository,
} from "@/lib/content-os/intelligence/source-service";
import { listSourceCatalog } from "@/lib/content-os/intelligence/source-catalog";
import { CompetitorService } from "@/lib/content-os/intelligence/competitor-service";

type Source = Awaited<ReturnType<IntelligenceRepository["createSource"]>>;
type Competitor = Awaited<ReturnType<IntelligenceRepository["createCompetitor"]>>;
type Monitor = Awaited<ReturnType<IntelligenceRepository["createMonitor"]>>;

function repositoryFixture(): IntelligenceRepository & {
  sources: Source[];
  competitors: Competitor[];
  monitors: Monitor[];
  emitted: string[];
} {
  const sources: Source[] = [
    {
      id: "source-b",
      organizationId: "org-b",
      name: "Fonte B",
      provider: "rsshub",
      sourceType: "news",
      configuration: { catalogKey: "b" },
      status: "active",
      externalRef: null,
    },
  ];
  const competitors: Competitor[] = [
    {
      id: "competitor-b",
      organizationId: "org-b",
      name: "Concorrente B",
      websiteUrl: "https://competitor.example",
      notes: null,
      status: "active",
    },
  ];
  const monitors: Monitor[] = [];
  const emitted: string[] = [];

  return {
    sources,
    competitors,
    monitors,
    emitted,
    async createSource(input) {
      const source: Source = { id: `source-${sources.length + 1}`, externalRef: null, status: "active", ...input };
      sources.push(source);
      return source;
    },
    async findSource(organizationId, sourceId) {
      return sources.find((source) => source.organizationId === organizationId && source.id === sourceId) ?? null;
    },
    async updateSource(organizationId, sourceId, patch) {
      const source = await this.findSource(organizationId, sourceId);
      if (!source) return null;
      Object.assign(source, patch);
      return source;
    },
    async createCompetitor(input) {
      const competitor: Competitor = { id: `competitor-${competitors.length + 1}`, notes: null, status: "active", ...input };
      competitors.push(competitor);
      return competitor;
    },
    async findCompetitor(organizationId, competitorId) {
      return competitors.find((competitor) => competitor.organizationId === organizationId && competitor.id === competitorId) ?? null;
    },
    async createMonitor(input) {
      const monitor: Monitor = { id: `monitor-${monitors.length + 1}`, providerMonitorId: null, status: "pending", ...input };
      monitors.push(monitor);
      return monitor;
    },
    async updateMonitor(organizationId, monitorId, patch) {
      const monitor = monitors.find((item) => item.organizationId === organizationId && item.id === monitorId);
      if (!monitor) return null;
      Object.assign(monitor, patch);
      return monitor;
    },
    async emit(event) {
      emitted.push(event.type);
    },
  };
}

describe("Content OS intelligence services", () => {
  it.each([
    ["http://127.0.0.1/admin", ["127.0.0.1"]],
    ["http://169.254.169.254/latest/meta-data", ["169.254.169.254"]],
    ["http://[::1]/", ["::1"]],
    ["http://[fd00::1]/", ["fd00::1"]],
  ])("rejects private or metadata target %s", async (targetUrl, addresses) => {
    const repository = repositoryFixture();
    const service = new CompetitorService(repository, { createWatch: vi.fn() }, async () => addresses);
    await expect(service.createMonitor({
      organizationId: "org-b", competitorId: "competitor-b", provider: "changedetection",
      monitorType: "website", targetUrl, configuration: {},
    })).rejects.toBeInstanceOf(ContentOsValidationError);
    expect(repository.monitors).toHaveLength(0);
  });

  it("rejects DNS rebinding when any answer is private", async () => {
    const repository = repositoryFixture();
    const service = new CompetitorService(repository, { createWatch: vi.fn() }, async () => ["93.184.216.34", "10.0.0.7"]);
    await expect(service.createMonitor({
      organizationId: "org-b", competitorId: "competitor-b", provider: "changedetection",
      monitorType: "website", targetUrl: "https://attacker.example", configuration: {},
    })).rejects.toBeInstanceOf(ContentOsValidationError);
  });

  it.each(["file:///etc/passwd", "ftp://attacker.example", "https://user:pass@attacker.example"]) (
    "rejects unsafe URL form %s", async (targetUrl) => {
      const repository = repositoryFixture();
      const service = new CompetitorService(repository, { createWatch: vi.fn() }, async () => ["93.184.216.34"]);
      await expect(service.createMonitor({
        organizationId: "org-b", competitorId: "competitor-b", provider: "changedetection",
        monitorType: "website", targetUrl, configuration: {},
      })).rejects.toBeInstanceOf(ContentOsValidationError);
    });

  it("does not let organization A disable or collect a source owned by B", async () => {
    const repository = repositoryFixture();
    const service = new ContentSourceService(repository);

    await expect(
      service.setStatus({ organizationId: "org-a", sourceId: "source-b", status: "disabled" }),
    ).rejects.toBeInstanceOf(ContentOsNotFoundError);
    await expect(
      service.requestCollection({ organizationId: "org-a", sourceId: "source-b" }),
    ).rejects.toBeInstanceOf(ContentOsNotFoundError);

    expect(repository.sources[0]?.status).toBe("active");
    expect(repository.emitted).toEqual([]);
  });

  it("creates the local monitor first and preserves a failed provider provisioning", async () => {
    const repository = repositoryFixture();
    const provision = vi.fn().mockRejectedValue(new Error("upstream unavailable"));
    const service = new CompetitorService(repository, { createWatch: provision }, async () => ["93.184.216.34"]);

    const monitor = await service.createMonitor({
      organizationId: "org-b",
      competitorId: "competitor-b",
      provider: "changedetection",
      monitorType: "website",
      targetUrl: "https://competitor.example/pricing",
      configuration: {},
    });

    expect(provision).toHaveBeenCalledOnce();
    expect(monitor).toMatchObject({ status: "failed", providerMonitorId: null });
    expect(repository.monitors).toHaveLength(1);
  });

  it("creates an approved GitHub release source from the curated catalog", async () => {
    const repository = repositoryFixture();
    const service = new ContentSourceService(repository);
    const source = await service.createFromCatalog({
      organizationId: "org-a",
      catalogKey: "github-openai-agents-python-releases",
    });

    expect(source).toMatchObject({
      organizationId: "org-a",
      provider: "rsshub",
      sourceType: "news",
      configuration: {
        route: "/github/openai/openai-agents-python/releases",
        sourceUrl: "https://github.com/openai/openai-agents-python/releases",
      },
    });
    expect(repository.sources).toHaveLength(2);
  });

  it("rejects catalog keys outside the approved source list", async () => {
    const repository = repositoryFixture();
    const service = new ContentSourceService(repository);

    await expect(
      service.createFromCatalog({ organizationId: "org-a", catalogKey: "https://attacker.example/feed" }),
    ).rejects.toBeInstanceOf(ContentOsValidationError);
    expect(listSourceCatalog().every((source) => source.configuration.route.startsWith("/github/"))).toBe(true);
  });
});
