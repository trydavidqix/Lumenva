import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Hero } from "@/components/sections/Hero";

afterEach(cleanup);

test("renders the demo CTA without a canvas", () => {
  const { container } = render(<Hero />);

  expect(
    screen.getByRole("link", { name: /solicitar demonstração/i }),
  ).toBeVisible();
  expect(container.querySelector("canvas")).not.toBeInTheDocument();
});

test("keeps the approved static mark meaningful before enhancement", () => {
  render(<Hero />);

  expect(screen.getByRole("img", { name: /marca lumenva/i })).toHaveTextContent(
    "L",
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    /vendas e suporte no WhatsApp/i,
  );
  expect(screen.getByRole("link", { name: /ver no GitHub/i })).toBeVisible();
});
