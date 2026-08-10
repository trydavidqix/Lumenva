import { describe, expect, it } from "vitest";

import { resolveFeatureRows } from "./features";

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
