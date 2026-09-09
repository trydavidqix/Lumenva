import { expect, test } from "vitest";

test("website test harness is available", () => {
  expect(process.env.NODE_ENV).toBeDefined();
});
