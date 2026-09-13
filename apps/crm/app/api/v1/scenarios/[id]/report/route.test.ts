import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireRole = vi.fn();
vi.mock("@/lib/auth/require-role", () => ({ requireRole: (...args: unknown[]) => requireRole(...args) }));

const getScenario = vi.fn();
const getLatestReport = vi.fn();
vi.mock("@/lib/agent-engine/scenario/runtime", () => ({
  getScenarioRepository: () => ({ getScenario, getLatestReport }),
}));

import { GET } from "./route";

function request(): NextRequest {
  return new NextRequest("http://localhost:3000/api/v1/scenarios/scenario-1/report");
}

const params = { params: Promise.resolve({ id: "scenario-1" }) };

beforeEach(() => {
  requireRole.mockReset();
  getScenario.mockReset();
  getLatestReport.mockReset();
  requireRole.mockResolvedValue({ ok: true, org: { orgId: "org-a" }, user: { id: "user-1" } });
  getScenario.mockResolvedValue({ id: "scenario-1", organization_id: "org-a", status: "COMPLETED" });
  getLatestReport.mockResolvedValue({ id: "report-1", organization_id: "org-a", scenario_id: "scenario-1" });
});

describe("GET /api/v1/scenarios/:id/report", () => {
  it("forwards authorization failures without touching persistence", async () => {
    requireRole.mockResolvedValue({ ok: false, response: new Response("forbidden", { status: 403 }) });

    const response = await GET(request(), params);

    expect(response.status).toBe(403);
    expect(getScenario).not.toHaveBeenCalled();
    expect(getLatestReport).not.toHaveBeenCalled();
  });

  it("derives tenant scope exclusively from the authenticated organization", async () => {
    const response = await GET(request(), params);

    expect(response.status).toBe(200);
    expect(getScenario).toHaveBeenCalledWith("org-a", "scenario-1");
    expect(getLatestReport).toHaveBeenCalledWith("org-a", "scenario-1");
    const body = await response.json();
    expect(body.data.report.id).toBe("report-1");
  });

  it("returns 404 when the scenario does not exist in the active tenant", async () => {
    getScenario.mockResolvedValue(null);

    const response = await GET(request(), params);

    expect(response.status).toBe(404);
    expect(getLatestReport).not.toHaveBeenCalled();
  });

  it("returns 404 when no decision brief has been generated yet", async () => {
    getLatestReport.mockResolvedValue(null);

    const response = await GET(request(), params);

    expect(response.status).toBe(404);
  });
});
