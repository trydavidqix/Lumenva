import { env } from "@/lib/env";

import { resolveAiPlatformFeature } from "../platform/features";

export type ExternalTracingConfig =
  | { enabled: false }
  | {
    enabled: true;
    apiKey: string;
    endpoint?: string;
    project?: string;
    workspaceId?: string;
  };

function optionalValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function validEndpoint(value: string | undefined): string | undefined | null {
  if (!value) return undefined;
  try {
    const endpoint = new URL(value);
    return endpoint.protocol === "https:" || endpoint.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the optional external tracing contract for one tenant. This is the
 * only gate for LangSmith configuration: platform flags (and their env kill
 * switch) win over environment credentials. Failure to resolve a flag or an
 * invalid optional endpoint degrades to a no-op configuration.
 */
export async function resolveExternalTracingConfig(input: {
  organizationId: string;
}): Promise<ExternalTracingConfig> {
  const apiKey = optionalValue(env.LANGSMITH_API_KEY);
  if (!apiKey) return { enabled: false };

  const endpoint = validEndpoint(optionalValue(env.LANGSMITH_ENDPOINT));
  if (endpoint === null) return { enabled: false };

  try {
    const feature = await resolveAiPlatformFeature({
      organizationId: input.organizationId,
      feature: "langsmith",
    });
    if (feature.killed || feature.mode === "off") return { enabled: false };

    return {
      enabled: true,
      apiKey,
      ...(endpoint ? { endpoint } : {}),
      ...(optionalValue(env.LANGSMITH_PROJECT) ? { project: optionalValue(env.LANGSMITH_PROJECT) } : {}),
      ...(optionalValue(env.LANGSMITH_WORKSPACE_ID) ? { workspaceId: optionalValue(env.LANGSMITH_WORKSPACE_ID) } : {}),
    };
  } catch {
    return { enabled: false };
  }
}
