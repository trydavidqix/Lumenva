import { describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api/wrappers";
import { GET, DELETE } from "./route";
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { requireRole } from "@/lib/auth/require-role";
describe("Content OS publication item API", () => {
  it("enforces authentication for reads and cancellation", async () => { vi.mocked(requireRole).mockResolvedValue({ ok: false, response: fail("unauthenticated", "Auth required.", 401) }); const context = { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) }; expect((await GET(new Request("http://localhost") as never, context)).status).toBe(401); expect((await DELETE(new Request("http://localhost", { method: "DELETE" }) as never, context)).status).toBe(401); });
});
