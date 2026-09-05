import { describe, expect, it } from "vitest";

import { readRgpdStatus } from "@/lib/lgpd/state-machine";

const RGPD_STATE_MACHINE_V1 = process.env.RGPD_STATE_MACHINE_V1 === "true";

describe("RGPD J1 state machine compatibility", () => {
  it("keeps the rollout flag disabled unless explicitly enabled", () => {
    expect(RGPD_STATE_MACHINE_V1).toBe(false);
  });

  it.each([
    ["received", "received"],
    ["processing", "in_review"],
    ["completed", "responded"],
    ["failed", "refused"],
    ["expired", "refused"],
  ])("maps legacy status %s to %s", (status, expected) => {
    expect(readRgpdStatus({ status })).toBe(expected);
  });

  it("prefers a valid new RGPD status during dual-read", () => {
    expect(readRgpdStatus({ status: "processing", rgpd_status: "extension_notified" })).toBe("extension_notified");
  });
});
