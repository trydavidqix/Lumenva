import { describe, expect, it } from "vitest";

import { routeResource, type ResourceTask, type Worker } from "./resource-router";

const task: ResourceTask = {
  taskId: "task-1",
  requiredCapabilities: ["browser", "typescript"],
};

const workers: Worker[] = [
  { agentId: "cloud-1", surface: "Cloud", capabilities: ["browser", "typescript"], currentLoad: 8, capacity: 10, healthy: true },
  { agentId: "linux-1", surface: "Linux", capabilities: ["browser", "typescript"], currentLoad: 2, capacity: 10, healthy: true },
  { agentId: "vps-1", surface: "VPS", capabilities: ["browser"], currentLoad: 0, capacity: 10, healthy: true },
];

describe("Resource Router mínimo", () => {
  it("escolhe agente apto com menor carga e devolve a superfície", () => {
    expect(routeResource(task, workers)).toEqual({
      agentId: "linux-1",
      surface: "Linux",
    });
  });

  it("falha fechado quando nenhum worker tem todas as capabilities ou capacidade", () => {
    expect(() => routeResource({ ...task, requiredCapabilities: ["voice"] }, workers)).toThrow("resource_router_no_apt_worker");
    expect(() => routeResource(task, workers.map((worker) => ({ ...worker, currentLoad: 10 })))).toThrow("resource_router_no_apt_worker");
  });

  it("ignora worker unhealthy e desempata por agentId", () => {
    const result = routeResource(
      { taskId: "task-2", requiredCapabilities: ["browser"] },
      [
        { agentId: "zeta", surface: "VPS", capabilities: ["browser"], currentLoad: 1, capacity: 2, healthy: true },
        { agentId: "alpha", surface: "Cloud", capabilities: ["browser"], currentLoad: 1, capacity: 2, healthy: true },
        { agentId: "offline", surface: "Linux", capabilities: ["browser"], currentLoad: 0, capacity: 2, healthy: false },
      ],
    );
    expect(result).toEqual({ agentId: "alpha", surface: "Cloud" });
  });

  it("falha fechado para task sem identidade ou capabilities válidas", () => {
    expect(() => routeResource({ taskId: " ", requiredCapabilities: ["browser"] }, workers)).toThrow("resource_router_invalid_task");
    expect(() => routeResource({ taskId: "task-3", requiredCapabilities: [" "] }, workers)).toThrow("resource_router_invalid_task");
    expect(() => routeResource({ taskId: "task-3", requiredCapabilities: undefined as unknown as string[] }, workers)).toThrow("resource_router_invalid_task");
  });
});
