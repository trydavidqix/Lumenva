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
const listReports = vi.fn();

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
  vi.mocked(createMobileComplianceReadModel).mockReturnValue({ listReports, getReport: vi.fn() });
});

describe("GET /api/v1/mobile-releases", () => {
  it("repassa falha de autorização e não consulta dados", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: false,
      response: fail("unauthenticated", "Auth required.", 401, {}),
    });

    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/v1/mobile-releases"));

    expect(res.status).toBe(401);
    expect(listReports).not.toHaveBeenCalled();
  });

  it("usa exclusivamente a organização autenticada e filtros validados", async () => {
    authOk();
    listReports.mockResolvedValue([{ reportId: "report-1" }]);

    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/v1/mobile-releases?project_id=project-1&verdict=BLOCK&limit=20"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(listReports).toHaveBeenCalledWith(ORG_ID, {
      projectId: "project-1",
      verdict: "BLOCK",
      limit: 20,
    });
    expect(body.data.reports).toEqual([{ reportId: "report-1" }]);
  });

  it("rejeita verdict desconhecido antes de acessar o repositório", async () => {
    authOk();

    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/v1/mobile-releases?verdict=IGNORE"));

    expect(res.status).toBe(422);
    expect(listReports).not.toHaveBeenCalled();
  });
});
