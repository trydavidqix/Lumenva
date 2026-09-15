import { describe, expect, it } from "vitest";
import { assetProvenanceSchema } from "@/lib/content-os/creative/asset-provenance";

describe("Studio asset provenance", () => {
  it("accepts HTTPS source evidence and attribution", () => {
    expect(assetProvenanceSchema.safeParse({ source_url: "https://cdn.example.test/a.png", attribution: "Studio", license: "CC-BY-4.0" }).success).toBe(true);
  });

  it("rejects private or non-HTTPS source URLs", () => {
    expect(assetProvenanceSchema.safeParse({ source_url: "http://127.0.0.1/a.png" }).success).toBe(false);
    expect(assetProvenanceSchema.safeParse({ source_url: "https://cdn.example.test/a.png", extra: "secret" }).success).toBe(false);
  });
});
