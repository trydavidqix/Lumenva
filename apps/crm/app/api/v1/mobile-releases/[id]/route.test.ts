import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { fail } from "@/lib/api/wrappers";
import { createMobileComplianceReadModel } from "@/lib/product-factory/mobile-compliance/read-model";
import { createSupabaseMobileComplianceRepository } from "@/lib/product-factory/mobile-compliance/supabase-read-repository";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/product-factory/mobile-compliance/read-model", () => ({ createMobileComplianceReadModel: vi.fn() }));
vi.mock("@/lib/product-factory/mobile-compliance/supabase-read-repository", () => ({ createSupabaseMobileComplianceRepository: vi.fn() }));

const ORG_ID = "22222222-2222-4222-8222-222222222222";
const getReport = vi.fn();

function authOk() {
  vi.mocked(requireRole).mockResolvedValue({
    ok: true,
    user: { id: "11111111-1111-4111-8111-111111111111" },
    org: { orgId: ORG_ID, name: "Org", role: "manager" },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createSupabaseMobileComplianceRepository).mockReturnValue({} as never);
  vi.mocked(createMobileComplianceReadModel).mockReturnValue({ listReports: vi.fn(), getReport });
});

describe("GET /api/v1/mobile-releases/[id]", () => {
  it("repassa falha de autorização", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: false,
      response: fail("unauthenticated", "Auth required.", 401, {}),
    });

    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/v1/mobile-releases/report-1"), {
      params: Promise.resolve({ id: "report-1" }),
    });

    expect(res.status).toBe(401);
    expect(getReport).not.toHaveBeenCalled();
  });

  it("resolve o relatório dentro do tenant autenticado", async () => {
    authOk();
    getReport.mockResolvedValue({ report: { reportId: "report-1" }, findings: [{ ruleId: "APPLE.ACCOUNT_DELETE" }] });

    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/v1/mobile-releases/report-1"), {
      params: Promise.resolve({ id: "report-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(getReport).toHaveBeenCalledWith(ORG_ID, "report-1");
    expect(body.data.report.reportId).toBe("report-1");
  });

  it("retorna 404 sem vazar existência fora do tenant", async () => {
    authOk();
    getReport.mockResolvedValue(null);

    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/v1/mobile-releases/unknown"), {
      params: Promise.resolve({ id: "unknown" }),
    });

    expect(res.status).toBe(404);
  });
});
