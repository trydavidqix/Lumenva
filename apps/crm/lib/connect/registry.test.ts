import { describe, expect, it } from "vitest";
import { createConnectRegistry } from "./registry";
import type { ConnectProvider } from "./contracts";

const provider: ConnectProvider = {
  id: "nuvemshop",
  families: ["commerce"],
  capabilities: ["healthCheck", "getProducts", "getOrders", "getSales", "getRefunds"],
};

describe("Connect registry", () => {
  it("registers and resolves a provider", () => {
    const registry = createConnectRegistry([provider]);
    expect(registry.get("nuvemshop")).toEqual(provider);
  });

  it("does not assume unsupported provider capabilities", () => {
    const registry = createConnectRegistry([provider]);
    expect(registry.supports("nuvemshop", "getPayouts")).toBe(false);
    expect(() => registry.requireCapability("nuvemshop", "getPayouts")).toThrow("connect_capability_unavailable");
  });

  it("rejects duplicate provider registrations", () => {
    expect(() => createConnectRegistry([provider, provider])).toThrow("connect_provider_duplicate");
  });
});
