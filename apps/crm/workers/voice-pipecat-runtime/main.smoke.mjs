#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = 19090 + Math.floor(Math.random() * 500);
const childCommand = "/bin/sh";
const childArgs = JSON.stringify(["-c", "printf '%s\\n' '{\"type\":\"ready\",\"protocol_version\":1}'; sleep 30"]);
const worker = spawn(process.execPath, [fileURLToPath(new URL("./main.mjs", import.meta.url))], {
  env: { ...process.env, PORT: String(port), PIPECAT_COMMAND: childCommand, PIPECAT_ARGS: childArgs },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
worker.stdout.on("data", (chunk) => { output += String(chunk); });
worker.stderr.on("data", (chunk) => { output += String(chunk); });

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.status === 200) return response;
    } catch { /* process is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Pipecat smoke did not become healthy: ${output}`);
}

try {
  const response = await waitForHealth();
  const body = await response.json();
  assert.equal(body.status, "ok");
  worker.kill("SIGTERM");
  const exitCode = await new Promise((resolve) => worker.once("exit", (code, signal) => resolve(code ?? signal)));
  assert.equal(exitCode, 0);
  console.log("[smoke] PASS — executable boundary, protocol readiness, /healthz and graceful shutdown");
} finally {
  if (!worker.killed) worker.kill("SIGKILL");
}
