import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("voice worker tenant binding", () => {
  it("sends the worker technical number with every turn and lifecycle event", () => {
    const main = read("workers/voice-worker/main.mjs");
    expect(main).toContain("technical_phone_e164: phoneNumber");
    expect(main.match(/technical_phone_e164: phoneNumber/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("binds internal voice turns to the technical number and call direction", () => {
    const route = read("app/api/internal/voice/turn/route.ts");
    expect(route).toContain("technical_phone_e164");
    expect(route).toContain("voice_phone_numbers");
    expect(route).toContain("vc.direction = 'inbound'");
    expect(route).toContain("vc.called_number = $2");
    expect(route).toContain("vc.direction = 'outbound'");
    expect(route).toContain("vc.caller_number = $2");
  });

  it("binds lifecycle events to the same technical-number boundary", () => {
    const route = read("app/api/internal/voice/event/route.ts");
    expect(route).toContain("technical_phone_e164");
    expect(route).toContain("voice_phone_numbers");
    expect(route).toContain("vc.direction = 'inbound'");
    expect(route).toContain("vc.called_number = $2");
    expect(route).toContain("vc.direction = 'outbound'");
    expect(route).toContain("vc.caller_number = $2");
  });

  it("does not reopen terminal calls or accept a different provider call id", () => {
    const route = read("app/api/internal/voice/event/route.ts");
    expect(route).toContain("state not in ('completed','failed','canceled') or state = $3");
    expect(route).toContain("provider_call_id is null or $6::text is null or provider_call_id = $6::text");
    expect(route).toContain("voice_event_conflict");
  });

  it("keeps private worker endpoints service-only even if grants change later", () => {
    const migration = read("supabase/migrations/20260827020000_0130_voice_worker_endpoint_privileges.sql");
    expect(migration).toContain("revoke all on table public.voice_worker_endpoints from anon");
    expect(migration).toContain("revoke all on table public.voice_worker_endpoints from authenticated");
  });
});
