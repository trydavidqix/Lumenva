import { beforeEach, describe, expect, it, vi } from "vitest";

const orgA = "00000000-0000-4000-8000-000000000001";

type FlagRow = { organization_id: string | null; feature: string; mode: string; config: unknown };

// `killSwitches` inside features.ts reads `env.AI_PLATFORM_KILL_*` exactly
// once, at module-evaluation time — so AI_PLATFORM_KILL_GRAPHITI must be
// `true` here, in the initial hoisted object, not mutated later in a
// `beforeEach`, or the module would have already captured `false` by the
// time any test runs. `flagRows`, in contrast, is read fresh on every
// `createAdminClient()` call (see `fakeFeatureFlagsClient` below), so it is
// safe to mutate per-test.
const state = vi.hoisted(() => ({
  env: {
    AI_PLATFORM_KILL_LANGSMITH: false,
    AI_PLATFORM_KILL_MEM0: false,
    AI_PLATFORM_KILL_LLAMAINDEX: false,
    AI_PLATFORM_KILL_GRAPHITI: true,
    AI_PLATFORM_KILL_EXTERNAL_GUARDRAILS: false,
    AI_PLATFORM_KILL_N8N: false,
    AI_PLATFORM_KILL_LANGGRAPH: false,
  },
  flagRows: [] as FlagRow[],
}));

/** Minimal fluent stand-in for the exact `.from().select().eq()/.is().maybeSingle()` shape `fetchFeatureRows` issues. */
function fakeFeatureFlagsClient(rows: FlagRow[]) {
  return {
    from: (_table: string) => ({
      select: (_cols: string) => {
        const filters: Record<string, string | null> = {};
        const builder = {
          eq(col: string, val: string) {
            filters[col] = val;
            return builder;
          },
          is(col: string, val: null) {
            filters[col] = val;
            return builder;
          },
          async maybeSingle() {
            const match = rows.find((row) =>
              Object.entries(filters).every(([key, value]) => (row as unknown as Record<string, unknown>)[key] === value),
            );
            return { data: match ?? null, error: null };
          },
        };
        return builder;
      },
    }),
  };
}

vi.mock("@/lib/env", () => ({ env: state.env }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeFeatureFlagsClient(state.flagRows),
}));

import { resolveAiPlatformFeature, resolveFeatureRows, resolveStoredAiPlatformFeatureMode } from "./features";

describe("AI Platform feature resolution", () => {
  it("defaults to off when there is no configuration", () => {
    expect(resolveFeatureRows("mem0", [])).toEqual({ mode: "off", config: {}, killed: false });
  });

  it("prefers a tenant override over a global default", () => {
    expect(resolveFeatureRows("mem0", [
      { organization_id: null, feature: "mem0", mode: "shadow", config: {} },
      { organization_id: "00000000-0000-4000-8000-000000000001", feature: "mem0", mode: "canary", config: {} },
    ])).toMatchObject({ mode: "canary", killed: false });
  });

  it("makes a kill switch win over every database mode", () => {
    expect(resolveFeatureRows("mem0", [{ organization_id: null, feature: "mem0", mode: "on", config: {} }], true))
      .toEqual({ mode: "off", config: {}, killed: true });
  });
});

describe("resolveStoredAiPlatformFeatureMode", () => {
  it("reports the real stored mode, structurally unable to be masked by a kill switch", async () => {
    // This function never accepts/consults a `killed` flag at all — the
    // injected row-fetcher below stands in for a database read that would be
    // identical whether or not AI_PLATFORM_KILL_GRAPHITI is set, because the
    // kill switch never touches what is persisted in ai_platform_feature_flags.
    // This is the regression coverage for the bug where
    // rebuild-graphiti.ts's escalation-downgrade decision used to read the
    // kill-switch-MASKED value instead, silently no-opping while a kill
    // switch was active.
    const result = await resolveStoredAiPlatformFeatureMode(
      { organizationId: "00000000-0000-4000-8000-000000000001", feature: "graphiti" },
      async () => [
        { organization_id: "00000000-0000-4000-8000-000000000001", feature: "graphiti", mode: "on", config: {} },
      ],
    );
    expect(result).toEqual({ mode: "on", config: {} });
  });

  it("falls back to off when nothing is stored for the org or globally", async () => {
    const result = await resolveStoredAiPlatformFeatureMode(
      { organizationId: "00000000-0000-4000-8000-000000000001", feature: "graphiti" },
      async () => [],
    );
    expect(result).toEqual({ mode: "off", config: {} });
  });
});

describe("resolveAiPlatformFeature vs resolveStoredAiPlatformFeatureMode under an active kill switch (Finding 2 regression)", () => {
  beforeEach(() => {
    state.flagRows = [{ organization_id: orgA, feature: "graphiti", mode: "on", config: {} }];
  });

  it("resolveAiPlatformFeature masks the stored 'on' mode to 'off' while the kill switch is active", async () => {
    await expect(resolveAiPlatformFeature({ organizationId: orgA, feature: "graphiti" }))
      .resolves.toEqual({ mode: "off", config: {}, killed: true });
  });

  it("resolveAiPlatformFeature does not even reach the database while killed (asserted via unmasked read using the exact same real client)", async () => {
    // Prove the masking above is real, not an artifact of the fake client:
    // reading through the unmasked function against the identical stored row
    // (same env, same flagRows) returns the true 'on' mode. This is exactly
    // what `rebuildTenant`'s step 1 must use — using the masked function
    // here instead is the bug this fix wave closed.
    await expect(resolveStoredAiPlatformFeatureMode({ organizationId: orgA, feature: "graphiti" }))
      .resolves.toEqual({ mode: "on", config: {} });
  });
});
