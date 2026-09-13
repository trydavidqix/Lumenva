import type { McpToolCatalogEntry } from '@/lib/mcp/tools/catalog';

export type AgentToolRisk =
  | 'r0_read'
  | 'r1_reversible_write'
  | 'r2_external_communication'
  | 'r3_sensitive_commercial'
  | 'r4_destructive_admin';

export type AgentToolSource = 'internal' | 'mcp';

export interface AgentToolDefinition {
  id: string;
  owner: string;
  source: AgentToolSource;
  schema: { kind: 'inline'; value: unknown };
  risk: AgentToolRisk;
  hasSideEffect: boolean;
  idempotencyRequired: boolean;
  timeoutMs: number;
  maxRetries: number;
}

type InlineAgentToolShape = Record<string, { inputSchema: unknown }>;

interface InternalToolPolicy {
  owner: string;
  risk: AgentToolRisk;
  timeoutMs: number;
  maxRetries: number;
}

const INTERNAL_TOOL_POLICIES: Readonly<Record<string, InternalToolPolicy>> = {
  get_lead_context: { owner: 'agent-engine.context', risk: 'r0_read', timeoutMs: 10_000, maxRetries: 1 },
  send_message: { owner: 'agent-engine.channel', risk: 'r2_external_communication', timeoutMs: 30_000, maxRetries: 2 },
  update_lead_state: { owner: 'agent-engine.lead-state', risk: 'r1_reversible_write', timeoutMs: 15_000, maxRetries: 1 },
  schedule_followup: { owner: 'agent-engine.followup', risk: 'r1_reversible_write', timeoutMs: 15_000, maxRetries: 1 },
  save_lead_note: { owner: 'agent-engine.memory', risk: 'r1_reversible_write', timeoutMs: 15_000, maxRetries: 1 },
  get_lead_note: { owner: 'agent-engine.memory', risk: 'r0_read', timeoutMs: 10_000, maxRetries: 1 },
  search_knowledge: { owner: 'agent-engine.knowledge', risk: 'r0_read', timeoutMs: 20_000, maxRetries: 1 },
  request_human_handoff: { owner: 'agent-engine.handoff', risk: 'r1_reversible_write', timeoutMs: 15_000, maxRetries: 1 },
  read_skill_reference: { owner: 'agent-engine.skills', risk: 'r0_read', timeoutMs: 10_000, maxRetries: 1 },
  open_human_case: { owner: 'agent-engine.cases', risk: 'r1_reversible_write', timeoutMs: 15_000, maxRetries: 1 },
  provide_case_update: { owner: 'agent-engine.cases', risk: 'r1_reversible_write', timeoutMs: 15_000, maxRetries: 1 },
  send_template: { owner: 'agent-engine.channel', risk: 'r2_external_communication', timeoutMs: 30_000, maxRetries: 2 },
  mobile_compliance_audit: { owner: 'product-factory.mobile-compliance', risk: 'r0_read', timeoutMs: 60_000, maxRetries: 1 },
  mobile_runtime_review: { owner: 'product-factory.mobile-runtime', risk: 'r0_read', timeoutMs: 300_000, maxRetries: 0 },
  mobile_compliance_autofix: { owner: 'product-factory.mobile-compliance', risk: 'r1_reversible_write', timeoutMs: 120_000, maxRetries: 0 },
  mobile_store_submit: { owner: 'product-factory.mobile-release', risk: 'r3_sensitive_commercial', timeoutMs: 300_000, maxRetries: 0 },
};

function hasSideEffect(risk: AgentToolRisk): boolean { return risk !== 'r0_read'; }

function definitionFromPolicy(input: { id: string; owner: string; source: AgentToolSource; schema: unknown; risk: AgentToolRisk; timeoutMs: number; maxRetries: number }): AgentToolDefinition {
  const sideEffect = hasSideEffect(input.risk);
  return { id: input.id, owner: input.owner, source: input.source, schema: { kind: 'inline', value: input.schema }, risk: input.risk, hasSideEffect: sideEffect, idempotencyRequired: sideEffect, timeoutMs: input.timeoutMs, maxRetries: input.maxRetries };
}

export function createInternalToolDefinitions(toolDefs: InlineAgentToolShape): AgentToolDefinition[] {
  return Object.entries(toolDefs).map(([id, def]) => {
    const policy = INTERNAL_TOOL_POLICIES[id];
    if (!policy) throw new Error(`missing_internal_tool_metadata:${id}`);
    return definitionFromPolicy({ id, owner: policy.owner, source: 'internal', schema: def.inputSchema, risk: policy.risk, timeoutMs: policy.timeoutMs, maxRetries: policy.maxRetries });
  });
}

function mcpRisk(entry: McpToolCatalogEntry): AgentToolRisk {
  if (entry.apenasHumano === true) return 'r4_destructive_admin';
  if (entry.category === 'read' || entry.risco === 'seguro') return 'r0_read';
  if (entry.risco === 'critico') return 'r2_external_communication';
  return 'r1_reversible_write';
}

export function createMcpToolDefinitions(catalog: ReadonlyArray<McpToolCatalogEntry>): AgentToolDefinition[] {
  return catalog.map((entry) => {
    const risk = mcpRisk(entry);
    return definitionFromPolicy({ id: entry.name, owner: `mcp.${entry.category}`, source: 'mcp', schema: { catalogEntry: entry.name }, risk, timeoutMs: risk === 'r0_read' ? 15_000 : 30_000, maxRetries: risk === 'r4_destructive_admin' ? 0 : 1 });
  });
}

function assertValidDefinition(definition: AgentToolDefinition): void {
  const validRisk = definition.risk === 'r0_read' || definition.risk === 'r1_reversible_write' || definition.risk === 'r2_external_communication' || definition.risk === 'r3_sensitive_commercial' || definition.risk === 'r4_destructive_admin';
  const validBase = definition.id.trim().length > 0 && definition.owner.trim().length > 0 && (definition.source === 'internal' || definition.source === 'mcp') && definition.schema.kind === 'inline' && validRisk && Number.isFinite(definition.timeoutMs) && definition.timeoutMs > 0 && Number.isInteger(definition.maxRetries) && definition.maxRetries >= 0;
  const validRiskContract = definition.risk === 'r0_read' ? definition.hasSideEffect === false && definition.idempotencyRequired === false : definition.hasSideEffect === true && definition.idempotencyRequired === true;
  if (!validBase || !validRiskContract) throw new Error(`invalid_tool_metadata:${definition.id}`);
}

export function createToolRegistry(definitions: ReadonlyArray<AgentToolDefinition>): ReadonlyMap<string, AgentToolDefinition> {
  const registry = new Map<string, AgentToolDefinition>();
  for (const definition of definitions) {
    assertValidDefinition(definition);
    if (registry.has(definition.id)) throw new Error(`duplicate_tool_id:${definition.id}`);
    registry.set(definition.id, definition);
  }
  return registry;
}
