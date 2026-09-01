import {
  ContentOsNotFoundError,
  ContentOsValidationError,
  type CompetitorMonitorRecord,
  type CompetitorRecord,
  type IntelligenceRepository,
} from "./source-service";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export type TargetAddressResolver = (hostname: string) => Promise<readonly string[]>;

const METADATA_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.google.internal.",
  "instance-data.ec2.internal",
  "instance-data.ec2.internal.",
]);

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (isIP(normalized) === 4) {
    const octets = normalized.split(".").map(Number);
    const [a, b] = octets;
    if (a === undefined || b === undefined) return true;
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19));
  }
  if (isIP(normalized) === 6) {
    const value = normalized.split("%")[0];
    if (value === undefined) return true;
    return value === "::1" || value === "::" || value.startsWith("fc") ||
      value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") ||
      value.startsWith("fea") || value.startsWith("feb");
  }
  return true;
}

/** Domain-boundary SSRF guard. Every DNS answer must be publicly routable. */
export async function assertSafeMonitorTarget(
  targetUrl: string,
  resolveAddresses: TargetAddressResolver = async (hostname) =>
    (await lookup(hostname, { all: true, verbatim: true })).map(({ address }) => address),
): Promise<URL> {
  let parsed: URL;
  try { parsed = new URL(targetUrl); } catch { throw new ContentOsValidationError("Monitor target URL is invalid"); }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ContentOsValidationError("Monitor target URL must use http or https");
  }
  if (parsed.username || parsed.password || parsed.hostname === "") {
    throw new ContentOsValidationError("Monitor target URL must not contain credentials");
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (METADATA_HOSTS.has(hostname) || hostname === "localhost" || (isIP(hostname) !== 0 && isPrivateAddress(hostname))) {
    throw new ContentOsValidationError("Monitor target URL resolves to a blocked network");
  }
  const addresses = isIP(hostname) ? [hostname] : await resolveAddresses(hostname);
  if (!addresses.length || addresses.some(isPrivateAddress)) {
    throw new ContentOsValidationError("Monitor target URL resolves to a blocked network");
  }
  return parsed;
}

export type CompetitorWatchProvisioner = {
  createWatch(input: { url: string; title: string }): Promise<string>;
};

export class CompetitorService {
  constructor(
    private readonly repository: IntelligenceRepository,
    private readonly changedetection: CompetitorWatchProvisioner,
    private readonly resolveAddresses?: TargetAddressResolver,
  ) {}

  createCompetitor(
    input: Omit<CompetitorRecord, "id" | "status">,
  ): Promise<CompetitorRecord> {
    return this.repository.createCompetitor(input);
  }

  async createMonitor(
    input: Omit<CompetitorMonitorRecord, "id" | "providerMonitorId" | "status">,
  ): Promise<CompetitorMonitorRecord> {
    await assertSafeMonitorTarget(input.targetUrl, this.resolveAddresses);
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
