import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Twilio Asterisk template contract", () => {
  it("keeps credentials out of versioned outbound config", () => {
    const pjsip = readFileSync("../ops/voice-asterisk/twilio-outbound.disabled.conf.example", "utf8");
    expect(pjsip).toContain("[twilio-outbound]");
    expect(pjsip).toContain("direct_media=no");
    expect(pjsip).toContain("allow=ulaw");
    expect(pjsip).toContain("allow=alaw");
    expect(pjsip).toContain("<TWILIO_SIP_PASSWORD_FROM_SECRET_STORE>");
    expect(pjsip).not.toMatch(/password=(?!<)[^\r\n]+/);
  });

  it("routes answered outbound calls into the Voice Core Stasis app", () => {
    const dialplan = readFileSync("../ops/voice-asterisk/extensions-twilio-outbound.disabled.conf.example", "utf8");
    expect(dialplan).toContain("[voice-outbound-twilio]");
    expect(dialplan).toContain("Stasis(voicecore-test)");
  });
});
