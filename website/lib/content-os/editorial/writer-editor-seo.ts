import { createBlogArticleJsonLd, createBlogArticleMetadata } from "@/lib/blog/metadata";
import type { BlogArticle, BlogArticleType } from "@/lib/blog/types";

export type ResearchClaim = Readonly<{
  id: string;
  statement: string;
  status: "confirmed" | "attributed" | "interpretation" | "unverified";
  evidenceIds: readonly string[];
}>;

export type ResearchEvidence = Readonly<{
  id: string;
  label: string;
  url: string;
  sourceType?: "primary" | "secondary" | "community";
}>;

export type ResearchPackage = Readonly<{
  topic: string;
  angle: string;
  claims: readonly ResearchClaim[];
  evidence: readonly ResearchEvidence[];
  expertNotes?: readonly string[];
}>;

export type ArticleBrief = Readonly<{
  topic: string;
  angle: string;
  audience: string;
  articleType: BlogArticleType;
  claims: readonly ResearchClaim[];
  evidence: readonly ResearchEvidence[];
  expertNotes: readonly string[];
  requiredSections: readonly string[];
  internalLinkTargets: readonly string[];
}>;

export type ArticleDraft = Readonly<{
  article: BlogArticle;
  claimIds?: readonly string[];
  internalLinks?: readonly string[];
}>;

export type EditorialIssue = Readonly<{
  code:
    | "missing-title"
    | "missing-excerpt"
    | "invalid-slug"
    | "missing-body"
    | "missing-heading"
    | "missing-source"
    | "unsupported-claim"
    | "invalid-source-url"
    | "invalid-internal-link"
    | "seo-title-length"
    | "seo-description-length"
    | "image-alt-missing";
  message: string;
}>;

export type EditorialValidation = Readonly<{
  ok: boolean;
  issues: readonly EditorialIssue[];
}>;

const REQUIRED_SECTIONS: Record<BlogArticleType, readonly string[]> = {
  noticia: ["O que aconteceu", "O que muda", "Fontes"],
  insight: ["Contexto", "Análise", "Conclusão", "Fontes"],
  guia: ["Como funciona", "Passo a passo", "Conclusão", "Fontes"],
};

function validHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function buildArticleBrief(input: {
  research: ResearchPackage;
  audience: string;
  articleType: BlogArticleType;
  internalLinkTargets?: readonly string[];
}): ArticleBrief {
  return {
    topic: input.research.topic,
    angle: input.research.angle,
    audience: input.audience,
    articleType: input.articleType,
    claims: input.research.claims.filter((claim) => claim.status !== "unverified"),
    evidence: input.research.evidence,
    expertNotes: input.research.expertNotes ?? [],
    requiredSections: REQUIRED_SECTIONS[input.articleType],
    internalLinkTargets: input.internalLinkTargets ?? [],
  };
}

export function planInternalLinks(
  article: Pick<BlogArticle, "slug" | "category" | "tags">,
  candidates: readonly Pick<BlogArticle, "slug" | "category" | "tags">[],
  limit = 3,
): readonly string[] {
  if (limit <= 0) return [];
  return candidates
    .filter((candidate) => candidate.slug !== article.slug)
    .map((candidate) => ({
      slug: candidate.slug,
      score:
        (candidate.category === article.category ? 3 : 0) +
        candidate.tags.filter((tag) => article.tags.includes(tag)).length,
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, limit)
    .map((candidate) => `/blog/${candidate.slug}`);
}

export function validateArticleDraft(
  draft: ArticleDraft,
  research?: Pick<ResearchPackage, "claims" | "evidence">,
): EditorialValidation {
  const { article } = draft;
  const issues: EditorialIssue[] = [];
  if (!article.title.trim()) issues.push({ code: "missing-title", message: "O artigo precisa de um título." });
  if (!article.excerpt.trim()) issues.push({ code: "missing-excerpt", message: "O artigo precisa de um resumo." });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) {
    issues.push({ code: "invalid-slug", message: "O slug deve usar apenas letras minúsculas, números e hífens." });
  }
  if (article.body.length === 0) issues.push({ code: "missing-body", message: "O artigo precisa de conteúdo." });
  if (!article.body.some((block) => block.type === "heading")) {
    issues.push({ code: "missing-heading", message: "O artigo precisa de pelo menos um subtítulo." });
  }
  if (article.sources.length === 0) issues.push({ code: "missing-source", message: "O artigo precisa de pelo menos uma fonte." });
  for (const source of article.sources) {
    if (!validHttpUrl(source.url)) issues.push({ code: "invalid-source-url", message: `Fonte inválida: ${source.label}.` });
  }
  for (const block of article.body) {
    if (block.type === "image" && !block.alt.trim()) {
      issues.push({ code: "image-alt-missing", message: "Toda imagem precisa de texto alternativo." });
    }
  }
  const claimIds = new Set(draft.claimIds ?? []);
  if (research) {
    const evidenceIds = new Set(research.evidence.map((evidence) => evidence.id));
    for (const claim of research.claims) {
      if (claim.status !== "unverified" && (!claimIds.has(claim.id) || claim.evidenceIds.some((id) => !evidenceIds.has(id)))) {
        issues.push({ code: "unsupported-claim", message: `Claim sem evidência suficiente: ${claim.statement}` });
      }
    }
  }
  for (const link of draft.internalLinks ?? []) {
    if (!link.startsWith("/blog/") || link === `/blog/${article.slug}`) {
      issues.push({ code: "invalid-internal-link", message: `Link interno inválido: ${link}.` });
    }
  }
  const seoTitle = article.seo?.title ?? article.title;
  const seoDescription = article.seo?.description ?? article.excerpt;
  if (seoTitle.length < 30 || seoTitle.length > 65) issues.push({ code: "seo-title-length", message: "O título SEO deve ter entre 30 e 65 caracteres." });
  if (seoDescription.length < 70 || seoDescription.length > 160) issues.push({ code: "seo-description-length", message: "A descrição SEO deve ter entre 70 e 160 caracteres." });
  return { ok: issues.length === 0, issues };
}

export function buildArticleSeo(article: BlogArticle) {
  return {
    metadata: createBlogArticleMetadata(article),
    jsonLd: createBlogArticleJsonLd(article),
  };
}

export function getRequiredSections(articleType: BlogArticleType): readonly string[] {
  return REQUIRED_SECTIONS[articleType];
}
