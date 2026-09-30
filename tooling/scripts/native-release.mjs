#!/usr/bin/env node
/**
 * Atomic native Next standalone release switcher (Linux / POSIX).
 * All operations stay inside an explicitly supplied release directory.
 * No docker, cloud API, database migration, secret lookup or production deploy.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";

const [action, rootArg, arg] = process.argv.slice(2);
const id = (value) => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value ?? "") || value === "." || value === "..") {
    throw new Error("Release version must be a safe, non-empty identifier.");
  }
  return value;
};
if (!["stage", "activate", "rollback", "status", "smoke"].includes(action ?? "") || !rootArg) {
  throw new Error("Usage: native-release.mjs stage|activate|rollback|status|smoke <isolated-release-directory> [archive|version]");
}
const root = resolve(rootArg);
if (root === "/" || root === resolve(".") || root.startsWith(resolve(".") + sep)) {
  throw new Error("Release root must be a separate directory outside the checkout.");
}
mkdirSync(root, { recursive: true });
if (realpathSync(root) !== root) throw new Error("Release root cannot be a symlink.");
const releases = join(root, "releases");
mkdirSync(releases, { recursive: true });

function pointer(name) {
  const path = join(root, name);
  if (!existsSync(path) && !isSymbolic(path)) return null;
  if (!isSymbolic(path)) throw new Error(name + " is not a symlink.");
  const target = readlinkSync(path);
  const found = /^releases\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,63})$/.exec(target);
  if (!found || found[1] === "." || found[1] === "..") throw new Error("Unsafe " + name + " pointer.");
  if (!existsSync(join(root, target))) throw new Error("Missing " + name + " target.");
  return found[1];
}
function isSymbolic(path) {
  try { return lstatSync(path).isSymbolicLink(); } catch { return false; }
}
function switchPointer(name, version) {
  const temp = join(root, "." + name + "-" + process.pid);
  if (existsSync(temp) || isSymbolic(temp)) throw new Error("Temporary pointer already exists.");
  try {
    symlinkSync("releases/" + id(version), temp);
    renameSync(temp, join(root, name)); // POSIX atomic symlink replacement
  } finally {
    if (isSymbolic(temp)) rmSync(temp);
  }
}
function releaseDir(version) {
  const dir = join(releases, id(version));
  if (!existsSync(dir) || isSymbolic(dir)) throw new Error("Release is not staged.");
  return dir;
}
function entrypoint(dir) {
  const command = readFileSync(join(dir, "START-COMMAND.txt"), "utf8").trim();
  if (!["node server.js", "node apps/crm/server.js"].includes(command)) {
    throw new Error("Unrecognized native Next.js start command.");
  }
  const rel = command.slice(5);
  const app = rel === "server.js" ? dir : join(dir, "apps/crm");
  for (const required of [join(app, "server.js"), join(app, ".next/static"), join(app, "public")]) {
    if (!existsSync(required) || !realpathSync(required).startsWith(dir + sep)) {
      throw new Error("Incomplete or escaped standalone release: " + required);
    }
  }
  return rel;
}

if (action === "stage") {
  if (!arg) throw new Error("stage requires a trusted archive path and NATIVE_RELEASE_VERSION.");
  const version = id(process.env.NATIVE_RELEASE_VERSION);
  const archive = realpathSync(resolve(arg));
  const entries = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).trim().split("\n");
  for (const entry of entries) {
    const parts = entry.split("/").filter(x => x && x !== ".");
    if (isAbsolute(entry) || parts.includes("..") || entry.includes("\\")) throw new Error("Unsafe tar entry.");
  }
  const target = join(releases, version);
  if (existsSync(target) || isSymbolic(target)) throw new Error("Release already staged.");
  const staging = mkdtempSync(join(releases, ".staging-"));
  try {
    execFileSync("tar", ["-xzf", archive, "--no-same-owner", "--no-same-permissions", "-C", staging], { stdio: "pipe" });
    entrypoint(staging);
    renameSync(staging, target);
    console.log("STAGED " + version);
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}
if (action === "activate") {
  const next = id(arg);
  entrypoint(releaseDir(next));
  const old = pointer("current");
  if (old !== next) {
    if (old) switchPointer("previous", old);
    switchPointer("current", next);
  }
  console.log(JSON.stringify({ active: next, previous: pointer("previous") }));
}
if (action === "rollback") {
  const old = pointer("current");
  const prev = pointer("previous");
  if (!old || !prev || old === prev) throw new Error("No distinct previous release to restore.");
  entrypoint(releaseDir(prev));
  switchPointer("current", prev);
  switchPointer("previous", old);
  console.log(JSON.stringify({ active: prev, previous: old }));
}
if (action === "status") console.log(JSON.stringify({ active: pointer("current"), previous: pointer("previous") }));

if (action === "smoke") {
  const version = pointer("current");
  if (!version) throw new Error("No current release.");
  const release = releaseDir(version);
  const executable = entrypoint(release);
  const port = await new Promise((yes, no) => {
    const server = createServer();
    server.once("error", no);
    server.listen(0, "127.0.0.1", () => {
      const p = server.address().port;
      server.close(() => yes(p));
    });
  });
  const proc = spawn(process.execPath, [join(release, executable)], {
    cwd: release,
    env: {
      ...process.env,
      PORT: String(port), HOSTNAME: "127.0.0.1",
      NEXT_TELEMETRY_DISABLED: "1", SENTRY_DSN: "off",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "isolated-runtime-placeholder",
      SUPABASE_SERVICE_ROLE_KEY: "isolated-runtime-placeholder",
      INTERNAL_SECRET: "isolated-runtime-placeholder",
      MCP_RELAY_OAUTH_APPROVAL_SECRET: "isolated-runtime-placeholder",
      CPF_ENCRYPTION_KEY: "isolated-runtime-placeholder",
      WAHA_BYO_ENCRYPTION_KEY: "isolated-runtime-placeholder",
      AI_CRED_AES_KEY: "isolated-runtime-placeholder",
      SUPABASE_DB_URL: "postgresql://postgres:placeholder@127.0.0.1:1/postgres",
      WAHA_API_BASE_URL: "http://127.0.0.1:3999",
      WAHA_API_KEY: "isolated-runtime-placeholder",
      WAHA_WEBHOOK_BASE_URL: "http://127.0.0.1:3999",
      UPSTASH_REDIS_REST_URL: "http://127.0.0.1:3998",
      UPSTASH_REDIS_REST_TOKEN: "isolated-runtime-placeholder",
      NEXT_PUBLIC_FIREBASE_API_KEY: "demo-firebase-emulator-only",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-lumenva-e2e.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-lumenva-e2e",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  proc.stdout.on("data", x => { output += String(x); });
  proc.stderr.on("data", x => { output += String(x); });
  let ok = false;
  try {
    const deadline = Date.now() + 35000;
    while (Date.now() < deadline && proc.exitCode === null) {
      try {
        const result = await fetch("http://127.0.0.1:" + port + "/login", { signal: AbortSignal.timeout(2500), redirect: "manual" });
        const body = await result.text();
        if (result.status === 200 && /<html/i.test(body)) { ok = true; break; }
        if (result.status >= 500) throw new Error("Native server returned " + result.status + ": " + body.slice(0, 500) + " LOG: " + output.slice(-4000));
      } catch (error) {
        if (/Native server returned/.test(String(error))) throw error;
      }
      await new Promise(done => setTimeout(done, 400));
    }
    if (!ok) throw new Error("Native CRM smoke failed; output: " + output.slice(-4000));
    console.log("SMOKE OK " + version + " GET /login (isolated placeholders; no external auth claims).");
  } finally {
    proc.kill("SIGTERM");
    await new Promise(done => {
      if (proc.exitCode !== null) return done();
      proc.once("exit", done);
      setTimeout(() => { if (proc.exitCode === null) proc.kill("SIGKILL"); done(); }, 3000).unref();
    });
  }
}
