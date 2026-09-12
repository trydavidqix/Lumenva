import { describe, expect, it } from "vitest";
import { evaluateMemoryGate, type MemoryGatePolicy, type MemoryWrite } from "./memory-gate";

const write: MemoryWrite = { owner: "agent-1", scope: "company:org-1", authority: 3 };
const policy: MemoryGatePolicy = { owner: "agent-1", scope: "company:org-1", authority: 2 };

describe("MemoryGate", () => {
  it("allows a write when owner, scope and authority satisfy policy", () => {
    expect(evaluateMemoryGate(write, policy)).toBe("ALLOW");
  });

  it("denies insufficient authority, owner mismatch and scope mismatch", () => {
    expect(evaluateMemoryGate({ ...write, authority: 1 }, policy)).toBe("DENY");
    expect(evaluateMemoryGate(write, { ...policy, owner: "agent-2" })).toBe("DENY");
    expect(evaluateMemoryGate(write, { ...policy, scope: "owner:david" })).toBe("DENY");
  });

  it("fails closed for missing or malformed authority policy", () => {
    expect(evaluateMemoryGate(write, { ...policy, authority: Number.NaN })).toBe("DENY");
    expect(evaluateMemoryGate({ ...write, authority: Number.POSITIVE_INFINITY }, policy)).toBe("DENY");
    expect(evaluateMemoryGate(write, undefined as unknown as MemoryGatePolicy)).toBe("DENY");
  });
});
