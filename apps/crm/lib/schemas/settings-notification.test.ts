import { describe, expect, it } from "vitest";
import { normalizeNotificationPrefs, notificationPrefsSchema } from "./settings";

describe("notification preferences settings", () => {
  it("normalizes duplicate tenant preferences deterministically", () => {
    const parsed = notificationPrefsSchema.parse({ prefs: [
      { category: "mention", channel: "email", enabled: true },
      { category: "lead_won", channel: "in_app", enabled: false },
      { category: "mention", channel: "email", enabled: false },
    ]});
    expect(normalizeNotificationPrefs(parsed)).toEqual({ prefs: [
      { category: "lead_won", channel: "in_app", enabled: false },
      { category: "mention", channel: "email", enabled: false },
    ]});
  });
});
