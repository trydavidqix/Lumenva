import { describe, expect, it, vi } from "vitest";
import { createVoiceOrganizationResolver } from "./resolve-organization";

describe("voice organization resolver", () => {
  it("resolves exactly one enabled tenant by the called E.164 number", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ organization_id: "org-1" }] });
    const resolver = createVoiceOrganizationResolver({ query });
    await expect(resolver.resolve("telnyx", "+351211234567")).resolves.toBe("org-1");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("voice_phone_numbers"), ["telnyx", "+351211234567"]);
  });

  it("fails closed when number is unknown", async () => {
    const resolver = createVoiceOrganizationResolver({ query: async () => ({ rows: [] }) });
    await expect(resolver.resolve("telnyx", "+351211234567")).resolves.toBeNull();
  });

  it("rejects non-E.164 inputs before database access", async () => {
    const query = vi.fn();
    const resolver = createVoiceOrganizationResolver({ query });
    await expect(resolver.resolve("telnyx", "211234567")).rejects.toThrow(/e\.164/i);
    expect(query).not.toHaveBeenCalled();
  });
});

describe("voice organization resolver — SIP/BYOC (Fase 2)", () => {
  it("resolves conexão -> número -> organização when both checks match", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: "conn-1", organization_id: "org-1" }] })
      .mockResolvedValueOnce({ rows: [{ organization_id: "org-1" }] });
    const resolver = createVoiceOrganizationResolver({ query });

    await expect(resolver.resolveByConnection("asterisk", "sip-conn-abc", "+351211234567")).resolves.toBe(
      "org-1",
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("voice_sip_connections"),
      ["asterisk", "sip-conn-abc"],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("voice_phone_numbers"),
      ["conn-1", "+351211234567", "org-1"],
    );
  });

  it("requires an asterisk-owned number whose ownership was verified", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: "conn-1", organization_id: "org-1" }] })
      .mockResolvedValueOnce({ rows: [{ organization_id: "org-1" }] });
    const resolver = createVoiceOrganizationResolver({ query });

    await expect(resolver.resolveByConnection("asterisk", "sip-conn-abc", "+351211234567")).resolves.toBe(
      "org-1",
    );
    const numberSql = query.mock.calls[1]?.[0] as string;
    expect(numberSql).toContain("provider = 'asterisk'");
    expect(numberSql).toContain("ownership_verified_at is not null");
  });

  it("rejects an unknown or unverified connection without ever querying the number", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] });
    const resolver = createVoiceOrganizationResolver({ query });

    await expect(resolver.resolveByConnection("asterisk", "unknown-conn", "+351211234567")).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("rejects a verified connection whose number is not registered under it", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: "conn-1", organization_id: "org-1" }] })
      .mockResolvedValueOnce({ rows: [] });
    const resolver = createVoiceOrganizationResolver({ query });

    await expect(resolver.resolveByConnection("asterisk", "sip-conn-abc", "+351211234567")).resolves.toBeNull();
  });

  it("fails closed on ambiguous connection ownership", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        { id: "conn-1", organization_id: "org-1" },
        { id: "conn-2", organization_id: "org-2" },
      ],
    });
    const resolver = createVoiceOrganizationResolver({ query });

    await expect(resolver.resolveByConnection("asterisk", "sip-conn-abc", "+351211234567")).rejects.toThrow(
      /ambiguous sip connection/i,
    );
  });

  it("rejects non-E.164 numbers and blank connection ids before database access", async () => {
    const query = vi.fn();
    const resolver = createVoiceOrganizationResolver({ query });
    await expect(resolver.resolveByConnection("asterisk", "sip-conn-abc", "211234567")).rejects.toThrow(/e\.164/i);
    await expect(resolver.resolveByConnection("asterisk", "  ", "+351211234567")).rejects.toThrow(
      /connection id is required/i,
    );
    expect(query).not.toHaveBeenCalled();
  });
});
