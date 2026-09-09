import { generateText } from "ai";
import { z } from "zod";

import { defaultBotModel, gatewayHeaders, isAiGatewayConfigured, resolveLanguageModel } from "@/lib/ai/gateway";
import type { EditorialStageError } from "../orchestrator";

const articleBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().trim().min(1) }),
  z.object({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3)]), text: z.string().trim().min(1) }),
  z.object({ type: z.literal("bullets"), items: z.array(z.string().trim().min(1)).min(1) }),
  z.object({ type: z.literal("quote"), text: z.string().trim().min(1), cite: z.string().trim().min(1).optional() }),
  z.object({ type: z.literal("callout"), text: z.string().trim().min(1), title: z.string().trim().min(1).optional() }),
  z.object({ type: z.literal("image"), src: z.string().url(), alt: z.string().trim().min(1), caption: z.string().trim().min(1).optional() }),
]);

const generatedArticleSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(180),
  excerpt: z.string().trim().min(1).max(320),
  type: z.enum(["noticia", "insight", "guia"]),
  category: z.string().trim().min(1).max(80),
  tags: z.array(z.string().trim().min(1)).min(1).max(8),
  readingMinutes: z.number().int().min(1).max(60),
  featured: z.boolean().default(false),
  subtitle: z.string().trim().min(1).max(240).optional(),
  seo: z.object({ title: z.string().trim().min(30).max(65), description: z.string().trim().min(70).max(160) }),
  body: z.array(articleBlock).min(4),
  claimIds: z.array(z.string()).default([]),
});

export type GeneratedEditorialArticle = z.infer<typeof generatedArticleSchema> & {
  sources: Array<{ label: string; url: string }>;
  claimIds: string[];
};

export class EditorialWriterError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, code: string, retryable = false) {
    super(message);
    this.name = "EditorialWriterError";
    this.code = code;
    this.retryable = retryable;
  }
}

function jsonFromModel(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new EditorialWriterError("Writer returned invalid JSON", "writer_invalid_json", true);
  }
}

/**
 * Generates a structured article from the evidence package. The model is
 * never allowed to invent sources: every source and claim id is copied from
 * the persisted package and the response is validated before it leaves this
 * boundary.
 */
export async function generateEditorialArticle(input: {
  organizationId: string;
  topic: string;
  research: Record<string, unknown>;
  factcheck: Record<string, unknown>;
  articleType?: "noticia" | "insight" | "guia";
}): Promise<GeneratedEditorialArticle> {
  if (!isAiGatewayConfigured()) throw new EditorialWriterError("AI provider is not configured", "ai_provider_missing");
  const model = resolveLanguageModel(defaultBotModel());
  if (!model) throw new EditorialWriterError("AI model could not be resolved", "ai_model_unavailable", true);

  const pkg = (input.research.package ?? input.research) as Record<string, unknown>;
  const sources = Array.isArray(pkg.sources) ? pkg.sources : [];
  const claims = Array.isArray(pkg.claims) ? pkg.claims : [];
  const prompt = [
    "Crie um artigo editorial em português do Brasil.",
    "Responda SOMENTE com JSON válido, sem markdown e sem comentários.",
    `Tipo obrigatório: ${input.articleType ?? "insight"}. Tema: ${input.topic}.`,
    "Use apenas as fontes e claims fornecidos. Não crie URLs, factos ou números novos.",
    "Inclua pelo menos quatro blocos, headings nível 2 ou 3, e uma seção Fontes.",
    JSON.stringify({ sources, claims, factcheck: input.factcheck }),
    "Formato: {slug,title,excerpt,type,category,tags,readingMinutes,featured,subtitle?,seo:{title,description},body:[{type,text,level?}],claimIds}.",
  ].join("\n");

  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({ model, prompt, temperature: 0.2, headers: gatewayHeaders({ organizationId: input.organizationId }) });
  } catch (error) {
    const failure = error as EditorialStageError;
    throw new EditorialWriterError(failure.message || "Writer request failed", "writer_provider_failed", true);
  }

  const parsed = generatedArticleSchema.safeParse(jsonFromModel(result.text));
  if (!parsed.success) throw new EditorialWriterError("Writer output failed the article contract", "writer_contract_failed", true);
  const outputSources = sources.flatMap((source) => {
    const value = source as Record<string, unknown>;
    const url = typeof value.url === "string" ? value.url : null;
    if (!url) return [];
    return [{ label: String(value.title ?? value.publisher ?? url), url }];
  });
  const claimIds = parsed.data.claimIds;
  const validClaimIds = claimIds.filter((id) => claims.some((claim) => String((claim as Record<string, unknown>).id) === id));
  return { ...parsed.data, sources: outputSources, claimIds: validClaimIds };
}
