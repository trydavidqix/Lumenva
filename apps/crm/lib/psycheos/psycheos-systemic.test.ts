import { describe, expect, it } from "vitest";

import { runPsycheSystemicGate } from "./psycheos-systemic";

describe("PsycheOS systemic gate — Wave 16", () => {
  it("executa affect ledger, decay, trust e boundary num único gate", () => {
    const gate = runPsycheSystemicGate();
    expect(gate.status).toBe("PASS");
    expect(gate.cases.map((result) => result.caseId)).toEqual([
      "AFFECT_LEDGER",
      "DECAY",
      "TRUST",
      "BOUNDARY",
      "REGRESSION",
    ]);
    expect(gate.cases.every((result) => result.status === "PASS")).toBe(true);
    expect(gate.failedCases).toEqual([]);
  });
});
