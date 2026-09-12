export type WahaCircuitState = "closed" | "open" | "half_open";

export interface WahaCircuit {
  state: WahaCircuitState;
  failures: number;
  openedAt: number | null;
}

export const DEFAULT_WAHA_FAILURE_THRESHOLD = 3;
export const DEFAULT_WAHA_COOLDOWN_MS = 30_000;

export function initialWahaCircuit(): WahaCircuit {
  return { state: "closed", failures: 0, openedAt: null };
}

export function canProbeWaha(
  circuit: WahaCircuit,
  now: number,
  cooldownMs = DEFAULT_WAHA_COOLDOWN_MS,
): boolean {
  if (circuit.state === "closed") return true;
  if (circuit.state === "half_open") return true;
  return circuit.openedAt !== null && now - circuit.openedAt >= cooldownMs;
}

export function recordWahaFailure(
  circuit: WahaCircuit,
  now: number,
  threshold = DEFAULT_WAHA_FAILURE_THRESHOLD,
): WahaCircuit {
  const failures = circuit.failures + 1;
  return failures >= threshold
    ? { state: "open", failures, openedAt: now }
    : { state: "closed", failures, openedAt: null };
}

export function recordWahaSuccess(): WahaCircuit {
  return initialWahaCircuit();
}

/** Explicit rollback/reset after operator remediation; never touches provider state. */
export function rollbackWahaCircuit(): WahaCircuit {
  return initialWahaCircuit();
}
