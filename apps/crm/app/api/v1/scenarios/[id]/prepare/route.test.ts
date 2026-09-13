import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireRole = vi.fn();
vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...args: unknown[]) => requireRole(...args) }));

const prepareScenario = vi.fn();
vi.mock("@/lib/agent-engine/scenario/prepare", () => ({ prepareScenario: (...args: unknown[]) => prepareScenario(...args) }));
vi.mock("@/lib/agent-engine/scenario/runtime", () => ({ getScenarioDbPool: () => ({ kind: "pool" }) }));

import { POST } from "./route";

const request = () => new NextRequest("http://localhost:3000/api/v1/scenarios/scenario-1/prepare", { method: "POST" });
const params = { params: Promise.resolve({ id: "scenario-1" }) };

beforeEach(() => {
  requireRole.mockReset();
  prepareScenario.mockReset();
  requireRole.mockResolvedValue({ ok: true, org: { orgId: "org-a" }, user: { id: "user-1" } });
  prepareScenario.mockResolvedValue({ scenarioId: "scenario-1", organizationId: "org-a", status: "READY", strategies: [] });
});

describe("POST /api/v1/scenarios/:id/prepare", () => {
  it("forwards auth failures", async () => {
    requireRole.mockResolvedValue({ ok: false, response: new Response("forbidden", { status: 403 }) });
    const response = await POST(request(), params);
    expect(response.status).toBe(403);
    expect(prepareScenario).not.toHaveBeenCalled();
  });

  it("uses only the authenticated organization as tenant scope", async () => {
    const response = await POST(request(), params);
    expect(response.status).toBe(200);
    expect(prepareScenario).toHaveBeenCalledWith(expect.anything(), "org-a", "scenario-1");
  });

  it("returns conflict for a non-DRAFT scenario", async () => {
    prepareScenario.mockRejectedValue(new Error("Scenario preparation conflict for scenario-1: expected DRAFT."));
    const response = await POST(request(), params);
    expect(response.status).toBe(409);
  });
});
