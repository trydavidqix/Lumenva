import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { handleEditorialCollection } from "@/app/api/v1/cron/content-editorial/route";

const ORG = "00000000-0000-4000-8000-000000000001";
const SOURCE = "00000000-0000-4000-8000-000000000002";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/v1/cron/content-editorial", {
    method: "POST",
    headers: { "content-type": "application/json", "x-organization-id": ORG, ...headers },
    body: JSON.stringify(body),
  });
}

describe("editorial collection route contract", () => {
  it("passes only trusted header organization and validated source_id to the service", async () => {
    const collect = vi.fn(async (input: { organizationId: string; sourceId: string }) => input);
    const response = await handleEditorialCollection(request({ source_id: SOURCE }), { collect });
    expect(response.status).toBe(200);
    expect(collect).toHaveBeenCalledWith({ organizationId: ORG, sourceId: SOURCE });
    expect(await response.json()).toMatchObject({ data: { organizationId: ORG, sourceId: SOURCE } });
  });

  it("rejects missing trusted tenant context and malformed source_id", async () => {
    const collect = vi.fn(async () => undefined);
    expect((await handleEditorialCollection(request({ source_id: SOURCE }, { "x-organization-id": "" }), { collect })).status).toBe(422);
    expect((await handleEditorialCollection(request({ source_id: "not-a-uuid" }), { collect })).status).toBe(422);
    expect(collect).not.toHaveBeenCalled();
  });
});
