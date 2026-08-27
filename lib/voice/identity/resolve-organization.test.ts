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
