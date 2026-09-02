/**
 * Validação de env vars com Zod.
 *
 * Chamada implicitamente no startup do Next via import. Se variável crítica
 * está faltando, lança erro com mensagem clara antes do app subir.
 *
 * Uso: import { env } from "@/lib/env";
 */

import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

/**
 * Durante `next build` (NEXT_PHASE=phase-production-build) os segredos de runtime
 * ainda não existem — só as NEXT_PUBLIC_* são embutidas no bundle. Nessa fase
 * afrouxamos a validação (via seed de placeholders no parse abaixo) pra gerar a
 * imagem Docker (self-host) sem passar segredos como ARG, que vazariam nas
 * camadas. O boot real (sem essa fase) cobra os valores verdadeiros.
 *
 * A leniência é feita SÓ no parse — os validadores continuam com tipos Zod
 * estáveis, senão `z.infer` degrada `env.*` pra `{}` (uniões quebram `.url()`).
 */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Em produção exigimos todas as vars críticas. Em dev, algumas são opcionais
 * pra permitir setup parcial (ex: dev sem WAHA quando trabalhando só na UI).
 */
const required = (name: string) =>
  isProd
    ? z.string().min(1, `${name} é obrigatória em produção`)
    : z.string().default("");

const requiredAlways = (name: string) => z.string().min(1, `${name} é obrigatória`);

