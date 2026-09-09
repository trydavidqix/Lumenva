import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = () => readFileSync(join(process.cwd(), "app/api/v1/voice/config/route.ts"), "utf8");
const page = () => readFileSync(join(process.cwd(), "app/app/settings/tenant/voice/page.tsx"), "utf8");

describe("voice tenant config surface", () => {
  it("protects reads and writes with admin role and trusted active organization", () => {
    const source = route();
    expect(source).toContain('requireRole("admin"');
    expect(source).toContain("activeOrg.orgId");
    expect(source).toContain("settings.voice");
  });

  it("uses non-destructive settings merge and the canonical voice parser", () => {
    const source = route();
    expect(source).toContain("parseStoredVoiceTenantConfig");
    expect(source).toContain("mergeVoiceTenantConfig");
    expect(source).toContain("...currentSettings");
  });

  it("exposes a dedicated voice settings page without credential inputs", () => {
    const source = page().toLowerCase();
    expect(source).toContain("configuração de voz");
    expect(source).not.toContain("telnyx_api_key");
    expect(source).not.toContain("livekit_api_secret");
    expect(source).not.toContain("stt_api_key");
    expect(source).not.toContain("tts_api_key");
  });
});
