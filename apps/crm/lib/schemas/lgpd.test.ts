import { describe, expect, it } from "vitest";
import { lgpdExportPackageSchema, lgpdExportQuerySchema } from "./lgpd";

describe("LGPD export package contract", () => {
  it("defaults to ZIP and validates the manifest shape", () => {
    expect(lgpdExportQuerySchema.parse({})).toEqual({ format: "zip" });
    expect(lgpdExportPackageSchema.parse({
      version: "f6",
      request_id: "00000000-0000-4000-8000-000000000001",
      generated_at: "2026-09-10T20:00:00.000Z",
      signed_pades: false,
      files: [{ name: "data.json", media_type: "application/json" }],
    }).version).toBe("f6");
  });
});
