import { describe, expect, it } from "vitest";

import {
  buildOverviewState,
  createMockOverviewState,
  type OverviewInput,
} from "./overview-state";

const input: OverviewInput = {
  organizationId: "org-a",
  generatedAt: "2026-09-12T20:00:00.000Z",
  agents: [
    { id: "sales", version: "1.0.0", status: "ACTIVE", organizationId: "org-a" },
    { id: "support", version: "1.0.0", status: "SHADOW", organizationId: "org-a" },
  ],
  costs: [
    { id: "cost-1", amount: 12.5, currency: "EUR", organizationId: "org-a" },
    { id: "cost-2", amount: 7.5, currency: "EUR", organizationId: "org-a" },
  ],
  jobs: [
    { id: "job-1", name: "sync contacts", status: "PENDING", organizationId: "org-a" },
    { id: "job-2", name: "finished", status: "COMPLETED", organizationId: "org-a" },
  ],
};

describe("Command Center overview state", () => {
  it("lists active agents, sums accumulated cost and lists pending jobs", () => {
    expect(buildOverviewState(input)).toEqual({
      organizationId: "org-a",
      generatedAt: "2026-09-12T20:00:00.000Z",
      activeAgents: [{ id: "sales", version: "1.0.0", status: "ACTIVE" }],
      accumulatedCost: { amount: 20, currency: "EUR" },
      pendingJobs: [{ id: "job-1", name: "sync contacts", status: "PENDING" }],
    });
  });

  it("fails closed when an input record belongs to another tenant", () => {
    expect(() =>
      buildOverviewState({
        ...input,
        jobs: [{ ...input.jobs[0], organizationId: "org-b" }],
      }),
    ).toThrow("overview_tenant_mismatch");
  });

  it("rejects mixed currencies and invalid cost amounts", () => {
    expect(() =>
      buildOverviewState({
        ...input,
        costs: [...input.costs, { id: "cost-3", amount: 1, currency: "USD", organizationId: "org-a" }],
      }),
    ).toThrow("overview_cost_currency_mismatch");

    expect(() =>
      buildOverviewState({
        ...input,
        costs: [{ ...input.costs[0], amount: Number.NaN }],
      }),
    ).toThrow("overview_cost_invalid");
  });

  it("provides a deterministic provider-free mock overview", () => {
    expect(createMockOverviewState()).toEqual({
      organizationId: "mock-org",
      generatedAt: "2026-09-12T00:00:00.000Z",
      activeAgents: [{ id: "sales", version: "1.0.0", status: "ACTIVE" }],
      accumulatedCost: { amount: 15, currency: "EUR" },
      pendingJobs: [{ id: "job-1", name: "qualify leads", status: "PENDING" }],
    });
  });
});
