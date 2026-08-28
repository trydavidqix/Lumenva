#!/usr/bin/env node
/**
 * Process boundary for the optional Python Pipecat runtime.
 *
 * This process deliberately does not implement STT, TTS, an LLM, or a fake
 * media loop. The configured child must announce the versioned `ready`
 * protocol message before this boundary reports healthy. Missing command,
 * child failure, and protocol failure remain unavailable (503).
 */
import http from "node:http";
import { spawn } from "node:child_process";

const PROTOCOL_VERSION = 1;

function required(env, name) {
  const value = env[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function portFrom(env) {
  const port = Number(env.PORT ?? "8090");
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("PORT must be a valid port number");
  return port;
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function parseArgs(value) {
  if (!value?.trim()) return [];
  if (value.trim().startsWith("[")) {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) throw new Error("PIPECAT_ARGS must be a JSON array of strings");
    return parsed;
  }
  // Arguments are intentionally not shell-parsed. This prevents env config
  // from turning into an implicit shell execution boundary.
  return value.trim().split(/\s+/u);
}

export async function createPipecatRuntimeProcess(env = process.env) {
  const command = required(env, "PIPECAT_COMMAND");
  const args = parseArgs(env.PIPECAT_ARGS);
  const port = portFrom(env);
  let child;
  let ready = false;
  let started = false;
  let stopped = false;
  let server;
  let stdoutBuffer = "";

  const health = (_req, res) => {
    if (ready && child && !child.killed) return json(res, 200, { status: "ok", protocol_version: PROTOCOL_VERSION });
    return json(res, 503, { status: "unavailable", reason: "runtime_not_ready" });
  };

  function onProtocolLine(line) {
    if (!line.trim()) return;
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (message?.type === "ready" && message.protocol_version === PROTOCOL_VERSION) ready = true;
  }

  async function start() {
    if (started) return;
    started = true;
    child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], shell: false, env });
    child.once("error", () => { ready = false; });
    child.once("exit", () => { ready = false; });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) onProtocolLine(line);
    });
    child.stderr.resume();
    server = http.createServer((req, res) => {
      if (req.method === "GET" && req.url === "/healthz") return health(req, res);
      return json(res, 404, { error: "not_found" });
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
  }

  async function stop(signal = "shutdown") {
    if (stopped) return;
    stopped = true;
    ready = false;
    if (server) await new Promise((resolve) => server.close(() => resolve()));
    if (child && child.exitCode === null && !child.killed) {
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        const timer = setTimeout(() => { child.kill("SIGKILL"); resolve(); }, 2_000);
        child.once("exit", () => { clearTimeout(timer); resolve(); });
      });
    }
    void signal;
  }

  function boundPort() {
    const address = server?.address();
    return address && typeof address === "object" ? address.port : null;
  }

  return { start, stop, port: boundPort };
}

async function main() {
  const runtime = await createPipecatRuntimeProcess();
  process.once("SIGTERM", () => runtime.stop("SIGTERM").then(() => process.exit(0)));
  process.once("SIGINT", () => runtime.stop("SIGINT").then(() => process.exit(0)));
  await runtime.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error(`[pipecat-runtime] ${error.message}`); process.exitCode = 1; });
}
