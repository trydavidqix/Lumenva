import type { DistributionProvider } from "@/lib/content-os/providers/distribution";

export type DistributionConnectionStatus = "pending" | "active" | "failed" | "disabled";

export type DistributionConnection = {
  id: string;
  organization_id: string;
  provider: string;
  provider_connection_id: string | null;
  display_name: string;
  status: DistributionConnectionStatus;
  metadata: Record<string, unknown>;
  last_error_code: string | null;
  last_error_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ConnectionRepository = {
  list(organizationId: string): Promise<DistributionConnection[]>;
  create(input: { organizationId: string; provider: string; displayName: string; metadata: Record<string, unknown> }): Promise<DistributionConnection>;
  update(input: { organizationId: string; id: string; providerConnectionId?: string | null; status?: DistributionConnectionStatus; lastErrorCode?: string | null }): Promise<DistributionConnection>;
  find(organizationId: string, id: string): Promise<DistributionConnection | null>;
};

export type CreateConnectionInput = {
  organizationId: string;
  provider: string;
  displayName: string;
  providerInput?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export class ConnectionValidationError extends Error { readonly code = "connection_invalid"; }
export class ConnectionProviderError extends Error { readonly code = "connection_provider_error"; }

function isSecretKey(key: string): boolean {
  const normalized = key.replace(/[-_]/g, "").toLowerCase();
  return ["apikey", "token", "secret", "password", "credential", "accesstoken", "refreshtoken"].some((part) => normalized === part || normalized.endsWith(part));
}

/** Keep provider credentials at the provider boundary; never persist them in domain metadata. */
export function redactConnectionMetadata(value: Record<string, unknown> = {}): Record<string, unknown> {
  const redact = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(redact);
    if (!input || typeof input !== "object") return input;
    return Object.fromEntries(Object.entries(input as Record<string, unknown>)
      .filter(([key]) => !isSecretKey(key))
      .map(([key, nested]) => [key, redact(nested)]));
  };
  return redact(value) as Record<string, unknown>;
}

export async function listConnections(repository: ConnectionRepository, organizationId: string): Promise<DistributionConnection[]> {
  if (!organizationId.trim()) throw new ConnectionValidationError("Organization is required.");
  return repository.list(organizationId);
}

/** Creates the tenant-owned record first, then asks the provider to establish its remote connection. */
export async function createConnection(repository: ConnectionRepository, providers: Record<string, DistributionProvider>, input: CreateConnectionInput): Promise<{ connection: DistributionConnection; redirectUrl?: string }> {
  if (!input.organizationId.trim() || !input.provider.trim() || !input.displayName.trim()) throw new ConnectionValidationError("Organization, provider and display name are required.");
  const provider = providers[input.provider];
  if (!provider || provider.provider !== input.provider) throw new ConnectionValidationError("Unsupported distribution provider.");
  const connection = await repository.create({ organizationId: input.organizationId, provider: input.provider, displayName: input.displayName.trim(), metadata: redactConnectionMetadata(input.metadata) });
  try {
    const result = await provider.connect(input.organizationId, input.providerInput ?? {});
    const updated = await repository.update({ organizationId: input.organizationId, id: connection.id, providerConnectionId: result.connectionId, status: "active", lastErrorCode: null });
    const redirectUrl = result.redirectUrl;
    if (redirectUrl !== undefined) {
      try { const parsed = new URL(redirectUrl); if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error(); }
      catch { throw new ConnectionProviderError("Provider returned an invalid connection URL."); }
    }
    return { connection: updated, ...(redirectUrl ? { redirectUrl } : {}) };
  } catch (error) {
    await repository.update({ organizationId: input.organizationId, id: connection.id, status: "failed", lastErrorCode: error instanceof Error && "code" in error ? String((error as { code?: unknown }).code) : "provider_error" });
    if (error instanceof ConnectionProviderError) throw error;
    throw new ConnectionProviderError("Distribution provider could not establish the connection.");
  }
}

export async function reconcileConnection(repository: ConnectionRepository, provider: DistributionProvider, input: { organizationId: string; id: string }): Promise<DistributionConnection> {
  const existing = await repository.find(input.organizationId, input.id);
  if (!existing || existing.organization_id !== input.organizationId) throw new ConnectionValidationError("Distribution connection not found.");
  if (!existing.provider_connection_id) return existing;
  try {
    const health = await provider.health();
    return health.ok ? repository.update({ organizationId: input.organizationId, id: input.id, status: "active", lastErrorCode: null }) : repository.update({ organizationId: input.organizationId, id: input.id, status: "failed", lastErrorCode: "provider_unhealthy" });
  } catch {
    return repository.update({ organizationId: input.organizationId, id: input.id, status: "failed", lastErrorCode: "provider_unavailable" });
  }
}
