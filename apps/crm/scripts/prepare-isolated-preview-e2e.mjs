#!/usr/bin/env node
// Fail closed: authenticated CRM E2E may ONLY target a separate, empty preview.
import { appendFileSync, existsSync, writeFileSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
const e = process.env;
const ref = e.E2E_PREVIEW_REF ?? "";
const production = e.E2E_PRODUCTION_REF ?? "";
const anon = e.E2E_PREVIEW_ANON_KEY ?? "";
const service = e.E2E_PREVIEW_SERVICE_ROLE_KEY ?? "";
const db = e.E2E_PREVIEW_DB_URL ?? "";
if (!/^[a-z0-9]{20}$/.test(ref) || !/^[a-z0-9]{20}$/.test(production) || ref === production) {
  throw new Error("BLOCKED: separate preview and production project refs are required.");
}
if (e.E2E_TARGET_ACK !== "isolated-empty-preview-only") {
  throw new Error("BLOCKED: explicit isolated-empty-preview-only acknowledgement required.");
}
let preview;
try { preview = new URL(e.E2E_PREVIEW_URL ?? ""); } catch { throw new Error("BLOCKED: preview URL missing."); }
if (preview.protocol !== "https:" || preview.hostname !== ref + ".supabase.co" ||
    preview.pathname !== "/" || preview.username || preview.password || preview.search) {
  throw new Error("BLOCKED: preview URL must exactly match the isolated project ref.");
}
for (const [name, key] of Object.entries({ anon, service })) {
  if (!/^(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sb_(?:publishable|secret)_[A-Za-z0-9_-]+)$/.test(key) ||
      /placeholder|dummy|fake|test-key/i.test(key)) {
    throw new Error("BLOCKED: " + name + " requires a REAL key from the isolated preview.");
  }
}
let dbUrl;
try { dbUrl = new URL(db); } catch { throw new Error("BLOCKED: preview PostgreSQL URL missing."); }
const direct = dbUrl.hostname === "db." + ref + ".supabase.co";
const pooled = dbUrl.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(dbUrl.username) === "postgres." + ref;
if (!["postgresql:", "postgres:"].includes(dbUrl.protocol) || !dbUrl.password || (!direct && !pooled)) {
  throw new Error("BLOCKED: preview DB URL must identify the same isolated project.");
}
if (existsSync(resolve("apps/crm/.env.local")) || existsSync(resolve(".env.local"))) {
  throw new Error("BLOCKED: .env.local is prohibited in an isolated preview E2E checkout.");
}
const entries = {
  E2E_TARGET_KIND: "isolated-preview", E2E_PREVIEW_REF: ref,
  E2E_PRODUCTION_REF: production, E2E_TARGET_ACK: e.E2E_TARGET_ACK,
  NEXT_PUBLIC_SUPABASE_URL: preview.origin,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service, SUPABASE_DB_URL: db,
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3001",
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-firebase-emulator-only",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-lumenva-e2e.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-lumenva-e2e",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-lumenva-e2e.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:1234567890:web:e2e",
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", GOOGLE_CLOUD_PROJECT: "demo-lumenva-e2e",
  INTERNAL_SECRET: randomBytes(32).toString("hex"),
  CPF_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  WAHA_BYO_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  AI_CRED_AES_KEY: randomBytes(32).toString("base64"),
  WAHA_API_BASE_URL: "http://127.0.0.1:3999", WAHA_API_KEY: "isolated-unused-placeholder",
  WAHA_WEBHOOK_BASE_URL: "http://127.0.0.1:3001",
  UPSTASH_REDIS_REST_URL: "http://127.0.0.1:3998", UPSTASH_REDIS_REST_TOKEN: "isolated-unused-placeholder",
  NEXT_TELEMETRY_DISABLED: "1", SENTRY_DSN: "off",
};
const content = Object.entries(entries).map(([k,v]) => k+"="+v).join("\n") + "\n";
const file = resolve("apps/crm/.env.e2e");
writeFileSync(file, content, { mode: 0o600, flag: "wx" });
chmodSync(file, 0o600);
if (e.GITHUB_ENV) appendFileSync(e.GITHUB_ENV, content);
console.log("Isolated preview prepared. No secrets printed; real read-only preflight follows.");
