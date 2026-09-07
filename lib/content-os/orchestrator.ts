import { randomUUID } from "node:crypto";
import { createResearchPackage } from "./editorial/research-package";
import { factCheckResearchPackage } from "./editorial/fact-check";
import { generateEditorialArticle } from "./editorial/writer";
import type { Claim, Evidence, ResearchPackage } from "./editorial/contracts";

export const editorialStages = [
  "discovery",
  "research",
  "factcheck",
  "editor",
  "quality_gate",
  "publisher",
] as const;

export type EditorialStage = (typeof editorialStages)[number];
export type EditorialRunStatus = "queued" | "running" | "waiting_retry" | "succeeded" | "failed" | "blocked";

export type EditorialRun = {
  id: string;
  organizationId: string;
  topic: string;
  status: EditorialRunStatus;
  currentStage: EditorialStage;
  attempts: Partial<Record<EditorialStage, number>>;
  outputs: Partial<Record<EditorialStage, Record<string, unknown>>>;
  errors: Array<{ stage: EditorialStage; code: string; message: string; attempt: number; at: string }>;
  createdAt: string;
  updatedAt: string;
};

export type EditorialStageContext = {
  run: EditorialRun;
  stage: EditorialStage;
  input: Record<string, unknown>;
  attempt: number;
};

export type EditorialStageResult = Record<string, unknown> & {
  retryable?: never;
  blocked?: boolean;
};

export type EditorialStageError = Error & { code?: string; retryable?: boolean; blocked?: boolean };

export type EditorialWorkflowDependencies = {
  stages: Partial<Record<EditorialStage, (context: EditorialStageContext) => Promise<EditorialStageResult>>>;
  maxAttempts?: number;
  now?: () => Date;
};

export class EditorialWorkflowError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable = false,
    readonly blocked = false,
  ) {
    super(message);
    this.name = "EditorialWorkflowError";
  }
}

function nextStage(stage: EditorialStage): EditorialStage | null {
  const index = editorialStages.indexOf(stage);
  return editorialStages[index + 1] ?? null;
}

function cloneRun(run: EditorialRun): EditorialRun {
  return { ...run, attempts: { ...run.attempts }, outputs: { ...run.outputs }, errors: [...run.errors] };
}

