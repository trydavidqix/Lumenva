import { describe, expect, it } from "vitest";

import { providerJobStates } from "@/lib/content-os/providers/types";

describe("Content OS provider contracts", () => {
  it("exposes the states that a provider job may report", () => {
    expect(providerJobStates).toEqual([
      "queued",
      "running",
      "succeeded",
      "failed",
      "cancelled",
    ]);
  });
});
