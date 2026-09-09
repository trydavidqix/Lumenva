import { describe, expect, it, vi } from "vitest";

import { fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
import { GET } from "./route";

describe("Content OS source catalog API", () => {
  it("enforces authentication", async () => {
    vi.mocked(requireRole).mockResolvedValue({ ok: false, response: fail("unauthenticated", "Auth required.", 401) });
    expect((await GET()).status).toBe(401);
  });

  it("returns only reviewed catalog entries", async () => {
    vi.mocked(requireRole).mockResolvedValue({ ok: true, user: { id: "u1" } as never, org: { orgId: "org-a", name: "A", role: "manager" } });
    const response = await GET();
    const body = await response.json() as { data: Array<{ key: string; provider: string }> };
    expect(response.status).toBe(200);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((entry) => entry.key.startsWith("github-") && entry.provider === "rsshub")).toBe(true);
  });
});
