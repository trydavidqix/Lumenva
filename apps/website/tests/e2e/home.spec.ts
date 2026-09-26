import { expect, test } from "@playwright/test";

test("390 px home keeps demo CTA and navigation usable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const pageWidth = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(pageWidth.scrollWidth).toBeLessThanOrEqual(pageWidth.clientWidth);

  await page.getByRole("button", { name: /abrir menu/i }).click();
  const dialog = page.getByRole("dialog", { name: /navegação móvel/i });
  await expect(
    dialog.getByRole("link", { name: /agendar demonstração/i }),
  ).toHaveAttribute("href", "/contato");
  await dialog.getByRole("button", { name: /^fechar menu$/i }).click();

  const finalCta = page.getByRole("heading", {
    name: /veja a lumenva aplicada à sua operação/i,
  });
  await finalCta.scrollIntoViewIfNeeded();
  await expect(finalCta).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("home-390.png"),
  });
});
