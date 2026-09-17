export type WatchdogObservation = Readonly<{ jobId: string; cycle: number; progressed: boolean }>;
export type WatchdogSignal = Readonly<{ jobId: string; cycle: number; status: "ON_TRACK" | "AT_RISK"; noProgressCycles: number; action: "SIGNAL_ONLY"; processAction: "CONTINUE" }>;
type JobState = { lastCycle: number; noProgressCycles: number; status: WatchdogSignal["status"]; byCycle: Map<number, WatchdogSignal> };
export class NoProgressWatchdog {
  private readonly jobs = new Map<string, JobState>();
  observe(observation: WatchdogObservation): WatchdogSignal {
    if (!observation.jobId) throw new TypeError("jobId is required");
    if (!Number.isInteger(observation.cycle) || observation.cycle < 1) throw new RangeError("cycle must be an integer >= 1");
    const state = this.jobs.get(observation.jobId) ?? { lastCycle: 0, noProgressCycles: 0, status: "ON_TRACK" as const, byCycle: new Map() };
    const replay = state.byCycle.get(observation.cycle); if (replay) return { ...replay };
    if (observation.cycle <= state.lastCycle) throw new RangeError("cycle must increase monotonically");
    const noProgressCycles = observation.progressed ? 0 : state.noProgressCycles + 1;
    const signal: WatchdogSignal = Object.freeze({ jobId: observation.jobId, cycle: observation.cycle, status: noProgressCycles >= 3 ? "AT_RISK" : "ON_TRACK", noProgressCycles, action: "SIGNAL_ONLY", processAction: "CONTINUE" });
    state.lastCycle = observation.cycle; state.noProgressCycles = noProgressCycles; state.status = signal.status; state.byCycle.set(observation.cycle, signal); this.jobs.set(observation.jobId, state);
    return { ...signal };
  }
}
