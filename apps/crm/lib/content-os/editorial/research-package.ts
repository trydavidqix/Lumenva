import type { Claim, Evidence, ResearchPackage } from "./contracts";

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "en", { sensitivity: "base" });
}

function assertNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${field} is required`);
  return normalized;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(compareText);
}

/** Creates a stable package boundary for the writer and fact-check stages. */
export function createResearchPackage(input: ResearchPackage): ResearchPackage {
  const sources = [...input.sources]
    .map((source): Evidence => ({
      ...source,
      id: assertNonEmpty(source.id, "source.id"),
      url: assertNonEmpty(source.url, "source.url"),
      title: assertNonEmpty(source.title, "source.title"),
      publisher: assertNonEmpty(source.publisher, "source.publisher"),
      supportsClaimIds: uniqueSorted(source.supportsClaimIds ?? []),
      contradictsClaimIds: uniqueSorted(source.contradictsClaimIds ?? []),
    }))
    .sort((a, b) => compareText(a.id, b.id));

  const claims = [...input.claims]
    .map((claim): Claim => ({
      ...claim,
      id: assertNonEmpty(claim.id, "claim.id"),
      text: assertNonEmpty(claim.text, "claim.text"),
    }))
    .sort((a, b) => compareText(a.id, b.id));

  const claimIds = new Set(claims.map((claim) => claim.id));
  for (const source of sources) {
    for (const claimId of source.supportsClaimIds ?? []) {
      if (!claimIds.has(claimId)) {
        throw new TypeError(`Source ${source.id} references unknown claim ${claimId}`);
      }
    }
    for (const claimId of source.contradictsClaimIds ?? []) {
      if (!claimIds.has(claimId)) {
        throw new TypeError(`Source ${source.id} references unknown claim ${claimId}`);
      }
    }
  }

  return {
    topic: assertNonEmpty(input.topic, "topic"),
    angle: assertNonEmpty(input.angle, "angle"),
    sources,
    claims,
  };
}