export function createEditorialRun(input: { organizationId: string; topic: string; id?: string; now?: Date }): EditorialRun {
  const now = (input.now ?? new Date()).toISOString();
  return {
    id: input.id ?? randomUUID(),
    organizationId: input.organizationId,
    topic: input.topic,
    status: "queued",
    currentStage: "discovery",
    attempts: {},
    outputs: {},
    errors: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Runs from the persisted currentStage. A failed transient stage remains
 * waiting_retry and can be resumed without repeating successful stages.
 * The default implementation deliberately has no provider side effects.
 */
export async function runEditorialWorkflow(
  input: EditorialRun,
  dependencies: EditorialWorkflowDependencies,
): Promise<EditorialRun> {
  const run = cloneRun(input);
  const now = dependencies.now ?? (() => new Date());
  const maxAttempts = Math.max(1, dependencies.maxAttempts ?? 3);
  run.status = "running";

  while (true) {
    const stage = run.currentStage;
    const handler = dependencies.stages[stage];
    if (!handler) {
      throw new EditorialWorkflowError(`Missing editorial stage handler: ${stage}`, "stage_handler_missing");
    }

    const attempt = (run.attempts[stage] ?? 0) + 1;
    run.attempts[stage] = attempt;
    try {
      const result = await handler({
        run,
        stage,
        attempt,
        input: { topic: run.topic, ...run.outputs },
      });
      if (result.blocked) {
        run.status = "blocked";
        run.updatedAt = now().toISOString();
        return run;
      }
      const { blocked: _blocked, ...output } = result;
      run.outputs[stage] = output;
      const following = nextStage(stage);
      if (!following) {
        run.status = "succeeded";
        run.updatedAt = now().toISOString();
        return run;
      }
      run.currentStage = following;
      run.updatedAt = now().toISOString();
    } catch (error) {
      const failure = error as EditorialStageError;
      const retryable = failure.retryable === true;
      const code = failure.code ?? "stage_failed";
      const message = failure.message || "Editorial stage failed";
      run.errors.push({ stage, code, message, attempt, at: now().toISOString() });
      if (failure.blocked) {
        run.status = "blocked";
      } else if (retryable && attempt < maxAttempts) {
        run.status = "waiting_retry";
      } else {
        run.status = "failed";
      }
      run.updatedAt = now().toISOString();
      return run;
    }
  }
}

export type EditorialAdapters = {
  discovery?: (input: { organizationId: string; topic: string }) => Promise<Record<string, unknown>>;
  research?: (input: { organizationId: string; topic: string; discovery: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  factcheck?: (input: { organizationId: string; topic: string; research: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  editor?: (input: { organizationId: string; topic: string; factcheck: Record<string, unknown>; research: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  publisher?: (input: { organizationId: string; topic: string; editor: Record<string, unknown>; qualityGate: Record<string, unknown>; idempotencyKey: string }) => Promise<Record<string, unknown>>;
  qualityGate?: (input: { organizationId: string; topic: string; editor: Record<string, unknown>; factcheck: Record<string, unknown>; research: Record<string, unknown> }) => Promise<Record<string, unknown>>;
};

export function createEditorialStages(adapters: EditorialAdapters = {}): EditorialWorkflowDependencies["stages"] {
  return {
    discovery: async ({ run }) => adapters.discovery ? adapters.discovery({ organizationId: run.organizationId, topic: run.topic }) : ({ topic: run.topic, signals: [], mode: "dry_run" }),
    research: async ({ run, input }) => adapters.research ? adapters.research({ organizationId: run.organizationId, topic: run.topic, discovery: (input.discovery ?? {}) as Record<string, unknown> }) : ({ evidence: [], sourceCount: 0, basedOn: input.discovery ?? null, mode: "dry_run" }),
    factcheck: async ({ run, input }) => adapters.factcheck ? adapters.factcheck({ organizationId: run.organizationId, topic: run.topic, research: (input.research ?? {}) as Record<string, unknown> }) : ({ claims: [], verdict: "pass", basedOn: input.research ?? null, mode: "dry_run" }),
    editor: async ({ run, input }) => adapters.editor ? adapters.editor({ organizationId: run.organizationId, topic: run.topic, factcheck: (input.factcheck ?? {}) as Record<string, unknown>, research: (input.research ?? {}) as Record<string, unknown> }) : ({ title: String(input.topic ?? ""), body: "", basedOn: input.factcheck ?? null, mode: "dry_run" }),
    quality_gate: async ({ run, input }) => adapters.qualityGate ? adapters.qualityGate({ organizationId: run.organizationId, topic: run.topic, editor: (input.editor ?? {}) as Record<string, unknown>, factcheck: (input.factcheck ?? {}) as Record<string, unknown>, research: (input.research ?? {}) as Record<string, unknown> }) : ({ passed: true, score: 100, basedOn: input.editor ?? null, mode: "dry_run" }),
    publisher: async ({ run, input }) => adapters.publisher ? adapters.publisher({ organizationId: run.organizationId, topic: run.topic, editor: (input.editor ?? {}) as Record<string, unknown>, qualityGate: (input.quality_gate ?? {}) as Record<string, unknown>, idempotencyKey: `editorial:${run.id}` }) : ({ published: false, dryRun: true, reason: "external publication disabled", basedOn: input.quality_gate ?? null }),
  };
}

export type ProductionEditorialRepository = {
  listSignals(organizationId: string, topic: string): Promise<Array<{ id: string; title: string; body: string | null; sourceUrl: string | null; publishedAt: string | null; observedAt: string }>>;
  listEvidence(organizationId: string, topic: string): Promise<Evidence[]>;
  publishApproved?(input: { organizationId: string; contentItemId: string | null; body: Record<string, unknown>; idempotencyKey: string }): Promise<Record<string, unknown>>;
  persistArtifacts?(run: EditorialRun): Promise<void>;
};

function criticalClaims(value: unknown): Claim[] {
  if (!Array.isArray(value)) return [];
  return value.filter((claim): claim is Claim => Boolean(claim && typeof claim === "object" && typeof (claim as Claim).id === "string" && typeof (claim as Claim).text === "string" && (claim as Claim).importance === "critical"));
}

/** Production composition remains provider-free: it only reads persisted data. */
export function createProductionEditorialAdapters(repository: ProductionEditorialRepository): EditorialAdapters {
  if (!repository) throw new EditorialWorkflowError("Editorial repository is not configured", "not_configured");
  return {
    discovery: async ({ organizationId, topic }) => ({ signals: await repository.listSignals(organizationId, topic), mode: "persisted" }),
    research: async ({ organizationId, topic, discovery }) => {
      const sources = await repository.listEvidence(organizationId, topic);
      const signals = Array.isArray(discovery.signals) ? discovery.signals as Array<{ id: string; title: string; sourceUrl?: string | null; body?: string | null; observedAt?: string }> : [];
      const claims = signals.map((signal) => ({ id: signal.id, text: signal.title, importance: "material" as const }));
      const evidence = sources.length > 0 ? sources : signals.filter((signal) => typeof signal.sourceUrl === "string" && signal.sourceUrl.startsWith("http")).map((signal) => ({
        id: signal.id,
        url: signal.sourceUrl as string,
        title: signal.title,
        publisher: "Fonte monitorada",
        kind: "primary" as const,
        excerpt: signal.body ?? undefined,
        retrievedAt: signal.observedAt ?? new Date().toISOString(),
        supportsClaimIds: [signal.id],
      }));
      const pkg: ResearchPackage = createResearchPackage({ topic, angle: "Editorial analysis", sources: evidence, claims });
      return { package: pkg, evidence: pkg.sources, claims: pkg.claims, mode: "persisted" };
    },
    factcheck: async ({ research }) => {
      const pkg = research.package as ResearchPackage | undefined;
      if (!pkg) throw new EditorialWorkflowError("Research package is missing", "research_package_missing");
      return { ...factCheckResearchPackage(pkg), mode: "deterministic" };
    },
    editor: async ({ organizationId, topic, factcheck, research }) => {
      try {
        return await generateEditorialArticle({ organizationId, topic, research, factcheck });
      } catch (error) {
        // A local installation may intentionally have no model credentials.
        // Keep the run resumable and create a clearly marked draft, but never
        // allow this fallback to become an automatic publication.
        if (!(error instanceof Error) || !["ai_provider_missing", "ai_model_unavailable"].includes((error as { code?: string }).code ?? "")) throw error;
        const pkg = (research.package ?? research) as Record<string, unknown>;
        const evidence = Array.isArray(pkg.evidence) ? pkg.evidence : Array.isArray(pkg.sources) ? pkg.sources : [];
        const claims = Array.isArray(pkg.claims) ? pkg.claims : [];
        const sources = evidence.flatMap((source) => {
          const value = source as Record<string, unknown>;
          return typeof value.url === "string" ? [{ label: String(value.title ?? value.publisher ?? value.url), url: value.url }] : [];
        });
        return {
          slug: topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "rascunho-editorial",
          title: topic,
          excerpt: `Rascunho editorial baseado nas evidências recolhidas sobre ${topic}.`,
          type: "insight",
          category: "IA e operações",
          tags: ["IA"],
          readingMinutes: 3,
          featured: false,
          seo: { title: `${topic.slice(0, 54)} | Lumenva`, description: `Rascunho baseado em fontes verificáveis sobre ${topic}. A publicação aguarda configuração do agente escritor.` },
          body: [
            { type: "paragraph", text: `Este é um rascunho automático sobre ${topic}, aguardando o agente escritor.` },
            { type: "heading", level: 2, text: "Contexto" },
            ...claims.slice(0, 3).map((claim) => ({ type: "paragraph", text: String((claim as Record<string, unknown>).text ?? (claim as Record<string, unknown>).statement ?? "Claim recolhida") })),
            { type: "heading", level: 2, text: "Fontes" },
            { type: "bullets", items: sources.map((source) => source.label).slice(0, 5) },
          ],
          sources,
          claimIds: claims.map((claim) => String((claim as Record<string, unknown>).id)).filter(Boolean),
          mode: "fallback",
        };
      }
    },
    qualityGate: async ({ factcheck, editor, research }) => {
      const score = typeof editor.score === "number" ? editor.score : 100;
      const body = editor.body;
      const sources = editor.sources;
      const blocked = criticalClaims(research.claims).length > 0 || !Array.isArray(research.evidence) || research.evidence.length === 0 || !Array.isArray(body) || body.length < 4 || !Array.isArray(sources) || sources.length === 0 || factcheck.passed === false || score < 90;
      return { passed: !blocked, blocked, score, reason: blocked ? "critical claim, failed fact-check, or score below 90" : "all deterministic gates passed", mode: "deterministic" };
    },
    publisher: async ({ qualityGate, editor, organizationId, idempotencyKey }) => {
      if (qualityGate.passed !== true) throw new EditorialWorkflowError("Quality gate must pass before publication", "quality_gate_required", false, true);
      if (editor.mode === "fallback") return { published: false, dryRun: true, reason: "ai_provider_missing", contentItemId: editor.contentItemId ?? null };
      if (!repository.publishApproved) return { published: false, dryRun: true, reason: "publisher not configured" };
      return repository.publishApproved({ organizationId, contentItemId: typeof editor.contentItemId === "string" ? editor.contentItemId : null, body: editor, idempotencyKey });
    },
  };
}

export function createDryRunEditorialStages(): EditorialWorkflowDependencies["stages"] {
  return createEditorialStages();
}
