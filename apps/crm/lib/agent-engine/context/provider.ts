import type {
  ContextItem,
  ContextProviderResult,
  ContextRequest,
} from "../platform/contracts";

export type ContextBucket = "candidate" | "disabled" | "shadow";

/**
 * A provider result keeps shadow observations separate from prompt-eligible
 * context. Callers must only use `items` when `influencePrompt` is true.
 */
export interface ContextRetrievalResult extends ContextProviderResult {
  influencePrompt: boolean;
  bucket: ContextBucket;
  shadowItems: ContextItem[];
}

export interface ContextProviderRequest extends ContextRequest {
  /** Opaque source identifiers from native context, used only for shadow coverage. */
  nativeSourceIds?: readonly string[];
}

export interface ContextProvider {
  readonly name: string;
  retrieve(input: ContextProviderRequest): Promise<ContextRetrievalResult>;
}

export interface CollectedContext {
  /** Only prompt-eligible items. Shadow items never appear here. */
  items: ContextItem[];
  shadowItems: ContextItem[];
  results: ContextRetrievalResult[];
  degraded: boolean;
}

/**
 * Runs independent providers concurrently. An optional provider failing must
 * never prevent native CRM context from being used for an agent reply.
 */
export async function collectContext(input: {
  providers: readonly ContextProvider[];
  request: ContextProviderRequest;
}): Promise<CollectedContext> {
  const settled = await Promise.allSettled(input.providers.map((provider) => provider.retrieve(input.request)));
  const results = settled.map((result, index): ContextRetrievalResult => {
    if (result.status === "fulfilled") return result.value;
    return {
      provider: input.providers[index]?.name ?? "unknown",
      items: [],
      shadowItems: [],
      degraded: true,
      reason: "provider_unavailable",
      influencePrompt: false,
      bucket: "disabled",
    };
  });

  return {
    items: results.flatMap((result) => result.influencePrompt ? result.items : []),
    shadowItems: results.flatMap((result) => result.shadowItems),
    results,
    degraded: results.some((result) => result.degraded),
  };
}
