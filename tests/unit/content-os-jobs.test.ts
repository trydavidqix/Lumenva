import { describe, expect, it } from "vitest";

import { assertJobTransition, canTransitionJob } from "@/lib/content-os/jobs";

describe("Content OS job state machine", () => {
  it("allows only the canonical non-terminal transitions", () => {
    expect(canTransitionJob("queued", "running")).toBe(true);
    expect(canTransitionJob("running", "succeeded")).toBe(true);
    expect(canTransitionJob("running", "failed")).toBe(true);
    expect(canTransitionJob("queued", "cancelled")).toBe(true);
  });

  it("rejects transitions out of terminal states", () => {
    expect(canTransitionJob("succeeded", "running")).toBe(false);
    expect(canTransitionJob("cancelled", "succeeded")).toBe(false);
    expect(() => assertJobTransition("failed", "queued")).toThrow(
      "Invalid Content OS job transition: failed -> queued",
    );
  });
});
