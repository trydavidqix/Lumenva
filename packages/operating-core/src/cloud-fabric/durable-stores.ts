import type { ExecutionResult, MasterPlan, ResultDigest } from './execution-port';
import type { RoutingObservation } from './learning-router';
import type { RoutingTrace } from './routing-observability';

export interface WorkforcePersistence {
  savePlan(plan: MasterPlan): Promise<void>;
  getPlan(planId: string): Promise<MasterPlan | undefined>;
  saveExecution(result: ExecutionResult): Promise<void>;
  saveDigest(digest: ResultDigest): Promise<void>;
  saveRoutingTrace(trace: RoutingTrace): Promise<void>;
  saveObservation(observation: RoutingObservation): Promise<void>;
}

export class InMemoryWorkforcePersistence implements WorkforcePersistence {
  readonly plans = new Map<string, MasterPlan>();
  readonly executions: ExecutionResult[] = [];
  readonly digests: ResultDigest[] = [];
  readonly routingTraces: RoutingTrace[] = [];
  readonly observations: RoutingObservation[] = [];

  async savePlan(plan: MasterPlan): Promise<void> { this.plans.set(plan.plan_id, plan); }
  async getPlan(planId: string): Promise<MasterPlan | undefined> { return this.plans.get(planId); }
  async saveExecution(result: ExecutionResult): Promise<void> { this.executions.push(result); }
  async saveDigest(digest: ResultDigest): Promise<void> { this.digests.push(digest); }
  async saveRoutingTrace(trace: RoutingTrace): Promise<void> { this.routingTraces.push(trace); }
  async saveObservation(observation: RoutingObservation): Promise<void> { this.observations.push(observation); }
}
