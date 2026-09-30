import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const crmRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => readFileSync(join(crmRoot, relativePath), "utf8");

test("Firebase-authenticated F5 routes use the server admin boundary", () => {
  const routes = [
    "app/api/v1/conversations/[id]/media/route.ts",
    "app/api/v1/messages/[id]/media/route.ts",
    "app/api/v1/content-os/assets/route.ts",
  ];

  for (const route of routes) {
    const source = read(route);
    assert.match(source, /createAdminClient/,
      `${route} must query through the Firebase-compatible admin boundary`);
    assert.doesNotMatch(source, /@\/lib\/supabase\/server/,
      `${route} must not depend on the legacy Supabase Auth cookie`);
  }

  assert.match(read(routes[0]), /\.eq\("organization_id", activeOrg\.orgId\)/u);
  assert.match(read(routes[1]), /\.eq\("organization_id", activeOrg\.orgId\)/u);
  assert.match(read(routes[2]), /\.eq\("organization_id", authz\.org\.orgId\)/u);
});

test("SSE applies conversation visibility before emitting tenant events", () => {
  const eventBus = read("lib/realtime/event-bus.ts");
  const sse = read("lib/realtime/sse.ts");

  assert.match(eventBus, /visibility_mode/u);
  assert.match(eventBus, /assigned_to_user_id/u);
  assert.match(eventBus, /conversation_id/u);
  assert.match(eventBus, /role/u);
  assert.match(sse, /userId/u);
});

test("F5 storage callers use private GCS object storage", () => {
  const callers = [
    "workers/media-persist-worker.ts",
    "workers/media-derive-worker.ts",
    "workers/lgpd-export-worker.ts",
    "app/api/v1/privacy/requests/[id]/route.ts",
  ];

  for (const caller of callers) {
    const source = read(caller);
    assert.match(source, /createGcsObjectStore/u, `${caller} must use the GCS adapter`);
    assert.match(source, /getGcsBucket/u, `${caller} must resolve the configured GCS bucket`);
    assert.doesNotMatch(source, /\.storage\s*\.from\s*\(/u,
      `${caller} must not use the legacy Supabase Storage path`);
  }
});
