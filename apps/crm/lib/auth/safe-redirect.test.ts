import { describe, expect, it } from "vitest";
import { safeInternalRedirect } from "./safe-redirect";

describe("safeInternalRedirect", () => {
  it("keeps internal paths and their query string", () => {
    expect(safeInternalRedirect("/app/inbox?filter=open")).toBe(
      "/app/inbox?filter=open",
    );
  });

  it("rejects absolute and protocol-relative external targets", () => {
    expect(safeInternalRedirect("https://evil.example")).toBe("/app/inbox");
    expect(safeInternalRedirect("//evil.example/login")).toBe("/app/inbox");
  });

  it("rejects backslash variants used in redirect parser differentials", () => {
    expect(safeInternalRedirect("/\\evil.example")).toBe("/app/inbox");
  });
});
