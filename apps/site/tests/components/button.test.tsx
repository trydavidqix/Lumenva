import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Button } from "@/components/ui/Button";

afterEach(cleanup);

test("renders an href button as an accessible navigation link", () => {
  render(
    <Button href="/contato" variant="primary">
      Solicitar demonstração
    </Button>,
  );

  expect(
    screen.getByRole("link", { name: /solicitar demonstração/i }),
  ).toHaveAttribute("href", "/contato");
});

test("renders an action button when no href is supplied", () => {
  render(<Button variant="secondary">Fechar menu</Button>);

  expect(screen.getByRole("button", { name: /fechar menu/i })).toBeVisible();
});