const schema = z.object({
  // Node
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Supabase — obrigatórias sempre (até pra dev local)
  NEXT_PUBLIC_SUPABASE_URL: requiredAlways("NEXT_PUBLIC_SUPABASE_URL").url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requiredAlways("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: requiredAlways("SUPABASE_SERVICE_ROLE_KEY"),

  // Cron / interno
  INTERNAL_SECRET: required("INTERNAL_SECRET"),
  /** Optional dedicated secret for cron endpoints (S-06.07 onwards). */
  INTERNAL_CRON_SECRET: z.string().optional().default(""),
  EMAIL_RELAY_OWNER_WHATSAPP_E164: z
    .string()
    .regex(/^\+\d{8,15}$/, "EMAIL_RELAY_OWNER_WHATSAPP_E164 deve estar em E.164")
    .optional()
    .default(""),
  EMAIL_RELAY_ORGANIZATION_ID: z.string().uuid().optional().default(""),
  EMAIL_RELAY_DRY_RUN: z.enum(["true", "false"]).optional().default("false").transform((v) => v === "true"),

  // Encryption keys (pgcrypto)
  CPF_ENCRYPTION_KEY: required("CPF_ENCRYPTION_KEY"),
  // Opcional (template genérico) — só necessária ao ligar NUVEMSHOP_ENABLED.
  NUVEMSHOP_OAUTH_ENCRYPTION_KEY: z.string().optional().default(""),
  WAHA_BYO_ENCRYPTION_KEY: required("WAHA_BYO_ENCRYPTION_KEY"),
  /**
   * AES-256-GCM key (32 bytes em base64) usada pra cifrar API keys em
   * `ai_provider_credentials`. Em produção é obrigatória; em dev a default vazia
   * é tolerada — `lib/crypto/aes_gcm.ts` lança se a key não bate em runtime.
   */
  AI_CRED_AES_KEY: required("AI_CRED_AES_KEY"),

  // Postgres direto do Supabase (Settings → Database) — só as rotas de skills
  // instaláveis (import/install) usam `pg` cru (mesmo pool do agent-engine).
  SUPABASE_DB_URL: required("SUPABASE_DB_URL"),

  // WAHA
  WAHA_API_BASE_URL: required("WAHA_API_BASE_URL"),
  WAHA_API_KEY: required("WAHA_API_KEY"),
  WAHA_WEBHOOK_BASE_URL: required("WAHA_WEBHOOK_BASE_URL"),
  // Segredo com que o WAHA assina os webhooks. O compose já o entrega ao
  // contêiner do WAHA; o app precisa dele para CONFERIR a assinatura — e não o
  // declarava aqui, então nunca teve como verificar nada.
  WAHA_HMAC_SECRET: z.string().optional().default(""),
  // "true" exige assinatura válida em todo webhook do WAHA. Fica desligado por
  // padrão porque o WAHA Core não assina (medido: 2026.7.2 CORE manda os
  // eventos sem header mesmo com WHATSAPP_HOOK_HMAC configurado), e exigir
  // derrubaria a ingestão de mensagens. Ligue se usa WAHA Plus ou um proxy que
  // assine — aí a verificação passa a ser obrigatória.
  WAHA_WEBHOOK_REQUIRE_SIGNATURE: z.string().optional().default("false"),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: required("UPSTASH_REDIS_REST_URL"),
  UPSTASH_REDIS_REST_TOKEN: required("UPSTASH_REDIS_REST_TOKEN"),

  // AI providers — env-gated. Worker no-ops with skip="ai_gateway_key_missing"
  // when AI_GATEWAY_API_KEY is absent, so production boot must not be fatal.
  AI_GATEWAY_API_KEY: z.string().optional().default(""),
  AI_GATEWAY_BASE_URL: z.string().optional().default(""),
  // OpenRouter: alternativa ao gateway da Vercel, compatível com a API da
  // OpenAI. Opcional — sem ela nada muda; com ela o chat passa a ser roteado
  // por lá. Ver resolveLanguageModel() em lib/ai/gateway.ts.
  OPENROUTER_API_KEY: z.string().optional().default(""),
  OPENROUTER_BASE_URL: z.string().optional().default(""),
  VERCEL_AI_GATEWAY_URL: z.string().optional().default(""),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),
  // Google (Gemini) direct provider — alternative to ANTHROPIC_API_KEY for the
  // platform-level bot/classifier model when neither the gateway nor
  // Anthropic is configured. See resolveLanguageModel() in lib/ai/gateway.ts.
  GOOGLE_API_KEY: z.string().optional().default(""),
  // Embedding provider override — RAG embeddings only support the Vercel AI
  // Gateway or raw OpenAI by default (embedText() in lib/ai/embed.ts), both
  // of which require a paid/card-verified account. Setting these 3 lets a
  // self-host point embeddings at any OpenAI-compatible endpoint (e.g. NVIDIA
  // Build's free tier) instead, bypassing the gateway entirely for this call
  // — same swap pattern already used for the Graphiti sidecar's LLM/embedder
  // (GRAPHITI_LLM_BASE_URL). Takes priority over AI_GATEWAY_API_KEY/
  // OPENAI_API_KEY for embeddings specifically when all 3 are set; chat/
  // gateway resolution elsewhere in the app is unaffected.
  EMBEDDING_BASE_URL: z.string().url().optional().or(z.literal("")).default(""),
  EMBEDDING_API_KEY: z.string().optional().default(""),
  EMBEDDING_MODEL_ID: z.string().optional().default(""),

  // Composio (docs.composio.dev) — gives agents managed-OAuth access to Google
  // Calendar/Gmail/Docs/Sheets (and 1000+ other apps) without the CRM
  // implementing OAuth per provider. Optional: an agent version's
  // `composio_apps` only produces tools when this key is set — self-hosters
  // who don't configure it get the pre-existing zero-tools behavior, never a
  // hard failure. See lib/agent-engine/edge/llm/composio-tools.ts.
  COMPOSIO_API_KEY: z.string().optional().default(""),

  // AI Platform Foundation — all external providers start disabled; a kill
  // switch wins over any tenant or global database flag.
  AI_PLATFORM_KILL_MEM0: z.enum(["true", "false"]).optional().default("false").transform((v) => v === "true"),
  AI_PLATFORM_KILL_LLAMAINDEX: z.enum(["true", "false"]).optional().default("false").transform((v) => v === "true"),
  AI_PLATFORM_KILL_GRAPHITI: z.enum(["true", "false"]).optional().default("false").transform((v) => v === "true"),
  AI_PLATFORM_KILL_LANGSMITH: z.enum(["true", "false"]).optional().default("false").transform((v) => v === "true"),
  AI_PLATFORM_KILL_EXTERNAL_GUARDRAILS: z.enum(["true", "false"]).optional().default("false").transform((v) => v === "true"),
  AI_PLATFORM_KILL_N8N: z.enum(["true", "false"]).optional().default("false").transform((v) => v === "true"),
  AI_PLATFORM_KILL_LANGGRAPH: z.enum(["true", "false"]).optional().default("false").transform((v) => v === "true"),

  // Mem0 is an optional self-hosted semantic-memory projection. Declaring its
  // connection here does not activate the provider; rollout remains feature-gated.
  MEM0_BASE_URL: z.string().url().optional().or(z.literal("")).default(""),
  MEM0_API_KEY: z.string().optional().default(""),
  MEM0_TIMEOUT_MS: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.coerce.number().int().positive().optional().default(2_000),
  ),

  // Graphiti is an optional temporal/relationship graph projection (Phase 4,
  // Neo4j-backed, docker-compose profile `ai-graph`). Originally wired to
  // FalkorDB; swapped to Neo4j because the packaged REST server in
  // `zepai/graphiti:0.22.0` only speaks Neo4j (graph_service/config.py has
  // no FalkorDB fields at all) — see docs/runbooks/graphiti.md. None of
  // these 7 app-facing vars are database-specific (the Neo4j connection
  // details live only inside the sidecar container's own env, not here), so
  // none needed to change in the swap. Declaring a connection here does not
  // activate the provider — AI_PLATFORM_KILL_GRAPHITI above plus the per-org
  // rollout mode gate that separately. LLM/EMBEDDER provider+model only
  // label what the sidecar itself was configured with (a platform-owned
  // credential delivered via Infisical/runtime env to the container, never a
  // tenant's ai_provider_credentials BYOK key) — see docs/runbooks/graphiti.md.
  GRAPHITI_BASE_URL: z.string().url().optional().or(z.literal("")).default(""),
  GRAPHITI_API_KEY: z.string().optional().default(""),
  GRAPHITI_TIMEOUT_MS: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().optional().default(2_000),
  ),
  GRAPHITI_LLM_PROVIDER: z.string().optional().default(""),
  GRAPHITI_LLM_MODEL: z.string().optional().default(""),
  GRAPHITI_EMBEDDER_PROVIDER: z.string().optional().default(""),
  GRAPHITI_EMBEDDER_MODEL: z.string().optional().default(""),

  // LangSmith is optional observability only. The endpoint is deliberately not
  // validated here: a malformed optional endpoint must disable tracing safely,
  // not prevent the CRM from booting (see external-tracing-config.ts).
  LANGSMITH_API_KEY: z.string().optional().default(""),
  LANGSMITH_ENDPOINT: z.string().optional().default(""),
  LANGSMITH_PROJECT: z.string().optional().default(""),
  LANGSMITH_WORKSPACE_ID: z.string().optional().default(""),

  // Content OS intelligence providers — optional until the private engines are
  // deployed. Their credentials remain server-side and never enter public URLs.
  CONTENT_OS_RSSHUB_BASE_URL: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .default(""),
  CONTENT_OS_RSSHUB_ACCESS_KEY: z.string().optional().default(""),
  CONTENT_OS_CHANGEDETECTION_BASE_URL: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .default(""),
  CONTENT_OS_CHANGEDETECTION_API_KEY: z.string().optional().default(""),

  // Fusão (Fase 4): DONO ÚNICO dos eventos ai_agent.dispatch_requested.
  // 'engine' (default) = o worker agent-engine é o único consumidor (o cron
  // agent-dispatcher vira no-op mecânico); 'native' = o dispatcher EPIC-13
  // consome (deploy sem worker). NUNCA os dois — dois consumidores = turno
  // duplicado ou perdido (bug real da fusão).
  AGENT_DISPATCH_CONSUMER: z.enum(["engine", "native"]).optional().default("engine"),

  // Workers — opt-in via env so dev doesn't run loops. Production cron sets it.
  EVENT_LOG_WORKER_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((v) => v === "true"),

  // O endpoint :test devolve um trace fake quando esta flag = 'true'.
  // Default 'false' desde que a S-13.08 landou: `callInternalRuntime` executa
  // o `runAgent` real, então quem instala do zero testa o agente de verdade.
  // Ligue 'true' só para exercitar o render da UI sem gastar token.
  INTERNAL_AGENT_RUN_STUB: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((v) => v === "true"),

  // Sentry
  SENTRY_DSN: z.string().optional().default(""),

  // EPIC-11 Impersonate cookie HMAC secret. Optional at boot (route returns
  // 503 at runtime if missing/short); required in prod for the feature to
  // function. Min 32 chars when present is enforced at use site.
  IMPERSONATE_COOKIE_SECRET: z.string().optional().default(""),

  // LGPD export (S-08.04)
  LGPD_SIGNING_KEY: z.string().optional().default(""),
  LGPD_EXPORT_EXPIRES_HOURS: z.string().optional().default("72"),
  LGPD_DPO_EMAIL: z.string().optional().default(""),

  // Nuvemshop — opcional (template genérico open-source). Só exigidas quando
  // NUVEMSHOP_ENABLED=true; o runtime já degrada via getConfig()==null.
  NUVEMSHOP_APP_ID: z.string().optional().default(""),
  NUVEMSHOP_CLIENT_ID: z.string().optional().default(""),
  NUVEMSHOP_CLIENT_SECRET: z.string().optional().default(""),
  NUVEMSHOP_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((v) => v === "true"),

  // WhatsApp Cloud API (Meta) — mesmo padrão do Nuvemshop: opcional, sem elas o
  // canal oficial simplesmente não é configurado e o WAHA segue funcionando.
  META_APP_SECRET: z.string().optional().default(""),
  META_WABA_ID: z.string().optional().default(""),
  META_PHONE_NUMBER_ID: z.string().optional().default(""),
  META_SYSTEM_USER_TOKEN: z.string().optional().default(""),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(""),
  META_GRAPH_VERSION: z.string().optional().default("v22.0"),

  // App URLs
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
  NEXT_PUBLIC_ADMIN_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),

  // Marca da instalação (white-label) — ver lib/branding.ts.
  // Sem prefixo NEXT_PUBLIC_ de propósito: essas seriam queimadas no bundle
  // durante o build da imagem, e o self-hoster roda uma imagem pré-buildada.
  // O <PublicEnvScript/> injeta os valores em runtime.
  APP_NAME: z.string().optional().default(""),
  APP_LOGO_URL: z.string().optional().default(""),
});

