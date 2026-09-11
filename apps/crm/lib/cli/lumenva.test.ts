import { describe, expect, it } from "vitest";
import { parseLumenvaArgs } from "@/lib/cli/lumenva";

describe("lumenva CLI contract", () => {
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
});
