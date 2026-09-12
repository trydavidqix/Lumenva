import { describe, expect, it } from "vitest";

import { runNoProgressWatchdog, type WatchdogObservation } from "./no-progress-watchdog";
import type { ResourceTask, Worker } from "./resource-router";

const task: ResourceTask = { taskId: "task-1", requiredCapabilities: ["browser"] };
const workers: Worker[] = [
  { agentId: "linux-1", surface: "Linux", capabilities: ["browser"], currentLoad: 2, capacity: 10, healthy: true },
  { agentId: "cloud-1", surface: "Cloud", capabilities: ["browser"], currentLoad: 1, capacity: 10, healthy: true },
];

const observation = (progress: boolean): WatchdogObservation => ({
  progress,
  workerId: "linux-1",
});

describe("No-progress Watchdog integrado ao Resource Router", () => {
  it("sinaliza AT_RISK após três ciclos e realoca para outro worker apto", () => {
    const result = runNoProgressWatchdog(task, [observation(false), observation(false), observation(false)], workers);

    expect(result.status).toBe("AT_RISK");
    expect(result.consecutiveNoProgress).toBe(3);
    expect(result.route).toEqual({ agentId: "cloud-1", surface: "Cloud" });
  });

  it("mantém ON_TRACK antes do limiar e não realoca", () => {
    const result = runNoProgressWatchdog(task, [observation(false), observation(false), observation(true)], workers);

    expect(result).toMatchObject({
      status: "ON_TRACK",
      consecutiveNoProgress: 0,
      route: { agentId: "linux-1", surface: "Linux" },
    });
  });

  it("sinaliza AT_RISK sem route quando nenhum worker alternativo está apto", () => {
    const result = runNoProgressWatchdog(task, [observation(false), observation(false), observation(false)], [workers[0]!]);

    expect(result).toMatchObject({ status: "AT_RISK", consecutiveNoProgress: 3, route: null });
  });
});
