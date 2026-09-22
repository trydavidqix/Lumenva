import { describe, expect, it } from "vitest";
import { LocalRuntimeDaemon } from "./daemon.js";

describe("LocalRuntimeDaemon", () => {
  it("starts idempotently and advertises deterministic capabilities", async () => {
    const events: string[] = [];
    const now = new Date("2026-09-22T12:00:00.000Z");
    const daemon = new LocalRuntimeDaemon({
      runtimeId: "runtime-1",
      hostId: "host-1",
      version: "0.1.0",
      now: () => now,
      id: () => "event-1",
      capabilities: [{ id: "git.status", version: "1", risk: "R0", deterministic: true }],
      onEvent: (event) => { events.push(event.type); },
    });

    expect((await daemon.start()).state).toBe("idle");
    expect((await daemon.start()).state).toBe("idle");
    expect(events).toEqual(["runtime.started"]);
    expect(daemon.health().capabilities[0]?.deterministic).toBe(true);
  });

  it("detects a stale heartbeat", async () => {
    let now = new Date("2026-09-22T12:00:00.000Z");
    const daemon = new LocalRuntimeDaemon({
      runtimeId: "runtime-1",
      hostId: "host-1",
      version: "0.1.0",
      heartbeatTimeoutMs: 1_000,
      now: () => now,
    });
    await daemon.start();
    now = new Date("2026-09-22T12:00:02.000Z");
    expect(daemon.isHeartbeatStale()).toBe(true);
  });

  it("stops gracefully and rejects heartbeat while offline", async () => {
    const daemon = new LocalRuntimeDaemon({ runtimeId: "r", hostId: "h", version: "0.1.0" });
    await daemon.start();
    expect((await daemon.stop()).state).toBe("offline");
    await expect(daemon.heartbeat()).rejects.toThrow("runtime_not_started");
  });
});
