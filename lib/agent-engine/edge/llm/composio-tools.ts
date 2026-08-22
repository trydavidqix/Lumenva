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
import { Composio } from '@composio/core';
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

/**
 * @param userId Identidade da CONTA CONECTADA na Composio (não é o lead nem o
 *   operador do CRM) — cada org self-host que configurar Composio conecta a
 *   própria conta (Google Workspace da empresa) sob um id estável escolhido
 *   por ela; aqui usamos a própria organizationId do tenant, que já é estável
 *   e único por design, sem inventar um terceiro identificador.
 */
export async function buildComposioTurnTools(
  apiKey: string,
  userId: string,
  apps: string[],
  log: Logger,
): Promise<ComposioTurnTools | null> {
  if (apiKey === '' || apps.length === 0) return null;

  try {
    const composio = getClient(apiKey);
    // `toolkits` é config de CRIAÇÃO da sessão (não parâmetro de `.tools()`) —
    // ver dist/docs/reference/sdk-reference/typescript/sessions.mdx do pacote.
    const session = await composio.create(userId, { toolkits: apps });
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
