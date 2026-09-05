import { describe, expect, it } from "vitest";
import { breachDeadline, BREACH_WORKFLOW_V1, requiresDataSubjectNotice } from "@/lib/lgpd/breach";
describe("RGPD J3 breach workflow", () => {
  it("defaults OFF and calculates exactly 72 UTC hours", () => { expect(BREACH_WORKFLOW_V1).toBe(false); expect(breachDeadline(new Date("2026-01-01T00:00:00Z")).toISOString()).toBe("2026-01-04T00:00:00.000Z"); });
  it("notifies data subjects only for high risk", () => { expect(requiresDataSubjectNotice("high")).toBe(true); expect(requiresDataSubjectNotice("low")).toBe(false); expect(requiresDataSubjectNotice("none")).toBe(false); });
});
