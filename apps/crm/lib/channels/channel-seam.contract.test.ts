import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getWahaClient: vi.fn(),
  createAdminClient: vi.fn(() => ({ kind: "admin-client" })),
  metaCredsFromEnv: vi.fn(),
  resolveMetaCreds: vi.fn(),
}));

vi.mock("@/lib/waha/client", () => ({
  getWahaClient: mocks.getWahaClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/channels/meta/credentials", () => ({
  metaCredsFromEnv: mocks.metaCredsFromEnv,
  resolveMetaCreds: mocks.resolveMetaCreds,
}));

import { metaCloudAdapter } from "./adapters/meta-cloud";
import { wahaAdapter } from "./adapters/waha";
import type { ChannelAdapter, ChannelProvider, OutboundEnvelope } from "./types";

const textEnvelope: OutboundEnvelope = {
  sessionRef: "session-1",
  to: "351911111111@c.us",
  kind: "text",
  body: "olá",
};

describe("channel seam regression contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWahaClient.mockReturnValue(null);
    mocks.metaCredsFromEnv.mockReturnValue(null);
    mocks.resolveMetaCreds.mockResolvedValue(null);
  });

  it("keeps the current provider union stable inside the canonical channel boundary", () => {
    expectTypeOf<ChannelProvider>().toEqualTypeOf<"waha" | "meta_cloud">();
    expectTypeOf(wahaAdapter).toMatchTypeOf<ChannelAdapter>();
    expectTypeOf(metaCloudAdapter).toMatchTypeOf<ChannelAdapter>();
  });

  it("keeps WAHA recipient, configuration, codes, echo ids and no-op send behavior stable", async () => {
    expect(
      wahaAdapter.resolveRecipient({
        isGroup: false,
        groupChatId: null,
        phoneNumber: "+351 911 111 111",
        waIdentity: null,
      }),
    ).toBe("351911111111@c.us");

    expect(wahaAdapter.isConfigured()).toBe(false);
    expect(wahaAdapter.codes).toEqual({
      notConfigured: "waha_not_configured",
      sendFailed: "waha_error",
      unknownError: "waha_unknown",
    });

    expect(
      wahaAdapter.echoExternalIds?.({
        externalId: "3EB0ABC123",
        recipient: "351911111111@c.us",
      }),
    ).toEqual([
      "3EB0ABC123",
      "true_351911111111@c.us_3EB0ABC123",
    ]);

    await expect(wahaAdapter.send(textEnvelope)).resolves.toEqual({ externalId: null });
    expect(wahaAdapter.fetchProfilePictureUrl).toBeTypeOf("function");
  });

  it("keeps Meta Cloud recipient, configuration, codes and no-op send behavior stable", async () => {
    expect(
      metaCloudAdapter.resolveRecipient({
        isGroup: false,
        groupChatId: null,
        phoneNumber: "+351 (911) 111-111",
        waIdentity: null,
      }),
    ).toBe("351911111111");

    expect(
      metaCloudAdapter.resolveRecipient({
        isGroup: true,
        groupChatId: "group-1",
        phoneNumber: "+351911111111",
        waIdentity: null,
      }),
    ).toBeNull();

    expect(metaCloudAdapter.isConfigured()).toBe(false);
    expect(metaCloudAdapter.codes).toEqual({
      notConfigured: "meta_not_configured",
      sendFailed: "meta_error",
      unknownError: "meta_unknown",
    });

    await expect(
      metaCloudAdapter.send({
        ...textEnvelope,
        sessionRef: "1234567890",
        to: "351911111111",
      }),
    ).resolves.toEqual({ externalId: null });
  });
});
