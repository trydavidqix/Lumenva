import { describe, expect, it } from "vitest";

import { NAV_DESTINATIONS } from "@/lib/navigation/registry";

describe("mobile releases dashboard navigation", () => {
  it("publishes a manager-only Analysis destination for release compliance", () => {
    expect(NAV_DESTINATIONS).toContainEqual(
      expect.objectContaining({
        href: "/app/mobile-releases",
        label: "Mobile Releases",
        group: "analise",
        minRole: "manager",
        sidebar: true,
      }),
    );
  });
});
