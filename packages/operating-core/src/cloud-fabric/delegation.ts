import type { ExecutionPort, ExecutionResult, TaskContract } from "./execution-port.js";
import { unavailableResult } from "./execution-port.js";
import type { ExecutionTarget, ResourceRouter, TaskRequirements } from "./resource-router.js";
import type { HandoffRequest } from "./handoff.js";
import { createResultDigest, type ResultDigest } from "./result-digest.js";
import type { ContextPacket } from "./context-packet.js";

export interface DelegationContext extends ContextPacket {}

export interface DelegationExecutorInput {
  target: ExecutionTarget & { adapter: ExecutionPort };
  contract: TaskContract;
  context: DelegationContext;
}

export interface MaestriDelegatorOptions {
  route: Pick<ResourceRouter, "route">["route"];
  resolveContext: (request: HandoffRequest, contract: TaskContract) => Promise<DelegationContext>;
  execute: (input: DelegationExecutorInput) => Promise<ExecutionResult>;
}

export interface DelegationResult {
  target: ExecutionTarget;
  context?: DelegationContext;
  result: ExecutionResult;
  digest: ResultDigest;
}

export class MaestriDelegator {
  constructor(private readonly options: MaestriDelegatorOptions) {}

  async delegate(input: { request: HandoffRequest; contract: TaskContract }): Promise<DelegationResult> {
    if (input.request.broker !== "maestri") throw new Error("handoff broker must be maestri");

    const requirements: TaskRequirements = {
      capability: input.contract.capabilities,
      priority: 1,
      risk_level: input.contract.risk === "critical" ? "high" : input.contract.risk,
    };
    const target = await this.options.route(requirements);
    if (!target.adapter) {
      const result = unavailableResult(input.contract.task_id, String(target.provider), target.reason ?? "No executable provider was selected");
      return { target, result, digest: createResultDigest(result) };
    }

    const context = await this.options.resolveContext(input.request, input.contract);
    const contract = { ...input.contract, context_packet: context };
    const result = await this.options.execute({ target: target as ExecutionTarget & { adapter: ExecutionPort }, contract, context });
    return { target, context, result, digest: createResultDigest(result) };
  }
}
