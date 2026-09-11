import { describe, expect, it, vi } from "vitest";

const { auditSpy } = vi.hoisted(() => ({
  auditSpy: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/mcp/audit", () => ({ auditMcpToolCall: auditSpy }));
import { invokeLumenvaCommand, parseLumenvaArgs, validateLumenvaToolArgs } from "@/lib/cli/lumenva";

describe("lumenva CLI contract", () => {
  const auth = {
    organizationId: "org-1",
    role: "agent" as const,
    actor: { type: "user" as const, id: "user-1", role: "agent" as const },
    apiTokenId: "token-1",
    scopes: ["mcp:read"],
  };

  it("parses the same tool name and JSON object arguments used by MCP", () => {
    expect(parseLumenvaArgs(["crm_list_leads", '{"limit":10}'])).toEqual({
      toolName: "crm_list_leads",
      args: { limit: 10 },
    });
  });

  it("rejects malformed or non-object arguments before invoking a tool", () => {
    expect(() => parseLumenvaArgs(["crm_list_leads", "["])).toThrow("invalid_json_args");
    expect(() => parseLumenvaArgs(["crm_list_leads", "[]"])).toThrow("json_args_must_be_object");
    expect(() => parseLumenvaArgs(["--help"])).toThrow("usage: lumenva");
  });

  it("rejects arguments that violate the MCP tool input schema", () => {
    expect(() =>
      validateLumenvaToolArgs("crm_list_leads", { limit: "10" }),
    ).toThrow();
    expect(
      validateLumenvaToolArgs("crm_list_leads", {}),
    ).toMatchObject({ limit: 20 });
  });

  it("keeps MCP authorization before schema validation and audits failures", async () => {
    auditSpy.mockClear();
    await expect(
      invokeLumenvaCommand({
        command: { toolName: "crm_list_leads", args: { limit: "10" } },
        auth: { ...auth, scopes: [] },
        requestId: "req-1",
        supabase: {} as never,
      }),
    ).rejects.toThrow("Token missing required scope");
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "crm_list_leads",
        success: false,
      }),
    );
  });
});
