import type { ChannelCapability, EngineCapabilities } from "./types";

export function hasCapability(
  capabilities: EngineCapabilities,
  capability: ChannelCapability,
): boolean {
  return capabilities.has(capability);
}
