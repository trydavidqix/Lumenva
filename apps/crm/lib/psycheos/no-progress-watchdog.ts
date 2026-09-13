export type WatchdogObservation = Readonly<{
  jobId: string;
  cycle: number;
  progressed: boolean;
}>;

export type WatchdogSignal = Readonly<{
  jobId: string;
  cycle: number;
  status: "ON_TRACK" | "AT_RISK";
  noProgressCycles: number;
  action: "SIGNAL_ONLY";
  processAction: "CONTINUE";
}>;

export type RerouteRequest = Readonly<{
  requesterId: string;
  permissionLevel: "P0" | "P1" | "P2" | "P3" | "P4";
  capabilities: readonly string[];
}>;

export type RerouteResult = Readonly<{
  signal: WatchdogSignal;
  decision: "ALLOW" | "DENY";
  reason: "AUTHORIZED" | "INSUFFICIENT_PERMISSION" | "MISSING_CAPABILITY" | "P4_REQUIRES_APPROVAL";
  processAction: "CONTINUE";
}>;

type JobState = {
  lastCycle: number;
  noProgressCycles: number;
  status: WatchdogSignal["status"];
  byCycle: Map<number, WatchdogSignal>;
};

/** Wave 14 minimal watchdog: signals risk after three idle cycles, never stops work. */
export class NoProgressWatchdog {
  private readonly jobs = new Map<string, JobState>();

  observe(observation: WatchdogObservation): WatchdogSignal {
    if (!observation.jobId) throw new TypeError("jobId is required");
    if (!Number.isInteger(observation.cycle) || observation.cycle < 1) throw new RangeError("cycle must be an integer >= 1");

    const state = this.jobs.get(observation.jobId) ?? { lastCycle: 0, noProgressCycles: 0, status: "ON_TRACK" as const, byCycle: new Map() };
    const replay = state.byCycle.get(observation.cycle);
    if (replay) return { ...replay };
    if (observation.cycle <= state.lastCycle) throw new RangeError("cycle must increase monotonically");

    const noProgressCycles = observation.progressed ? 0 : state.noProgressCycles + 1;
    const signal: WatchdogSignal = Object.freeze({
      jobId: observation.jobId,
      cycle: observation.cycle,
      status: noProgressCycles >= 3 ? "AT_RISK" : "ON_TRACK",
      noProgressCycles,
      action: "SIGNAL_ONLY",
      processAction: "CONTINUE",
    });
    state.lastCycle = observation.cycle;
    state.noProgressCycles = noProgressCycles;
    state.status = signal.status;
    state.byCycle.set(observation.cycle, signal);
    this.jobs.set(observation.jobId, state);
    return { ...signal };
  }

  requestReroute(observation: WatchdogObservation, request: RerouteRequest): RerouteResult {
    const signal = this.observe(observation);
    if (!request.requesterId) throw new TypeError("requesterId is required");
    if (request.permissionLevel === "P4") return { signal, decision: "DENY", reason: "P4_REQUIRES_APPROVAL", processAction: "CONTINUE" };
    if (request.permissionLevel !== "P2" && request.permissionLevel !== "P3") {
      return { signal, decision: "DENY", reason: "INSUFFICIENT_PERMISSION", processAction: "CONTINUE" };
    }
    if (!request.capabilities.includes("workforce.reroute")) {
      return { signal, decision: "DENY", reason: "MISSING_CAPABILITY", processAction: "CONTINUE" };
    }
    return { signal, decision: "ALLOW", reason: "AUTHORIZED", processAction: "CONTINUE" };
  }
}
