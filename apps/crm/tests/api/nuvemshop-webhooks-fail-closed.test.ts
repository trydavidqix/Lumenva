import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  integration: null as {
    id: string;
    organization_id: string;
    webhook_secret_encrypted: string | null;
  } | null,
  from: vi.fn(),
  rpc: vi.fn(),
  audit: vi.fn(),
  createLgpdRequest: vi.fn(),
  findContactByExternalId: vi.fn(),
  emitEvent: vi.fn(),
  checkRateLimit: vi.fn(),
}));

const lookup = {
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
};
lookup.select.mockImplementation(() => lookup);
lookup.eq.mockImplementation(() => lookup);
lookup.maybeSingle.mockImplementation(async () => ({ data: harness.integration, error: null }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: harness.from, rpc: harness.rpc }),
}));
vi.mock("@/lib/audit", () => ({ audit: harness.audit }));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({ checkRateLimit: harness.checkRateLimit }));
vi.mock("@/lib/lgpd/repository", () => ({
  createLgpdRequest: harness.createLgpdRequest,
  findContactByExternalId: harness.findContactByExternalId,
}));
vi.mock("@/lib/ecommerce/feature-flag", () => ({
  verifyNuvemshopWebhook: vi.fn(() => false),
}));

import { POST as customerDataRequest } from "@/app/api/v1/webhooks/nuvemshop/customer-data-request/route";
import { POST as customerRedact } from "@/app/api/v1/webhooks/nuvemshop/customer-redact/route";
import { POST as storeRedact } from "@/app/api/v1/webhooks/nuvemshop/store-redact/route";
import { POST as eventWebhook } from "@/app/api/v1/webhooks/nuvemshop/[event]/route";

const lgpdRequestBody = JSON.stringify({
  store_id: 123,
  customer: { id: 456, email: "person@example.com" },
});
const eventBody = JSON.stringify({ store_id: 123, id: 789 });

const missingSecretHandlers: Array<{
  name: string;
  post: (request: NextRequest) => Promise<NextResponse>;
}> = [
  { name: "customer-data-request", post: customerDataRequest },
  { name: "customer-redact", post: customerRedact },
  { name: "store-redact", post: storeRedact },
  {
    name: "event webhook",
    post: (request) => eventWebhook(request, { params: Promise.resolve({ event: "order-created" }) }),
  },
];

function request(path: string, body: string): NextRequest {
  return new NextRequest(`http://localhost/api/v1/webhooks/nuvemshop/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("Nuvemshop webhook authentication is fail-closed without signing config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NUVEMSHOP_APP_ID", "");
    vi.stubEnv("NUVEMSHOP_CLIENT_ID", "");
    vi.stubEnv("NUVEMSHOP_CLIENT_SECRET", "");
    harness.integration = {
      id: "integration-1",
      organization_id: "org-test",
      webhook_secret_encrypted: null,
    };
    harness.from.mockReturnValue(lookup);
    harness.rpc.mockResolvedValue({ data: null, error: null });
    harness.audit.mockResolvedValue(undefined);
    harness.createLgpdRequest.mockResolvedValue({ id: "lgpd-test", due_at: "2030-01-01" });
    harness.findContactByExternalId.mockResolvedValue(null);
    harness.checkRateLimit.mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(missingSecretHandlers)("$name rejects an integration with no webhook secret before side effects", async ({ name, post }) => {
    const body = name === "event webhook" ? eventBody : lgpdRequestBody;
    const response = await post(request(name, body));

    expect(response.status).toBe(401);
    expect(harness.rpc).not.toHaveBeenCalled();
    expect(harness.createLgpdRequest).not.toHaveBeenCalled();
    expect(harness.findContactByExternalId).not.toHaveBeenCalled();
    expect(harness.from).toHaveBeenCalledTimes(1);
  });

  it("returns 404 for an event webhook with no configured tenant", async () => {
    harness.integration = null;

    const response = await eventWebhook(request("order-created", eventBody), {
      params: Promise.resolve({ event: "order-created" }),
    });

    expect(response.status).toBe(404);
    expect(harness.rpc).not.toHaveBeenCalled();
    expect(harness.createLgpdRequest).not.toHaveBeenCalled();
    expect(harness.from).toHaveBeenCalledTimes(1);
  });
});
