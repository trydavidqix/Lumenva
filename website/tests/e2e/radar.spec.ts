import { expect, test } from "@playwright/test";

test("Radar homepage exposes editorial navigation and search", async ({ page }) => {
  const response = await page.goto("/radar");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/IA/i);
  await expect(page.getByRole("navigation", { name: /categorias do radar/i })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: /pesquisar por tema/i })).toBeVisible();
});

test("Radar article exposes sources and related content", async ({ page }) => {
  const response = await page.goto("/radar/agentes-de-ia-com-governanca-humana");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: /agentes de ia com governança humana/i })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Fontes" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /leia também/i })).toBeVisible();
});

test("Radar taxonomy routes render", async ({ page }) => {
  for (const path of ["/radar/noticias", "/radar/insights", "/radar/guias", "/radar/categoria/automacao"]) {
    const response = await page.goto(path);
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("Radar RSS is public XML", async ({ request }) => {
  const response = await request.get("/radar/rss.xml");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/rss+xml");
  expect(await response.text()).toContain("Lumenva Radar");
});
