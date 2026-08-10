import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ContactForm } from "@/components/sections/ContactForm";

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
  await user.click(screen.getByRole("checkbox", { name: /autorizo o contato/i }));
  await user.click(screen.getByRole("button", { name: /agendar demonstração/i }));

  expect(await screen.findByText(/recebemos sua solicitação/i)).toBeVisible();
});
