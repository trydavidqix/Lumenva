import type { ConnectCapability, ConnectProvider } from "./contracts";

export interface ConnectRegistry {
  get(providerId: string): ConnectProvider | null;
  supports(providerId: string, capability: ConnectCapability): boolean;
  requireCapability(providerId: string, capability: ConnectCapability): ConnectProvider;
  list(): ConnectProvider[];
}

export function createConnectRegistry(providers: ConnectProvider[]): ConnectRegistry {
  const byId = new Map<string, ConnectProvider>();
  for (const provider of providers) {
    if (byId.has(provider.id)) throw new Error("connect_provider_duplicate");
    byId.set(provider.id, { ...provider, families: [...provider.families], capabilities: [...provider.capabilities] });
  }
  return {
    get: (providerId) => byId.get(providerId) ?? null,
    supports: (providerId, capability) => byId.get(providerId)?.capabilities.includes(capability) ?? false,
    requireCapability(providerId, capability) {
      const provider = byId.get(providerId);
      if (!provider || !provider.capabilities.includes(capability)) throw new Error("connect_capability_unavailable");
      return provider;
    },
    list: () => [...byId.values()],
  };
}
