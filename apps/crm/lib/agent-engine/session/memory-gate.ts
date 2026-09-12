/** Minimal provider-free write gate for memory authority boundaries. */

export type MemoryWrite = {
  owner: string;
  scope: string;
  authority: number;
};

export type MemoryGatePolicy = {
  owner: string;
  scope: string;
  authority: number;
};

export type MemoryGateDecision = "ALLOW" | "DENY";

/**
 * Allows a memory write only when every policy dimension matches exactly and
 * the write authority meets the policy threshold. Missing or malformed input
 * is denied by default.
 */
export function evaluateMemoryGate(
  write: MemoryWrite,
  policy: MemoryGatePolicy,
): MemoryGateDecision {
  if (!write || !policy) return "DENY";
  if (
    typeof write.owner !== "string" ||
    typeof write.scope !== "string" ||
    typeof policy.owner !== "string" ||
    typeof policy.scope !== "string" ||
    write.owner.length === 0 ||
    write.scope.length === 0 ||
    policy.owner.length === 0 ||
    policy.scope.length === 0
  ) {
    return "DENY";
  }
  if (
    !Number.isFinite(write.authority) ||
    !Number.isFinite(policy.authority) ||
    write.authority < 0 ||
    policy.authority < 0
  ) {
    return "DENY";
  }

  return write.owner === policy.owner &&
    write.scope === policy.scope &&
    write.authority >= policy.authority
    ? "ALLOW"
    : "DENY";
}

export const memoryGate = evaluateMemoryGate;
