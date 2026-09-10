import { describe, expect, it } from "vitest";
import { canProbeWaha, initialWahaCircuit, recordWahaFailure, recordWahaSuccess, rollbackWahaCircuit } from "@/lib/waha/health";

describe("WAHA health circuit contract", () => {
  it("opens after the deterministic failure threshold and cools down", () => {
    let circuit = initialWahaCircuit();
    circuit = recordWahaFailure(circuit, 1000);
    circuit = recordWahaFailure(circuit, 2000);
    expect(circuit.state).toBe("closed");
    circuit = recordWahaFailure(circuit, 3000);
    expect(circuit.state).toBe("open");
    expect(canProbeWaha(circuit, 32_999)).toBe(false);
    expect(canProbeWaha(circuit, 33_000)).toBe(true);
  });

  it("resets on a successful probe or explicit rollback", () => {
    const open = recordWahaFailure(recordWahaFailure(recordWahaFailure(initialWahaCircuit(), 1), 2), 3);
    expect(recordWahaSuccess()).toEqual(initialWahaCircuit());
    expect(rollbackWahaCircuit()).toEqual(initialWahaCircuit());
    expect(canProbeWaha(open, 3_000)).toBe(false);
  });
});
