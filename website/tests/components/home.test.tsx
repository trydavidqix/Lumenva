import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import HomePage from "@/app/page";

afterEach(cleanup);

test("home has one h1 and the approved conversion path", () => {
  render(<HomePage />);

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

  const demoLinks = screen.getAllByRole("link", {
    name: /agendar demonstração/i,
  });
  expect(demoLinks.length).toBeGreaterThanOrEqual(1);
  expect(demoLinks.every((link) => link.getAttribute("href") === "/contato")).toBe(
    true,
  );

  expect(
    screen.getByRole("heading", { name: /agentes de ia/i }),
  ).toBeVisible();
});
