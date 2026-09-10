import { describe, expect, it } from "vitest";

import { isTenantBudgetBlocked } from "./budget";

describe("tenant budget dispatch gate", () => {
  it.each([
    [{ is_throttled: false, is_disabled: false }, false],
    [{ is_throttled: true, is_disabled: false }, true],
    [{ is_throttled: false, is_disabled: true }, true],
    [{ is_throttled: true, is_disabled: true }, true],
  ] as const)("blocks only when a tenant budget flag is active", (flags, expected) => {
    expect(isTenantBudgetBlocked(flags)).toBe(expected);
  });
});
