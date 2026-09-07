import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { radarArticles } from "@/content/radar/articles";
import { ArticleList } from "@/components/radar/ArticleList";
import { CategoryNav } from "@/components/radar/CategoryNav";
import { FeaturedArticle } from "@/components/radar/FeaturedArticle";
import { RadarHero } from "@/components/radar/RadarHero";
import { TrendingTopics } from "@/components/radar/TrendingTopics";

afterEach(cleanup);

test("Radar home primitives expose editorial structure and accessible links", () => {
  const featured = radarArticles.find((article) => article.featured);
  expect(featured).toBeDefined();

  render(
    <>
      <RadarHero featured={featured} />
      {featured ? <FeaturedArticle article={featured} /> : null}
      <CategoryNav categories={["Agentes"]} />
      <ArticleList articles={[radarArticles[0]!]} />
      <TrendingTopics tags={["IA", "Agentes"]} />
    </>,
  );

  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/mudar em IA/i);
  expect(screen.getByRole("navigation", { name: /categorias do radar/i })).toBeVisible();
  expect(screen.getByRole("link", { name: /ler destaque/i })).toHaveAttribute(
    "href",
    `/radar/${featured!.slug}`,
  );
  expect(within(screen.getByRole("navigation", { name: /categorias do radar/i })).getByRole("link", { name: "Agentes" })).toHaveAttribute(
    "href",
    "/radar/categoria/agentes",
  );
});
