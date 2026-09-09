import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPipecatRuntimeProcess } from "./main.mjs";

describe("Pipecat runtime process boundary", () => {
  it("fails closed when no external runtime command is configured", async () => {
    await assert.rejects(
      () => createPipecatRuntimeProcess({ PORT: "0" }),
      /PIPECAT_COMMAND is required/,
    );
  });

  it("does not report healthy until the child explicitly announces readiness", async () => {
    const runtime = await createPipecatRuntimeProcess({ ...process.env,
      PORT: "0",
      PIPECAT_COMMAND: "/bin/sh",
      PIPECAT_ARGS: JSON.stringify(["-c", "sleep 5"]),
    });
    try {
      await runtime.start();
      const response = await fetch(`http://127.0.0.1:${runtime.port()}/healthz`);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { status: "unavailable", reason: "runtime_not_ready" });
    } finally {
      await runtime.stop("test");
    }
  });

  it("returns to unavailable and terminates the child on shutdown", async () => {
    const runtime = await createPipecatRuntimeProcess({ ...process.env,
      PORT: "0",
      PIPECAT_COMMAND: "/bin/sh",
      PIPECAT_ARGS: JSON.stringify(["-c", "printf '%s\\n' '{\"type\":\"ready\",\"protocol_version\":1}'; sleep 5"]),
    });
    await runtime.start();
    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const probe = await fetch(`http://127.0.0.1:${runtime.port()}/healthz`);
        if (probe.status === 200) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const response = await fetch(`http://127.0.0.1:${runtime.port()}/healthz`);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).status, "ok");
    } finally {
      await runtime.stop("test");
    }
    assert.equal(runtime.port(), null);
  });
});
