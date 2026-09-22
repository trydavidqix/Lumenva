import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CoreEventBus } from "./event-bus.js";
import { SqliteStore } from "./sqlite-store.js";

describe("CoreEventBus", () => {
  it("persists before publishing and does not notify twice for the same event", async () => {
    const store = new SqliteStore(join(mkdtempSync(join(tmpdir(), "lumenva-core-bus-")), "core.sqlite"));
    store.open();
    const bus = new CoreEventBus(store);
    const seen: string[] = [];
    bus.subscribe((event) => seen.push(event.id));

    await bus.publish({ id: "event-1", type: "core.started", taskId: null, traceId: "trace-1", payload: { ok: true } });
    await bus.publish({ id: "event-1", type: "core.started", taskId: null, traceId: "trace-1", payload: { ok: true } });

    expect(seen).toEqual(["event-1"]);
    expect(store.replayEvents()).toHaveLength(1);
    store.close();
  });
});
