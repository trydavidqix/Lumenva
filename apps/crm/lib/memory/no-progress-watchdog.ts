import { routeResource, type ResourceRoute, type ResourceTask, type Worker } from "./resource-router";

export interface WatchdogObservation {
  progress: boolean;
  workerId: string;
}

export interface WatchdogResult {
  status: "ON_TRACK" | "AT_RISK";
  consecutiveNoProgress: number;
  route: ResourceRoute | null;
}

const NO_PROGRESS_THRESHOLD = 3;

export function runNoProgressWatchdog(
  task: ResourceTask,
  observations: readonly WatchdogObservation[],
  workers: readonly Worker[],
): WatchdogResult {
  let consecutiveNoProgress = 0;
  for (let index = observations.length - 1; index >= 0; index -= 1) {
    if (observations[index]?.progress) break;
    consecutiveNoProgress += 1;
  }

  const currentWorkerId = observations.at(-1)?.workerId;
  const currentWorker = workers.find((worker) => worker.agentId === currentWorkerId);

  if (consecutiveNoProgress < NO_PROGRESS_THRESHOLD) {
    let route: ResourceRoute | null = null;
    if (currentWorker) {
      try {
        route = routeResource(task, [currentWorker]);
      } catch {
        route = null;
      }
    }
    return { status: "ON_TRACK", consecutiveNoProgress, route };
  }

  let route: ResourceRoute | null = null;
  try {
    route = routeResource(
      task,
      workers.filter((worker) => worker.agentId !== currentWorkerId),
    );
  } catch {
    route = null;
  }
  return { status: "AT_RISK", consecutiveNoProgress, route };
}
