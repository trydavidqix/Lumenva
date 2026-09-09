import { describe, expect, it, vi } from "vitest";

import { fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { GET, POST } from "./route";

describe("Content OS sources API", () => {
  it("enforces authentication before listing tenant sources", async () => {
    vi.mocked(requireRole).mockResolvedValue({ ok: false, response: fail("unauthenticated", "Auth required.", 401) });
    expect((await GET()).status).toBe(401);
  });

  it("rejects malformed source creation before database access", async () => {
    vi.mocked(requireRole).mockResolvedValue({ ok: true, user: { id: "u1" } as never, org: { orgId: "org-a", name: "A", role: "manager" } });
    const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ catalog_key: "https://attacker.example/feed" }) }) as never);
    expect(response.status).toBe(400);
  });
});
