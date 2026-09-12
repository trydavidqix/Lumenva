export type SourceType = "project_canonical" | "official_vendor" | "approved_internal" | "external";

export interface SourceRecord {
  sourceId: string;
  organizationId: string;
  uri: string;
  title: string;
  owner: string;
  license: string;
  version: string;
  sourceType: SourceType;
  createdAt: string;
}

export type SourceInput = Omit<SourceRecord, "sourceId" | "createdAt">;

export interface SourceRegistration {
  created: boolean;
  record: SourceRecord;
}

function sourceKey(source: SourceInput): string {
  return `source:${source.organizationId}:${source.uri}:${source.version}`;
}

function validate(source: SourceInput): void {
  if (
    !source.organizationId.trim() ||
    !source.uri.trim() ||
    !source.title.trim() ||
    !source.owner.trim() ||
    !source.license.trim() ||
    !source.version.trim() ||
    !["project_canonical", "official_vendor", "approved_internal", "external"].includes(source.sourceType)
  ) {
    throw new Error("source_registry_invalid");
  }

  try {
    const parsed = new URL(source.uri);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("invalid_protocol");
    }
  } catch {
    throw new Error("source_registry_invalid");
  }
}

export function registerSource(
  source: SourceInput,
  existing: readonly SourceRecord[],
  createdAt = "1970-01-01T00:00:00.000Z",
): SourceRegistration {
  validate(source);
  const sourceId = sourceKey(source);
  const current = existing.find((item) => item.sourceId === sourceId);
  if (current) return { created: false, record: current };

  return {
    created: true,
    record: { ...source, sourceId, createdAt },
  };
}
