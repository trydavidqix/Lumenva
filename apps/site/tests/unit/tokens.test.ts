import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("tokens expose the approved semantic palette", () => {
  const css = readFileSync("styles/tokens.css", "utf8");

  expect(css).toContain("--color-accent: #111111");
  expect(css).toContain("--color-ink: #111111");
  expect(css).toContain("--color-gray: #6E6E73");
  expect(css).toContain("--color-surface: #F5F5F7");
});
