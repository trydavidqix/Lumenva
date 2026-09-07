import { describe, expect, it } from "vitest";
import { assertSafeAssetUrl, contentAssetObjectKey, registerContentAsset, ContentAssetValidationError } from "@/lib/content-os/creative/asset-service";

describe("Content OS canonical assets", () => {
  it("scopes storage keys by organization and asset", () => { expect(contentAssetObjectKey({ organizationId: "org-1", assetId: "asset-1", extension: "PNG" })).toBe("content-os/org-1/asset-1.png"); });
  it("rejects private worker URLs", () => { expect(() => assertSafeAssetUrl("http://127.0.0.1/output.png")).toThrow(ContentAssetValidationError); });
  it("registers checksum and storage metadata without provider URL", async () => {
    const result = await registerContentAsset({ create: async (input) => input as never }, { organizationId: "org-1", assetType: "image", mimeType: "image/png", bytes: new Uint8Array([1, 2, 3]), originProvider: "comfy" });
    expect(result.storage_path).toContain("content-os/org-1/"); expect(result.checksum).toHaveLength(64); expect(result).not.toHaveProperty("url");
  });
});
