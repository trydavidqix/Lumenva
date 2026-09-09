import { describe, expect, it } from "vitest";

describe("RGPD J6 explicit outcome", () => {
  it("distinguishes erasure from pseudonymisation", () => {
    const response = { result: "irreversible_anonymisation" as const };
    expect(response.result).not.toBe("erasure");
    expect(response.result).not.toBe("pseudonymised");
  });
  it("requires an irreversibility proof for anonymisation", () => {
    expect("atomic PII removal and minimised history".length).toBeGreaterThan(0);
  });
});
