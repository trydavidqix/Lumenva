import { describe, expect, it, vi } from "vitest";
import { createVoiceCallerResolver, type VoiceIdentityQueryable } from "./resolve-caller";

function db(rows: unknown[]): VoiceIdentityQueryable & { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn().mockResolvedValue({ rows }) };
}

describe("voice caller recognition", () => {
  it("queries contacts only inside the already-resolved organization", async () => {
    const client = db([{ id: "contact-a" }]);
    const memory = { getQuickMemory: vi.fn().mockResolvedValue({ organizationId: "org-a", contactId: "contact-a" }) };
    const result = await createVoiceCallerResolver(client, memory).resolve("org-a", "+351911111111");
    const [sql, params] = client.query.mock.calls[0]!;
    expect(sql).toMatch(/organization_id\s*=\s*\$1/i);
    expect(sql).toMatch(/phone_number\s*=\s*any\(\$2::text\[\]\)/i);
    expect(params[0]).toBe("org-a");
    expect(params[1]).toEqual(["+351911111111"]);
    expect(result).toEqual({ kind: "known", contactId: "contact-a", quickMemory: { organizationId: "org-a", contactId: "contact-a" } });
    expect(memory.getQuickMemory).toHaveBeenCalledWith("org-a", "contact-a");
  });

  it("reuses conservative phone lookup variants without rewriting stored identity", async () => {
    const client = db([{ id: "contact-br" }]);
    const memory = { getQuickMemory: vi.fn().mockResolvedValue(null) };
    await createVoiceCallerResolver(client, memory).resolve("org-a", "+553198966398");
    expect(client.query.mock.calls[0]![1][1]).toEqual(["+553198966398", "+5531998966398"]);
  });

  it("keeps an unknown caller unknown instead of inventing or auto-creating identity", async () => {
    const client = db([]);
    const memory = { getQuickMemory: vi.fn() };
    const result = await createVoiceCallerResolver(client, memory).resolve("org-a", "+351922222222");
    expect(result).toEqual({ kind: "unknown", contactId: null, quickMemory: null });
    expect(memory.getQuickMemory).not.toHaveBeenCalled();
  });

  it("fails closed if duplicate contacts inside one tenant match the same caller", async () => {
    const client = db([{ id: "contact-1" }, { id: "contact-2" }]);
    const memory = { getQuickMemory: vi.fn() };
    await expect(createVoiceCallerResolver(client, memory).resolve("org-a", "+351933333333"))
      .rejects.toThrow(/ambiguous caller identity/i);
  });
});
