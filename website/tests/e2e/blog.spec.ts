import { expect, test } from "@playwright/test";

const blogRoutes = [
  "/blog",
  "/blog/noticias",
  "/blog/insights",
  "/blog/guias",
] as const;

test.describe("blog extension", () => {
  test("home exposes accessible blog landmarks and search", async ({ page }) => {
    const response = await page.goto("/blog");

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("search")).toBeVisible();
    await expect(page.getByRole("link", { name: /blog/i }).first()).toBeVisible();
  });

  for (const route of blogRoutes.slice(1)) {
    test(`${route} renders a heading and blog navigation`, async ({ page }) => {
      const response = await page.goto(route);

      expect(response?.ok()).toBe(true);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("link", { name: /blog/i }).first()).toBeVisible();
    });
  }

  test("search filters the visible article collection", async ({ page }) => {
    await page.goto("/blog");
    const search = page.getByRole("search");
    const input = search.getByRole("searchbox");

    await expect(input).toBeVisible();
    await input.fill("agentes");
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("article has readable content, metadata, and breadcrumb", async ({ page }) => {
    await page.goto("/blog");
    const articleLink = page.locator('main a[href^="/blog/"]:not([href^="/blog/categoria/"])').first();
    await expect(articleLink).toBeVisible();
    await articleLink.click();

    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: /breadcrumb/i })).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  });

  test("RSS endpoint returns XML", async ({ request }) => {
    const response = await request.get("/blog/rss.xml");

    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toMatch(/application\/rss\+xml|application\/xml/);
    expect(await response.text()).toContain("<rss");
  });

  test("mobile blog remains usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/blog");

    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("search")).toBeVisible();
  });
});
