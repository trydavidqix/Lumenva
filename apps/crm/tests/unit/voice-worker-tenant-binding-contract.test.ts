import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function repoRoot(): string {
  const cwd = process.cwd();
  if (existsSync(join(cwd, "apps", "crm")) && existsSync(join(cwd, "workers", "voice-worker"))) return cwd;
  const parent = resolve(cwd, "../..");
  if (existsSync(join(parent, "apps", "crm")) && existsSync(join(parent, "workers", "voice-worker"))) return parent;
  throw new Error(`repository root not found from ${cwd}`);
}

const readCrm = (path: string) => readFileSync(join(repoRoot(), "apps/crm", path), "utf8");
const readRepo = (path: string) => readFileSync(join(repoRoot(), path), "utf8");

describe("voice worker tenant binding", () => {
  it("sends the worker technical number with every turn and lifecycle event", () => {
    const main = readRepo("workers/voice-worker/main.mjs");
    expect(main).toContain("technical_phone_e164: phoneNumber");
    expect(main.match(/technical_phone_e164: phoneNumber/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("binds internal voice turns to the technical number and call direction", () => {
    const route = readCrm("app/api/internal/voice/turn/route.ts");
    expect(route).toContain("technical_phone_e164");
    expect(route).toContain("voice_phone_numbers");
    expect(route).toContain("vc.direction = 'inbound'");
    expect(route).toContain("vc.called_number = $2");
    expect(route).toContain("vc.direction = 'outbound'");
    expect(route).toContain("vc.caller_number = $2");
  });

  it("keeps organization identity in inbound context, outbound reservations, and delivery logs", () => {
    const contextRoute = readCrm("app/api/internal/voice/context/route.ts");
    const outboundProduction = readCrm("lib/voice/outbound/production.ts");
    const controlServer = readRepo("workers/voice-worker/control-server.mjs");
    const pendingOutbound = readRepo("workers/voice-worker/pending-outbound.mjs");
    const main = readRepo("workers/voice-worker/main.mjs");

    expect(contextRoute).toContain("organization_id: data.organizationId");
    expect(outboundProduction).toContain("organization_id: input.organizationId");
    expect(controlServer).toContain("organization_id");
    expect(controlServer).toContain("organizationId");
    expect(pendingOutbound).toContain("organizationId: organizationId.trim()");
    expect(main).toContain("organization_id: pending.organizationId");
    expect(main).toContain("organization_id: context.organization_id");
  });

  it("binds lifecycle events to the same technical-number boundary", () => {
    const route = readCrm("app/api/internal/voice/event/route.ts");
    expect(route).toContain("technical_phone_e164");
    expect(route).toContain("voice_phone_numbers");
    expect(route).toContain("vc.direction = 'inbound'");
    expect(route).toContain("vc.called_number = $2");
    expect(route).toContain("vc.direction = 'outbound'");
    expect(route).toContain("vc.caller_number = $2");
  });

  it("does not reopen terminal calls or accept a different provider call id", () => {
    const route = readCrm("app/api/internal/voice/event/route.ts");
    expect(route).toContain("state not in ('completed','failed','canceled') or state = $3");
    expect(route).toContain("provider_call_id is null or $6::text is null or provider_call_id = $6::text");
    expect(route).toContain("voice_event_conflict");
  });

  it("keeps private worker endpoints service-only even if grants change later", () => {
    const migration = readRepo("supabase/migrations/20260827020000_0130_voice_worker_endpoint_privileges.sql");
    expect(migration).toContain("revoke all on table public.voice_worker_endpoints from anon");
    expect(migration).toContain("revoke all on table public.voice_worker_endpoints from authenticated");
  });
});
