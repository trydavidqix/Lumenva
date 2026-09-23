import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: vi.fn(async () => null),
}));
vi.mock("@/lib/auth/provision", () => ({ ensureTenantForUser: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

import { GET } from "./route";

describe("/auth/confirm redirect safety", () => {
  it("keeps an oobCode opaque instead of allowing it to inject an external next", async () => {
    const request = new NextRequest(
      "https://crm.example/auth/confirm?oobCode=x%26next%3Dhttps%3A%2F%2Fevil.example",
    );

    const response = await GET(request);
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.origin).toBe("https://crm.example");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("oobCode")).toBe("x&next=https://evil.example");
    expect(location.searchParams.get("next")).toBeNull();
  });
});
