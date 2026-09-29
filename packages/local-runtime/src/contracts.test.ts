import { describe, expect, it } from "vitest";
import { assertRuntimeCommand, assertRuntimeCorrelation, RUNTIME_PROTOCOL_VERSION } from "./contracts.js";

describe("local runtime contracts", () => {
  it("requires tenant and trace correlation", () => {
    expect(() => assertRuntimeCorrelation({ organizationId: "", traceId: "trace" })).toThrow("runtime_organization_required");
    expect(() => assertRuntimeCorrelation({ organizationId: "org", traceId: "" })).toThrow("runtime_trace_required");
  });

  it("accepts a bounded typed command", () => {
    expect(() => assertRuntimeCommand({
      id: "cmd-1",
      correlation: { organizationId: "org", traceId: "trace" },
      capabilityId: "git.status",
      executable: "git",
      args: ["status", "--short"],
      cwd: "C:/repo",
      timeoutMs: 5_000,
      maxOutputBytes: 65_536,
      risk: "R0",
    })).not.toThrow();
    expect(RUNTIME_PROTOCOL_VERSION).toBe(1);
  });

  it("rejects unbounded commands", () => {
    expect(() => assertRuntimeCommand({
      id: "cmd-1",
      correlation: { organizationId: "org", traceId: "trace" },
      capabilityId: "git.status",
      executable: "git",
      args: [],
      cwd: "C:/repo",
      timeoutMs: 0,
      maxOutputBytes: 0,
      risk: "R0",
    })).toThrow("runtime_timeout_invalid");
  });
});
