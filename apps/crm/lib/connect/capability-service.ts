import type { ConnectCapability, ConnectHealthResult } from "./contracts";
import type { CapabilityStatus } from "../creator-commerce/country-capabilities";

export interface ConnectCapabilityResolutionInput {
  provider: string;
  capability: ConnectCapability;
  providerSupports: boolean;
  connectionAuthenticated: boolean;
  countryDecision: { status: CapabilityStatus; evidenceRefs: readonly string[] };
  health: ConnectHealthResult;
}

export interface ConnectCapabilityResolution {
  provider: string;
  capability: ConnectCapability;
  available: boolean;
  reasons: string[];
  evidenceRefs: string[];
}

export function resolveConnectCapability(input: ConnectCapabilityResolutionInput): ConnectCapabilityResolution {
  const reasons: string[] = [];
  if (!input.providerSupports) reasons.push("provider_capability_missing");
  if (!input.connectionAuthenticated) reasons.push("provider_connection_not_authenticated");
  if (input.countryDecision.status !== "ALLOW") reasons.push(`country_${input.countryDecision.status.toLowerCase()}`);
  if (input.health.status !== "healthy" && input.health.status !== "degraded") reasons.push(`provider_${input.health.status}`);
  return {
    provider: input.provider,
    capability: input.capability,
    available: reasons.length === 0,
    reasons,
    evidenceRefs: [...new Set([...input.countryDecision.evidenceRefs, ...input.health.evidenceRefs])],
  };
}