let parsed = schema.safeParse(process.env);

// Na fase de build da imagem Docker, semeia placeholders pras vars que faltam
// (URL válida, passa .url()/.min(1)) e revalida — permite `next build` sem os
// segredos de runtime. NUNCA acontece em runtime: lá process.env está completo
// e este bloco não roda, então o boot real continua cobrando tudo.
if (!parsed.success && isBuildPhase) {
  const seeded: Record<string, string | undefined> = { ...process.env };
  for (const key of Object.keys(parsed.error.flatten().fieldErrors)) {
    if (!seeded[key]) seeded[key] = "https://build-placeholder.invalid";
  }
  parsed = schema.safeParse(seeded);
}

if (!parsed.success) {
  // Log estruturado pra debug. Sentry capturaria via uncaught.
  console.error("[env] Falha de validação de variáveis de ambiente:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error(
    "Variáveis de ambiente inválidas. Veja o erro acima e ajuste .env.local / Vercel.",
  );
}

export const env = parsed.data;

// Soft warning for env-gated AI keys (worker degrades gracefully but operators
// should know when the bot is silent for config reasons).
if (!env.AI_GATEWAY_API_KEY && !env.ANTHROPIC_API_KEY && !env.GOOGLE_API_KEY) {
  console.warn(
    "[env] No AI_GATEWAY_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY set — ai-response-worker will skip with reason='ai_gateway_key_missing'.",
  );
}
if (!env.OPENAI_API_KEY) {
  console.warn(
    "[env] No OPENAI_API_KEY set — RAG embedding unavailable (bot answers without retrieved context) " +
      "AND voice-note transcription is off (the agent will ask leads to resend audio as text).",
  );
}
if (!env.IMPERSONATE_COOKIE_SECRET || env.IMPERSONATE_COOKIE_SECRET.length < 32) {
  console.warn(
    "[env] IMPERSONATE_COOKIE_SECRET not set or shorter than 32 chars — impersonate flow will return 503 at runtime.",
  );
}

export type Env = typeof env;
