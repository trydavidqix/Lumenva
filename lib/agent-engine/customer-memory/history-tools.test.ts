import { describe, expect, it, vi } from "vitest";
import { createCustomerHistoryReader } from "./history-tools";

function db(rows: unknown[]) {
  return { query: vi.fn().mockResolvedValue({ rows }) };
}

describe("customer history reader", () => {
  it("always scopes history reads by organization and contact", async () => {
    const client = db([{ direction: "inbound", body: "olá", sent_at: new Date("2026-08-24T12:00:00Z") }]);
    const reader = createCustomerHistoryReader(client);
    const result = await reader.getRecentMessages("org-a", "contact-a", 10);
    expect(result).toHaveLength(1);
    const [sql, params] = client.query.mock.calls[0]!;
    expect(sql).toMatch(/organization_id\s*=\s*\$1/i);
    expect(sql).toMatch(/contact_id\s*=\s*\$2/i);
    expect(params).toEqual(["org-a", "contact-a", 10]);
  });

  it("caps raw history so it cannot become an unbounded prompt dump", async () => {
    const client = db([]);
    const reader = createCustomerHistoryReader(client);
    await reader.getRecentMessages("org-a", "contact-a", 9999);
    expect(client.query.mock.calls[0]![1]).toEqual(["org-a", "contact-a", 50]);
  });
});
