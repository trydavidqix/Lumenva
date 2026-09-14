import assert from "node:assert/strict";
import test from "node:test";

import { createSpeachesHealthCheck } from "./speaches-health.mjs";

test("health probe checks the local models endpoint without credentials", async () => {
  const calls = [];
  const check = createSpeachesHealthCheck({
    baseUrl: "http://speech.local:8000",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response("{}", { status: 200 });
    },
  });
  assert.equal(await check(), true);
  assert.equal(calls[0].url, "http://speech.local:8000/v1/models");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.headers, undefined);
});

test("health probe returns false for HTTP failure", async () => {
  const check = createSpeachesHealthCheck({
    baseUrl: "http://speech.local:8000",
    fetchImpl: async () => new Response("no", { status: 503 }),
  });
  assert.equal(await check(), false);
});

test("health probe returns false for network failure", async () => {
  const check = createSpeachesHealthCheck({
    baseUrl: "http://speech.local:8000",
    fetchImpl: async () => { throw new Error("offline"); },
  });
  assert.equal(await check(), false);
});
