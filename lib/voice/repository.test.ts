import { describe, expect, it, vi } from "vitest";

import { createVoiceRepository } from "./repository";

function db(rows: unknown[] = []) {
  return { query: vi.fn().mockResolvedValue({ rows }) };
}

describe("voice repository", () => {
  it("creates calls with organization_id supplied explicitly", async () => {
    const client = db([{ id: "call-1" }]);
    const repo = createVoiceRepository(client);
    await repo.createCall({
      id: "call-1",
      organizationId: "org-a",
      contactId: null,
      agentId: null,
      conversationId: null,
      direction: "inbound",
      callerNumber: "+351211111111",
      calledNumber: "+351219999999",
      state: "ringing",
      provider: "telnyx",
      providerCallId: "telnyx-call-1",
    });
    const [sql, params] = client.query.mock.calls[0]!;
    expect(sql).toMatch(/insert into voice_calls/i);
    expect(sql).toMatch(/organization_id/i);
    expect(params[1]).toBe("org-a");
  });

  it("scopes call updates by both call id and organization", async () => {
    const client = db([{ id: "call-1" }]);
    const repo = createVoiceRepository(client);
    await repo.updateState("org-a", "call-1", "active");
    const [sql, params] = client.query.mock.calls[0]!;
    expect(sql).toMatch(/where organization_id = \$1 and id = \$2/i);
    expect(params).toEqual(["org-a", "call-1", "active"]);
  });

  it("appends normalized provider events idempotently per organization", async () => {
    const client = db([{ id: "event-1" }]);
    const repo = createVoiceRepository(client);
    await repo.appendProviderEvent({
      organizationId: "org-a",
      voiceCallId: "call-1",
      provider: "telnyx",
      providerEventId: "evt-1",
      eventType: "call.answered",
      attributes: { callControlId: "ctrl-1", hangupCause: null },
      occurredAt: "2026-08-26T11:15:00.000Z",
    });
    const [sql, params] = client.query.mock.calls[0]!;
    expect(sql).toMatch(/on conflict \(organization_id, provider, provider_event_id\) do nothing/i);
    expect(sql).toMatch(/attributes/i);
    expect(sql).not.toMatch(/\bpayload\b/i);
    expect(String(params[5])).toContain("callControlId");
  });
});
