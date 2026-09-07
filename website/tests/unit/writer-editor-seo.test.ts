import { describe, expect, test } from "vitest";
import { blogArticles } from "@/content/blog/articles";
import {
  buildArticleBrief,
  buildArticleSeo,
  planInternalLinks,
  validateArticleDraft,
} from "@/lib/content-os/editorial/writer-editor-seo";
import type { BlogArticle } from "@/lib/blog/types";

const evidence = [{ id: "source-1", label: "Documentação oficial", url: "https://example.com/docs", sourceType: "primary" as const }];
const research = {
  topic: "Agentes de IA",
  angle: "Como equilibrar autonomia e supervisão",
  claims: [{ id: "claim-1", statement: "A supervisão reduz o risco operacional.", status: "confirmed" as const, evidenceIds: ["source-1"] }],
  evidence,
};

function article(overrides: Partial<BlogArticle> = {}): BlogArticle {
  return {
    slug: "agentes-de-ia",
    title: "Agentes de IA com governança humana",
    excerpt: "Uma análise prática sobre autonomia, contexto e supervisão humana em operações empresariais.",
    type: "insight",
    category: "Agentes",
    tags: ["IA", "Agentes"],
    publishedAt: "2026-09-07",
    readingMinutes: 5,
    featured: false,
    body: [
      { type: "heading", level: 2, text: "Contexto" },
      { type: "heading", level: 2, text: "Análise" },
      { type: "heading", level: 2, text: "Conclusão" },
    ],
    sources: [{ label: "Documentação oficial", url: "https://example.com/docs" }],
    seo: {
      title: "Agentes de IA com governança humana | Lumenva",
      description: "Uma análise prática sobre autonomia, contexto e supervisão humana em operações empresariais.",
    },
    ...overrides,
  };
}

describe("writer/editor/SEO contracts", () => {
  test("builds a brief from research while excluding unverified claims", () => {
    const brief = buildArticleBrief({
      research: { ...research, claims: [...research.claims, { id: "claim-2", statement: "Claim não confirmado", status: "unverified", evidenceIds: [] }] },
      audience: "Líderes de operações",
      articleType: "insight",
      internalLinkTargets: ["/blog/produto"],
    });

    expect(brief.claims).toHaveLength(1);
    expect(brief.requiredSections).toEqual(["Contexto", "Análise", "Conclusão", "Fontes"]);
    expect(brief.internalLinkTargets).toEqual(["/blog/produto"]);
  });

  test("plans deterministic links by category and shared tags", () => {
    expect(planInternalLinks(article(), blogArticles)).toEqual([
      "/blog/agentes-de-ia-com-governanca-humana",
    ]);
  });

  test("accepts a draft whose claims have evidence and SEO fields are in range", () => {
    const result = validateArticleDraft({ article: article(), claimIds: ["claim-1"], internalLinks: ["/blog/outro-artigo"] }, research);
    expect(result).toEqual({ ok: true, issues: [] });
  });

  test("blocks unsupported claims, invalid links, missing alt and weak SEO", () => {
    const result = validateArticleDraft(
      {
        article: article({
          seo: { title: "Curto", description: "Curta" },
          body: [{ type: "image", src: "/hero.png", alt: "" }],
          sources: [{ label: "Fonte", url: "javascript:alert(1)" }],
        }),
        claimIds: [],
        internalLinks: ["https://example.com", "/blog/agentes-de-ia"],
      },
      research,
    );

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "invalid-source-url",
      "missing-heading",
      "image-alt-missing",
      "unsupported-claim",
      "invalid-internal-link",
      "seo-title-length",
      "seo-description-length",
    ]));
  });

  test("builds the existing metadata and Article JSON-LD without network calls", () => {
    const seo = buildArticleSeo(article());
    expect(seo.metadata.alternates?.canonical?.toString()).toContain("/blog/agentes-de-ia");
    expect(seo.jsonLd).toMatchObject({ "@type": "Article", headline: article().title, datePublished: "2026-09-07" });
  });
});
