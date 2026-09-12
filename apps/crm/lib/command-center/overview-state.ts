export type OverviewAgentStatus = "ACTIVE" | "SHADOW" | "SUSPENDED";
export type OverviewJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type OverviewAgentInput = {
  id: string;
  version: string;
  status: OverviewAgentStatus;
  organizationId: string;
};

export type OverviewCostInput = {
  id: string;
  amount: number;
  currency: string;
  organizationId: string;
};

export type OverviewJobInput = {
  id: string;
  name: string;
  status: OverviewJobStatus;
  organizationId: string;
};

export type OverviewInput = {
  organizationId: string;
  generatedAt: string;
  agents: readonly OverviewAgentInput[];
  costs: readonly OverviewCostInput[];
  jobs: readonly OverviewJobInput[];
};

export type OverviewState = {
  organizationId: string;
  generatedAt: string;
  activeAgents: readonly {
    id: string;
    version: string;
    status: "ACTIVE";
  }[];
  accumulatedCost: { amount: number; currency: string };
  pendingJobs: readonly {
    id: string;
    name: string;
    status: "PENDING";
  }[];
};

function assertTenant(organizationId: string, records: readonly { organizationId: string }[]): void {
  if (records.some((record) => record.organizationId !== organizationId)) {
    throw new Error("overview_tenant_mismatch");
  }
}

export function buildOverviewState(input: OverviewInput): OverviewState {
  assertTenant(input.organizationId, input.agents);
  assertTenant(input.organizationId, input.costs);
  assertTenant(input.organizationId, input.jobs);

  const currency = input.costs[0]?.currency ?? "EUR";
  let amount = 0;
  for (const cost of input.costs) {
    if (!Number.isFinite(cost.amount) || cost.amount < 0 || cost.currency.trim() === "") {
      throw new Error("overview_cost_invalid");
    }
    if (cost.currency !== currency) {
      throw new Error("overview_cost_currency_mismatch");
    }
    amount += cost.amount;
  }

  return {
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    activeAgents: input.agents
      .filter((agent) => agent.status === "ACTIVE")
      .map(({ id, version, status }) => ({ id, version, status }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    accumulatedCost: { amount, currency },
    pendingJobs: input.jobs
      .filter((job) => job.status === "PENDING")
      .map(({ id, name, status }) => ({ id, name, status }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function createMockOverviewState(): OverviewState {
  return buildOverviewState({
    organizationId: "mock-org",
    generatedAt: "2026-09-12T00:00:00.000Z",
    agents: [
      { id: "sales", version: "1.0.0", status: "ACTIVE", organizationId: "mock-org" },
      { id: "support", version: "1.0.0", status: "SHADOW", organizationId: "mock-org" },
    ],
    costs: [
      { id: "cost-1", amount: 10, currency: "EUR", organizationId: "mock-org" },
      { id: "cost-2", amount: 5, currency: "EUR", organizationId: "mock-org" },
    ],
    jobs: [
      { id: "job-1", name: "qualify leads", status: "PENDING", organizationId: "mock-org" },
      { id: "job-2", name: "completed sync", status: "COMPLETED", organizationId: "mock-org" },
    ],
  });
}
