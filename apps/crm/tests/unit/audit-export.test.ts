import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/auth/require-role", () => ({
  requireRole: vi.fn(async () => ({ ok: true, user: { id: "manager-1" }, org: { orgId: "org-1" } })),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function clientStub(rows: unknown[]) {
  const filters: Array<[string, string, unknown]> = [];
  const query: Record<string, unknown> = {
    select: () => query,
    eq: (field: string, value: unknown) => { filters.push(["eq", field, value]); return query; },
    ilike: (field: string, value: unknown) => { filters.push(["ilike", field, value]); return query; },
    gte: (field: string, value: unknown) => { filters.push(["gte", field, value]); return query; },
    lte: (field: string, value: unknown) => { filters.push(["lte", field, value]); return query; },
    order: () => query,
    limit: () => query,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  return { client: { from: () => query }, filters };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/v1/audit/export", () => {
  it("aplica os mesmos filtros de tenant/consulta e escapa CSV", async () => {
    const stub = clientStub([
      {
        id: "a1",
        created_at: "2026-09-10T10:00:00Z",
        actor_user_id: "11111111-1111-4111-8111-111111111111",
        action: "member,revoked",
        resource_type: "membership",
        resource_id: "m1",
        request_id: "r1",
        actor_ip: null,
        metadata: { note: "line\nvalue" },
      },
    ]);
    vi.mocked(createClient).mockResolvedValue(stub.client as never);
    const { GET } = await import("@/app/api/v1/audit/export/route");
    const req = new NextRequest("http://localhost/api/v1/audit/export?actor_id=11111111-1111-4111-8111-111111111111&action=revoked&resource_type=membership&from=2026-09-01T00:00:00Z&to=2026-09-30T23:59:59Z&limit=1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(await res.text()).toContain('"member,revoked"');
    expect(await Promise.resolve(stub.filters)).toEqual(expect.arrayContaining([
      ["eq", "organization_id", "org-1"],
      ["eq", "actor_user_id", "11111111-1111-4111-8111-111111111111"],
      ["ilike", "action", "%revoked%"],
      ["eq", "resource_type", "membership"],
      ["gte", "created_at", "2026-09-01T00:00:00Z"],
      ["lte", "created_at", "2026-09-30T23:59:59Z"],
    ]));
  });
});
