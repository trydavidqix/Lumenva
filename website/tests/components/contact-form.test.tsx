import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ContactForm } from "@/components/sections/ContactForm";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("submits the completed form and announces success", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { accepted: true } }), { status: 202 }),
    ),
  );
  const user = userEvent.setup();

  render(<ContactForm />);

  await user.type(screen.getByLabelText(/nome/i), "Ana");
  await user.type(screen.getByLabelText(/empresa/i), "Lumenva");
  await user.type(screen.getByLabelText(/e-mail/i), "ana@example.com");
  await user.type(screen.getByLabelText(/whatsapp/i), "+351910000000");
  await user.click(screen.getByRole("checkbox", { name: /autorizo o contacto/i }));
  await user.click(screen.getByRole("button", { name: /agendar demonstração/i }));

  expect(await screen.findByText(/recebemos a sua solicitação/i)).toBeVisible();
});

test("explains missing required fields and consent", async () => {
  render(<ContactForm />);

  expect(screen.getByText(/Falta preencher: Nome, Empresa, E-mail e WhatsApp/i)).toBeVisible();
  expect(screen.getAllByText(/Obrigatório/i).length).toBeGreaterThan(0);
  expect(screen.getByLabelText(/nome/i)).toHaveAttribute("aria-describedby", "name-error");

  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/nome/i), "Ana");

  expect(screen.getByText(/Falta preencher:.*Empresa.*E-mail.*WhatsApp/i)).toBeVisible();
});

test("preserves values and announces an actionable error after a failed request", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
  const user = userEvent.setup();
  render(<ContactForm />);

  await user.type(screen.getByLabelText(/nome/i), "Ana");
  await user.type(screen.getByLabelText(/empresa/i), "Lumenva");
  await user.type(screen.getByLabelText(/e-mail/i), "ana@example.com");
  await user.type(screen.getByLabelText(/whatsapp/i), "+351910000000");
  await user.click(screen.getByRole("checkbox", { name: /autorizo o contacto/i }));
  await user.click(screen.getByRole("button", { name: /agendar demonstração/i }));

  expect(await screen.findByText(/Não foi possível enviar agora/i)).toBeVisible();
  expect(screen.getByLabelText(/nome/i)).toHaveValue("Ana");
  expect(screen.getByLabelText(/empresa/i)).toHaveValue("Lumenva");
  expect(screen.getByLabelText(/e-mail/i)).toHaveValue("ana@example.com");
  expect(screen.getByLabelText(/whatsapp/i)).toHaveValue("+351910000000");
  expect(screen.getByRole("checkbox", { name: /autorizo o contacto/i })).toBeChecked();
});
