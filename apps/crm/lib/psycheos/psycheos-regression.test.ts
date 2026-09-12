import { describe, expect, it } from "vitest";

import { runPsycheRegression, type PsycheProfile } from "./psycheos-regression";

const profile: PsycheProfile = { profileId: "support-bounded", profileVersion: "1.0.0", decayLambda: 0.5 };

describe("PsycheOS regression suite", () => {
  it("executa os 10 casos canónicos e reporta PASS/FAIL por caso", () => {
    const report = runPsycheRegression(profile);
    expect(report).toHaveLength(10);
    expect(report.map((result) => result.caseId)).toEqual([
      "PSY-CONSISTENCY-001",
      "PSY-TRUTH-001",
      "PSY-BOUNDARY-001",
      "PSY-DECAY-001",
      "PSY-PERSIST-001",
      "PSY-REPAIR-001",
      "PSY-IDEMP-001",
      "PSY-HANDOFF-001",
      "PSY-ISOLATION-001",
      "PSY-FAIL-CLOSED-001",
    ]);
    expect(report.every((result) => result.status === "PASS")).toBe(true);
    expect(report.every((result) => result.profileVersion === profile.profileVersion)).toBe(true);
    expect(report.find((result) => result.caseId === "PSY-PERSIST-001")?.detail).toContain("ledger events=2");
    expect(report.find((result) => result.caseId === "PSY-HANDOFF-001")?.detail).toContain("handoff became next event before");
    expect(report.find((result) => result.caseId === "PSY-BOUNDARY-001")?.detail).toContain("policy decision compared");
  });
});
