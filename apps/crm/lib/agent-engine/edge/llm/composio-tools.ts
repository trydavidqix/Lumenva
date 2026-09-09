/**
 * Tools Composio (docs.composio.dev) habilitadas NA TELA (`ai_agent_versions.
 * composio_apps`) entrando no turno — mesma ideia do 2B-tools do catálogo MCP
 * interno (ver ../crm/mcp-tools.ts), mas pro catálogo EXTERNO da Composio:
 * Google Calendar, Gmail, Docs, Sheets e 1000+ outros apps, com OAuth
 * gerenciado pela Composio em vez de o CRM implementar cada fluxo.
 *
 * `@composio/vercel` já devolve `Tool` do pacote `ai` prontas com `execute`
 * embutido — não precisa de ponte própria como a do catálogo interno
 * (pickToolsFromMcp). O merge com as tools nativas segue a mesma regra de
 * precedência de nome usada em inbound-turn.ts para o MCP interno.
 *
 * Sem `COMPOSIO_API_KEY` configurada: `composio_apps` na tela vira no-op
 * silencioso (null), nunca falha o turno — mesmo contrato de "privilégio,
 * não invariante" do restante do 2B-tools.
 */
import { Composio, SessionPreset } from '@composio/core';
import { VercelProvider } from '@composio/vercel';
import type { Tool } from 'ai';

import type { Logger } from '../../obs/logger';

let client: Composio<VercelProvider> | null = null;

/** Instância única por processo — a SDK cacheia conexão HTTP internamente; um
 *  client por chamada abriria uma conexão nova a cada turno à toa. */
function getClient(apiKey: string): Composio<VercelProvider> {
  if (client === null) {
    client = new Composio({ apiKey, provider: new VercelProvider() });
  }
  return client;
}

export interface ComposioTurnTools {
  tools: Record<string, Tool>;
  toolIds: string[];
}

/** Toolkit slug é o prefixo do tool slug até o primeiro `_`, minúsculo — ex.:
 *  GOOGLECALENDAR_CREATE_EVENT → googlecalendar. É como a Composio nomeia. */
function toolkitOf(toolSlug: string): string {
  return toolSlug.slice(0, toolSlug.indexOf('_')).toLowerCase();
}

/**
 * @param userId Identidade da CONTA CONECTADA na Composio (não é o lead nem o
 *   operador do CRM) — cada org self-host que configurar Composio conecta a
 *   própria conta (Google Workspace da empresa) sob um id estável escolhido
 *   por ela; aqui usamos a própria organizationId do tenant, que já é estável
 *   e único por design, sem inventar um terceiro identificador.
 * @param toolSlugs Tool slugs EXATOS da Composio (ex. "GOOGLECALENDAR_CREATE_EVENT"),
 *   não toolkit slugs. Medido ao vivo: pedir o toolkit inteiro (`toolkits:
 *   ['googlecalendar']` sem filtro de `tools`) trouxe as 44 tools do Calendar
 *   pro prompt — 312k input tokens numa chamada só, 28s de latência, ~14
 *   centavos. O filtro por tool específica evita isso.
 */
export async function buildComposioTurnTools(
  apiKey: string,
  userId: string,
  toolSlugs: string[],
  log: Logger,
): Promise<ComposioTurnTools | null> {
  if (apiKey === '' || toolSlugs.length === 0) return null;

  try {
    const composio = getClient(apiKey);
    const porToolkit: Record<string, string[]> = {};
    for (const slug of toolSlugs) {
      const tk = toolkitOf(slug);
      (porToolkit[tk] ??= []).push(slug);
    }

    // `toolkits`/`tools` são config de CRIAÇÃO da sessão (não parâmetro de
    // `.tools()`) — ver dist/docs/reference/sdk-reference/typescript/
    // sessions.mdx do pacote. `tools: {<toolkit>: [<slug>, ...]}` restringe a
    // sessão às tools exatas, em vez do toolkit inteiro.
    //
    // `sessionPreset: DIRECT_TOOLS` é OBRIGATÓRIO: sem ele, a sessão vem no
    // modo Tool Router — só 6 meta-tools genéricas (COMPOSIO_SEARCH_TOOLS,
    // COMPOSIO_MULTI_EXECUTE_TOOL, COMPOSIO_MANAGE_CONNECTIONS,
    // COMPOSIO_GET_TOOL_SCHEMAS e, mais grave, COMPOSIO_REMOTE_BASH_TOOL +
    // COMPOSIO_REMOTE_WORKBENCH — execução remota de shell, inaceitável num
    // agente de atendimento). Com o preset, `session.tools()` já devolve as
    // tools REAIS pedidas (ex. GOOGLECALENDAR_CREATE_EVENT) direto.
    const session = await composio.create(userId, {
      toolkits: Object.keys(porToolkit),
      tools: porToolkit,
      sessionPreset: SessionPreset.DIRECT_TOOLS,
    });
    const tools = await session.tools();
    return { tools: tools as Record<string, Tool>, toolIds: Object.keys(tools) };
  } catch (err) {
    // Mesma doutrina do 2B-tools interno: tool externa é privilégio, nunca
    // invariante — Composio fora do ar não pode derrubar o turno do cliente.
    const detalhe = (err instanceof Error ? err.message : String(err)).slice(0, 200);
    log.error('tools Composio não montadas — turno segue sem elas', { error: detalhe });
    return null;
  }
}
