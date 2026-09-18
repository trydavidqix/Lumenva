import { describe, expect, it } from "vitest";
import type { QueryResult, QueryResultRow } from "pg";

import {
  claimJobs,
  completeJob,
  dispatchEvent,
  enqueueJob,
  type EventHandler,
  type Queryable,
} from "./index";

describe("Operating Core canonical facade", () => {
  it("exposes queue and event contracts from one module", () => {
    expect(typeof enqueueJob).toBe("function");
    expect(typeof claimJobs).toBe("function");
    expect(typeof completeJob).toBe("function");
    expect(typeof dispatchEvent).toBe("function");
  });

  it("keeps the public facade type-compatible with existing consumers", () => {
    const queryable: Queryable = {
      query: async <R extends QueryResultRow = QueryResultRow>(): Promise<QueryResult<R>> => ({
        command: "SELECT",
        fields: [],
        oid: 0,
        rows: [] as R[],
        rowCount: 0,
      }),
    };
    const handler: EventHandler = {
      key: "test.handler",
      events: ["test.event"],
      handle: async () => ({ consumer_key: "test.handler", status: "ok" }),
    };

    expect(queryable.query).toBeTypeOf("function");
    expect(handler.key).toBe("test.handler");
  });
});
