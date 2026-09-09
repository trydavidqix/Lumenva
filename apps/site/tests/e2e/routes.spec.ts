import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/produto",
  "/solucoes",
  "/solucoes/atendimento-com-ia",
  "/solucoes/vendas-crm",
  "/solucoes/agentes-de-ia",
  "/solucoes/automacao-de-processos",
  "/integracoes",
  "/projetos",
  "/sobre",
  "/contato",
] as const;

for (const path of publicRoutes) {
  test(`${path} has a visible h1 and demo CTA`, async ({ page }) => {
    const response = await page.goto(path);
    const main = page.getByRole("main");

    expect(response?.ok()).toBe(true);
    await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      main.getByRole("link", { name: /agendar demonstração/i }),
    ).toBeVisible();
  });
}

test("/contato presents the demo request fields without submitting before Task 8", async ({
  page,
}) => {
  await page.goto("/contato");

  const form = page.getByRole("form", { name: /solicitação de demonstração/i });
  await expect(form.getByLabel(/nome/i)).toBeVisible();
  await expect(form.getByLabel(/empresa/i)).toBeVisible();
  await expect(form.getByLabel(/e-mail/i)).toBeVisible();
  await expect(form.getByLabel(/whatsapp/i)).toBeVisible();
  await expect(form.getByRole("checkbox", { name: /autorizo o contacto/i })).toBeVisible();
  await expect(form.getByRole("button", { name: /agendar demonstração/i })).toBeDisabled();
});
