/**
 * Config do agente por PONTEIRO PUBLICADO (Fase 2B da fusão) — a tela
 * app/app/ai/agents/[id] é a fonte de verdade da config do agente.
 *
 * Contrato:
 *   - resolvida no início de CADA turno (zero cache de processo): publicar na
 *     tela ⇒ o PRÓXIMO turno já usa a versão nova;
 *   - a versão publicada é imutável no banco (trigger da 0051) — mesma garantia
 *     versões-imutáveis+ponteiro do harness (0050);
 *   - seleção espelha o dispatcher do CRM: org + não-arquivado + published_version_id
 *     preenchido + binding da channel_session do job, ordenado por priority desc;
 *   - org e channel_session vêm de fonte confiável (row do job), nunca de payload;
 *   - sem agente publicado para a sessão ⇒ null (o turno cai no comportamento
 *     de fallback: playbook por ponteiro + settings.llm da org + knobs de env).
 */
import type pg from 'pg';

export interface PublishedAgentConfig {
  agentId: string;
  versionId: string;
  agentName: string;
  systemPrompt: string;
  provider: string;
  model: string;
  credentialId: string | null;
  maxSteps: number;
  historyMessageWindow: number;
  historyTokenWindow: number;
  handoffKeywords: string[];
  handoffToolEnabled: boolean;
}

interface Row {
  agent_id: string;
  version_id: string;
  agent_name: string;
  system_prompt: string;
  provider: string;
  model: string;
  credential_id: string | null;
  max_steps: number;
  history_message_window: number;
  history_token_window: number;
  handoff_keywords: string[] | null;
  handoff_tool_enabled: boolean;
}

export async function loadPublishedAgentConfig(
  db: pg.Pool,
  organizationId: string,
  channelSessionId: string,
): Promise<PublishedAgentConfig | null> {
  const { rows } = await db.query<Row>(
    `select a.id as agent_id,
            v.id as version_id,
            a.name as agent_name,
            v.system_prompt,
            v.provider,
            v.model,
            v.credential_id,
            v.max_steps,
            v.history_message_window,
            v.history_token_window,
            v.handoff_keywords,
            v.handoff_tool_enabled
     from ai_agents a
     join ai_agent_versions v on v.id = a.published_version_id
     where a.organization_id = $1
       and a.archived_at is null
       and a.is_active
       and v.status = 'published'
       and v.channel_session_id = $2
     order by a.priority desc, a.created_at asc
     limit 1`,
    [organizationId, channelSessionId],
  );
  const r = rows[0];
  if (r === undefined) return null;
  return {
    agentId: r.agent_id,
    versionId: r.version_id,
    agentName: r.agent_name,
    systemPrompt: r.system_prompt,
    provider: r.provider,
    model: r.model,
    credentialId: r.credential_id,
    maxSteps: r.max_steps,
    historyMessageWindow: r.history_message_window,
    historyTokenWindow: r.history_token_window,
    handoffKeywords: (r.handoff_keywords ?? []).map((k) => k.toLowerCase().trim()).filter((k) => k !== ''),
    handoffToolEnabled: r.handoff_tool_enabled,
  };
}

/**
 * Detecção de handoff por keywords CONFIGURADAS na tela (soma-se à detecção
 * determinística regex do engine — nunca a substitui). Case-insensitive,
 * substring simples: a semântica do EPIC-13 (sentinel de handoff_keywords).
 */
export function matchesHandoffKeyword(signal: string, keywords: readonly string[]): boolean {
  if (keywords.length === 0) return false;
  const lower = signal.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}
