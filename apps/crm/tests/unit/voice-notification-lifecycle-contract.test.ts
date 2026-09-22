import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("voice notification lifecycle contract", () => {
  const route = readFileSync("app/api/internal/voice/event/route.ts", "utf8");

  it("does not equate answered voice with acknowledgement", () => {
    expect(route).toContain('state === "active"');
    expect(route).toContain("status = 'delivered'");
    expect(route).not.toMatch(/state === "active"[\s\S]{0,500}status = 'acknowledged'/);
  });

  it("completes the delivery on terminal success and retries terminal failures only within policy", () => {
    expect(route).toContain("reconcileNotificationLifecycle");
    expect(route).toContain("voice_max_attempts");
    expect(route).toContain("voice_cooldown_seconds");
    expect(route).toContain("notification_delivery_attempts");
    expect(route).toContain("scheduleCronJob");
    expect(route).toContain("voice_call_failed");
    expect(route).toContain("voice_call_canceled");
  });
});
