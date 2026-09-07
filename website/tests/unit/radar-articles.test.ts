import { describe, expect, it } from "vitest";
import { radarArticles } from "@/content/radar/articles";
import { categorySlug, getAllRadarArticles, getRadarArticleBySlug, getRadarArticlesByType } from "@/lib/radar/articles";

describe("Radar registry", () => {
  it("keeps valid unique editorial records", () => {
    expect(new Set(radarArticles.map((article) => article.slug)).size).toBe(radarArticles.length);
    for (const article of radarArticles) {
      expect(article.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(article.title.length).toBeGreaterThan(0);
      expect(article.excerpt.length).toBeGreaterThan(0);
      expect(article.readingMinutes).toBeGreaterThan(0);
      expect(article.featured).toBeTypeOf("boolean");
      expect(article.body.length).toBeGreaterThan(0);
      expect(article.sources.length).toBeGreaterThan(0);
      expect(article.sources.every((source) => new URL(source.url).protocol === "https:")).toBe(true);
      expect(article.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(article.publishedAt))).toBe(false);
    }
  });

  it("exercises all supported editorial types", () => {
    expect(new Set(radarArticles.map((article) => article.type))).toEqual(new Set(["noticia", "insight", "guia"]));
  });

  it("sorts newest first and resolves records", () => {
    const all = getAllRadarArticles();
    expect(all.every((article, index) => index === 0 || all[index - 1]!.publishedAt >= article.publishedAt)).toBe(true);
    expect(getRadarArticleBySlug(all[0]!.slug)).toEqual(all[0]);
    expect(getRadarArticleBySlug("missing-article")).toBeUndefined();
    expect(getRadarArticlesByType("guia").every((article) => article.type === "guia")).toBe(true);
  });

  it("normalizes category slugs", () => {
    expect(categorySlug("Automação")).toBe("automacao");
  });
});
