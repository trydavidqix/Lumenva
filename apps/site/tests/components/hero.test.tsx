import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Hero } from "@/components/sections/Hero";

afterEach(cleanup);

test("renders the demo CTA without a canvas", () => {
  const { container } = render(<Hero />);

  expect(
    screen.getByRole("link", { name: /agendar demonstração/i }),
  ).toBeVisible();
  expect(container.querySelector("canvas")).not.toBeInTheDocument();
});

test("keeps the headline and secondary CTA meaningful", () => {
  render(<Hero />);

  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    /atendimento e vendas com IA/i,
  );
  expect(screen.getByRole("link", { name: /ver produto/i })).toBeVisible();
});

test("shows a decorative product preview hidden from assistive tech", () => {
  const { container } = render(<Hero />);

  const hiddenElements = [...container.querySelectorAll('[aria-hidden="true"]')];
  const preview = hiddenElements.find((element) =>
    /novas conversas/i.test(element.textContent ?? ""),
  );
  expect(preview).toBeTruthy();
});
