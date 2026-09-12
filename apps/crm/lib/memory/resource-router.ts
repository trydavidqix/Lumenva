export type ResourceSurface = "Cloud" | "Linux" | "VPS";

export interface ResourceTask {
  taskId: string;
  requiredCapabilities: string[];
}

export interface Worker {
  agentId: string;
  surface: ResourceSurface;
  capabilities: string[];
  currentLoad: number;
  capacity: number;
  healthy: boolean;
}

export interface ResourceRoute {
  agentId: string;
  surface: ResourceSurface;
}

export function routeResource(
  task: ResourceTask,
  workers: readonly Worker[],
): ResourceRoute {
  const required = [...new Set(task.requiredCapabilities)];
  const candidates = workers.filter((worker) =>
    worker.healthy &&
    Number.isFinite(worker.currentLoad) &&
    Number.isFinite(worker.capacity) &&
    worker.capacity > 0 &&
    worker.currentLoad >= 0 &&
    worker.currentLoad < worker.capacity &&
    required.every((capability) => worker.capabilities.includes(capability)),
  );

  const selected = [...candidates].sort((a, b) =>
    a.currentLoad / a.capacity - b.currentLoad / b.capacity ||
    a.currentLoad - b.currentLoad ||
    a.agentId.localeCompare(b.agentId),
  )[0];

  if (!selected) throw new Error("resource_router_no_apt_worker");

  return { agentId: selected.agentId, surface: selected.surface };
}
