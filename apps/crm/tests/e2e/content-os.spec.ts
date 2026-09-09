/**
 * Content OS — contrato visual mínimo das rotas protegidas.
 *
 * O primeiro teste não precisa de banco nem de credenciais: garante que todas
 * as rotas continuam protegidas para uma sessão anônima. A prova do conteúdo
 * renderizado fica explícita e opt-in porque o ambiente padrão desta suíte não
 * possui credenciais de autenticação reais.
 *
 * Para executar a prova autenticada no ambiente E2E local:
 *   E2E_CONTENT_OS_AUTH=1 pnpm exec playwright test tests/e2e/content-os.spec.ts
 *
 * As APIs do Content OS são mockadas nessa prova para que ela valide layout e
 * navegação sem depender de RSS, Postiz, concorrentes ou dados externos.
 */
import { expect, test, type ConsoleMessage } from "@playwright/test";

const CONTENT_OS_ROUTES = [
  { path: "/app/content-os", heading: "Oportunidades a decidir" },
  { path: "/app/content-os/radar", heading: "Radar de notícias" },
  { path: "/app/content-os/competitors", heading: "Radar de concorrentes" },
  { path: "/app/content-os/create", heading: "Criar conteúdo" },
  { path: "/app/content-os/calendar", heading: "Calendário de publicações" },
] as const;

const AUTHENTICATED_E2E = process.env.E2E_CONTENT_OS_AUTH === "1";

test.describe("Content OS — proteção de rotas", () => {
  test("todas as telas exigem sessão autenticada", async ({ page }) => {
    for (const route of CONTENT_OS_ROUTES) {
      await page.goto(route.path);
      await expect(page).toHaveURL(/\/login(?:\?|$)/);
      await expect(page.locator("#email")).toBeVisible();
    }
  });
});

test.describe("Content OS — telas autenticadas", () => {
  test.skip(
    !AUTHENTICATED_E2E,
    "E2E_CONTENT_OS_AUTH=1 não foi definido; a validação autenticada é opt-in e não exige credenciais reais por padrão.",
  );

  test("cada rota renderiza conteúdo nos viewports desktop e mobile", async ({ page }) => {
    const { lerCreds, loginComoAdmin } = await import("./helpers/login-admin");
    await loginComoAdmin(page, lerCreds());

    // O conteúdo externo não faz parte do contrato visual. Dados vazios tornam
    // o teste repetível e ainda exercitam os estados de carregamento/empty.
    await page.route("**/api/v1/content-os/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    for (const viewport of [
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const route of CONTENT_OS_ROUTES) {
        const consoleErrors: string[] = [];
        const onConsole = (message: ConsoleMessage) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        };
        page.on("console", onConsole);

        const response = await page.goto(route.path, { waitUntil: "networkidle" });
        expect(response?.status(), `${viewport.name} ${route.path}`).toBeLessThan(400);
        await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible();

        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        }));
        expect(
          overflow.scrollWidth,
          `${viewport.name} ${route.path} tem overflow horizontal`,
        ).toBeLessThanOrEqual(overflow.viewportWidth + 1);
        expect(consoleErrors, `${viewport.name} ${route.path} emitiu erro no console`).toEqual([]);

        page.off("console", onConsole);
      }
    }
  });
});
