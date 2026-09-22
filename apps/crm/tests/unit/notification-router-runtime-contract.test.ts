import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Notification Router runtime contract", () => {
  it("registers the durable handler in the existing agent worker", () => {
    const worker = readFileSync("workers/agent-worker/main.ts", "utf8");
    expect(worker).toContain("createNotificationDeliveryHandler");
    expect(worker).toContain("handlers.set(");
    expect(worker).toContain("'notification_delivery'");
    expect(worker).toContain("NOTIFICATION_ROUTER_ENABLED");
    expect(worker).toContain("VOICE_NOTIFICATION_ENABLED");
  });

  it("reuses the existing WhatsApp send pipeline and canonical voice route", () => {
    const router = readFileSync("lib/notifications/worker.ts", "utf8");
    expect(router).toContain("sendMessageHandler");
    expect(router).toContain("resolveProductionVoiceOutboundRoute");
    expect(router).toContain("dialProductionVoiceRoute");
    expect(router).toContain("metadata->>'notification_id'");
    expect(router).toContain("CONFIRMAR");
  });

  it("consumes explicit acknowledgements before AI dispatch", () => {
    const ingest = readFileSync("lib/waha/ingest.ts", "utf8");
    expect(ingest).toContain("tryAcknowledgeNotification");
    expect(ingest).toContain("if (!notificationAcknowledged)");
  });
});
