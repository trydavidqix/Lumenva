import { describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api/wrappers";
import { GET, POST } from "./route";
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { requireRole } from "@/lib/auth/require-role";
describe("Content OS publications API", () => {
  it("enforces authentication before reading jobs", async () => { vi.mocked(requireRole).mockResolvedValue({ ok: false, response: fail("unauthenticated", "Auth required.", 401) }); expect((await GET()).status).toBe(401); });
  it("requires server-side idempotency key", async () => { vi.mocked(requireRole).mockResolvedValue({ ok: true, user: { id: "u1" } as never, org: { orgId: "o1", name: "Org", role: "manager" } }); const response = await POST(new Request("http://localhost", { method: "POST", body: "{}" }) as never); expect(response.status).toBe(400); expect((await response.json()).error.code).toBe("invalid_request"); });
});
