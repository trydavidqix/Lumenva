import { describe, expect, it } from "vitest";

import { fail, noContent, ok } from "./wrappers";

describe("canonical API v1 envelopes", () => {
  it("returns {data} and preserves the request correlation id", async () => {
    const response = ok({ organization_id: "org-a" }, { requestId: "req-1" });
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("req-1");
    expect(await response.json()).toEqual({ data: { organization_id: "org-a" } });
  });

  it("returns the canonical error envelope without leaking an organization body field", async () => {
    const response = fail("validation_failed", "Invalid input", 422, {
      requestId: "req-2",
      details: { field_errors: { name: ["required"] } },
    });
    expect(response.status).toBe(422);
    expect(response.headers.get("x-request-id")).toBe("req-2");
    expect(await response.json()).toEqual({
      error: {
        code: "validation_failed",
        message: "Invalid input",
        details: { field_errors: { name: ["required"] } },
      },
    });
  });

  it("uses an empty response for 204 and still correlates it", async () => {
    const response = noContent("req-3");
    expect(response.status).toBe(204);
    expect(response.headers.get("x-request-id")).toBe("req-3");
    expect(await response.text()).toBe("");
  });
});
