import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { radarArticles } from "@/content/radar/articles";
import { ArticleBody } from "@/components/radar/ArticleBody";
import { ArticleSources } from "@/components/radar/ArticleSources";
import { RelatedArticles } from "@/components/radar/RelatedArticles";
import { ShareActions } from "@/components/radar/ShareActions";

afterEach(cleanup);

test("article primitives render every structured block and safe sources", () => {
  render(
    <>
      <ArticleBody
        body={[
          { type: "paragraph", text: "Parágrafo" },
          { type: "heading", level: 2, text: "Título" },
          { type: "bullets", items: ["Um", "Dois"] },
          { type: "quote", text: "Citação", cite: "Fonte" },
          { type: "callout", title: "Nota", text: "Aviso" },
        ]}
      />
      <ArticleSources sources={[{ label: "Fonte segura", url: "https://example.com/source" }]} />
      <ShareActions title="Artigo" url="https://lumenva.pt/radar/artigo" />
    </>,
  );

  expect(screen.getByText("Parágrafo")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Título" })).toBeVisible();
  expect(screen.getByText("Citação")).toBeVisible();
  expect(screen.getByRole("link", { name: "Fonte segura" })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  expect(screen.getByRole("button", { name: /copiar link/i })).toBeVisible();
});

test("related article list excludes current article through domain ranking", () => {
  const current = radarArticles[0]!;
  render(<RelatedArticles articles={[radarArticles[1]!]} />);

  expect(screen.getByRole("heading", { name: /leia também/i })).toBeVisible();
  expect(screen.getByRole("link", { name: radarArticles[1]!.title })).toBeVisible();
  expect(screen.queryByRole("link", { name: current.title })).not.toBeInTheDocument();
});
