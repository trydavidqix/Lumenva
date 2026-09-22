import { describe, expect, it } from "vitest";

import { parseNotificationAckToken } from "./ack";

describe("notification acknowledgement token", () => {
  it("accepts only explicit CONFIRMAR + six-character token", () => {
    expect(parseNotificationAckToken("CONFIRMAR AB23XZ")).toBe("AB23XZ");
    expect(parseNotificationAckToken("  confirmar ab23xz  ")).toBe("AB23XZ");
    expect(parseNotificationAckToken("ok")).toBeNull();
    expect(parseNotificationAckToken("CONFIRMAR")).toBeNull();
    expect(parseNotificationAckToken("CONFIRMAR ABC")).toBeNull();
    expect(parseNotificationAckToken("CONFIRMAR ABC1234")).toBeNull();
  });

  it("does not treat an embedded longer identifier as acknowledgement", () => {
    expect(parseNotificationAckToken("prefixCONFIRMAR AB23XZsuffix")).toBeNull();
  });
});
