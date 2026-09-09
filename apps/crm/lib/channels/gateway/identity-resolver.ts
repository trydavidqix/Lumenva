import { phoneLookupVariants } from "../phone-variants";
import type { ChannelName } from "./types";

export type ExternalIdentity =
  | { kind: "phone"; value: string }
  | { kind: "whatsapp"; value: string }
  | { kind: "instagram"; value: string }
  | { kind: "messenger"; value: string };

export interface IdentityLookup {
  organizationId: string;
  channel: ChannelName;
  accountId: string;
  kind: ExternalIdentity["kind"];
  candidates: readonly string[];
}

export interface IdentityMatch {
  customerId: string;
  matchedIdentity: string;
}

export interface IdentityRepository {
  findExact(input: IdentityLookup): Promise<IdentityMatch[]>;
}

export type IdentityResolution =
  | {
      customerId: string;
      confidence: "exact";
      matchedIdentity: string;
    }
  | {
      customerId: null;
      confidence: "unresolved";
      reason: "invalid_identity" | "not_found" | "ambiguous" | "weak_identity_not_allowed";
    };

function digits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function normalizeExternalIdentity(identity: ExternalIdentity): readonly string[] {
  const value = identity.value.trim();
  if (!value) return [];

  switch (identity.kind) {
    case "phone":
      return phoneLookupVariants(value);
    case "whatsapp": {
      const bare = value.replace(/@(c\.us|s\.whatsapp\.net)$/i, "");
      const normalized = digits(bare);
      if (!normalized) return [];
      return [`phone:+${normalized}`, `+${normalized}`];
    }
    case "instagram":
    case "messenger":
      // Account-scoped platform IDs are opaque. Never lowercase/rewrite them.
      return [value];
  }
}

export async function resolveCustomerIdentity(
  input: {
    organizationId: string;
    channel: ChannelName;
    accountId: string;
    externalIdentity: ExternalIdentity;
  },
  repository: IdentityRepository,
): Promise<IdentityResolution> {
  const candidates = normalizeExternalIdentity(input.externalIdentity);
  if (candidates.length === 0) {
    return { customerId: null, confidence: "unresolved", reason: "invalid_identity" };
  }

  // Names/profile labels intentionally never enter this API. Only stable channel
  // identifiers and conservative phone variants are eligible for automatic linking.
  const matches = await repository.findExact({
    organizationId: input.organizationId,
    channel: input.channel,
    accountId: input.accountId,
    kind: input.externalIdentity.kind,
    candidates,
  });

  const customerIds = [...new Set(matches.map((match) => match.customerId))];
  if (customerIds.length === 0) {
    return { customerId: null, confidence: "unresolved", reason: "not_found" };
  }
  if (customerIds.length !== 1) {
    return { customerId: null, confidence: "unresolved", reason: "ambiguous" };
  }

  const customerId = customerIds[0];
  if (!customerId) {
    return { customerId: null, confidence: "unresolved", reason: "not_found" };
  }

  const first = matches.find((match) => match.customerId === customerId);
  if (!first) {
    return { customerId: null, confidence: "unresolved", reason: "not_found" };
  }

  return {
    customerId,
    confidence: "exact",
    matchedIdentity: first.matchedIdentity,
  };
}
