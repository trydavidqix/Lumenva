import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { Header } from "@/components/layout/Header";
import { navigation } from "@/content/site";

afterEach(cleanup);

test("mobile navigation exposes every public route", async () => {
  const user = userEvent.setup();

  render(<Header />);
  await user.click(screen.getByRole("button", { name: /abrir menu/i }));
  const dialog = screen.getByRole("dialog");

  for (const item of navigation) {
    expect(
      within(dialog).getByRole("link", { name: new RegExp(item.label, "i") }),
    ).toHaveAttribute("href", item.href);
  }
  expect(
    within(dialog).getByRole("link", { name: /agendar demonstração/i }),
  ).toHaveAttribute("href", "/contato");
});

test("mobile navigation returns focus to its trigger after it closes", async () => {
  const user = userEvent.setup();

  render(<Header />);
  const menuButton = screen.getByRole("button", { name: /abrir menu/i });
  await user.click(menuButton);
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: /fechar menu/i,
    }),
  );

  expect(menuButton).toHaveFocus();
});

test("mobile navigation contains Tab focus and makes outside content inert", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <>
      <Header />
      <main>
        <button type="button">Conteúdo externo</button>
      </main>
    </>,
  );

  await user.click(screen.getByRole("button", { name: /abrir menu/i }));
  const dialog = screen.getByRole("dialog");
  const closeButton = within(dialog).getByRole("button", {
    name: /^fechar menu$/i,
  });
  const demoLink = within(dialog).getByRole("link", {
    name: /agendar demonstração/i,
  });

  expect(closeButton).toHaveFocus();
  expect(container).toHaveAttribute("inert");

  await user.tab({ shift: true });
  expect(demoLink).toHaveFocus();

  await user.tab();
  expect(closeButton).toHaveFocus();
});

test("mobile navigation closes with Escape and restores trigger focus", async () => {
  const user = userEvent.setup();

  render(<Header />);
  const menuButton = screen.getByRole("button", { name: /abrir menu/i });
  await user.click(menuButton);
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(menuButton).toHaveFocus();
});
