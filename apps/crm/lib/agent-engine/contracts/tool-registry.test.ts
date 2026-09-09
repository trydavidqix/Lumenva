import { describe, expect, it } from 'vitest';

import { AGENT_TOOL_DEFS } from '../agent/inbound-turn';
import { TOOL_CATALOG } from '@/lib/mcp/tools/catalog';
import {
  createInternalToolDefinitions,
  createMcpToolDefinitions,
  createToolRegistry,
  type AgentToolDefinition,
} from '../tools/registry';

const EXPECTED_INTERNAL_IDS = [
  'get_lead_context',
  'send_message',
  'update_lead_state',
  'schedule_followup',
  'save_lead_note',
  'get_lead_note',
  'search_knowledge',
  'request_human_handoff',
  'read_skill_reference',
  'open_human_case',
  'provide_case_update',
  'send_template',
].sort();

function validDefinition(overrides: Partial<AgentToolDefinition> = {}): AgentToolDefinition {
  return {
    id: 'tool.valid',
    owner: 'agent-engine.test',
    source: 'internal',
    schema: { kind: 'inline', value: {} },
    risk: 'r1_reversible_write',
    hasSideEffect: true,
    idempotencyRequired: true,
    timeoutMs: 10_000,
    maxRetries: 1,
    ...overrides,
  };
}

describe('Agent OS tool registry', () => {
  it('cobre exatamente as tools internas expostas pelo Agent Engine', () => {
    const definitions = createInternalToolDefinitions(AGENT_TOOL_DEFS);

    expect(definitions.map((tool) => tool.id).sort()).toEqual(EXPECTED_INTERNAL_IDS);
    for (const tool of definitions) {
      expect(tool.owner.length).toBeGreaterThan(0);
      expect(tool.timeoutMs).toBeGreaterThan(0);
      expect(tool.maxRetries).toBeGreaterThanOrEqual(0);
      expect(tool.schema.kind).toBe('inline');
      if (tool.risk === 'r0_read') {
        expect(tool.hasSideEffect).toBe(false);
      } else {
        expect(tool.hasSideEffect).toBe(true);
        expect(tool.idempotencyRequired).toBe(true);
      }
    }
  });

  it('cobre todo o catálogo MCP e promove capabilities apenasHumano para R4', () => {
    const definitions = createMcpToolDefinitions(TOOL_CATALOG);

    expect(definitions.map((tool) => tool.id).sort()).toEqual(
      TOOL_CATALOG.map((tool) => tool.name).sort(),
    );

    const queueRead = definitions.find((tool) => tool.id === 'crm_get_queue_status');
    const assign = definitions.find((tool) => tool.id === 'crm_assign_conversation');
    const archiveStage = definitions.find((tool) => tool.id === 'crm_archive_stage');

    expect(queueRead).toMatchObject({ risk: 'r0_read', hasSideEffect: false });
    expect(assign).toMatchObject({ risk: 'r1_reversible_write', hasSideEffect: true });
    expect(archiveStage).toMatchObject({ risk: 'r4_destructive_admin', hasSideEffect: true });
  });

  it('rejeita IDs duplicados', () => {
    expect(() =>
      createToolRegistry([
        validDefinition({ id: 'duplicate' }),
        validDefinition({ id: 'duplicate', owner: 'other-owner' }),
      ]),
    ).toThrow(/duplicate_tool_id:duplicate/);
  });

  it('rejeita metadata incompatível com o risco e retry contract', () => {
    expect(() =>
      createToolRegistry([
        validDefinition({ risk: 'r0_read', hasSideEffect: true, idempotencyRequired: true }),
      ]),
    ).toThrow(/invalid_tool_metadata/);

    expect(() =>
      createToolRegistry([
        validDefinition({ risk: 'r2_external_communication', idempotencyRequired: false }),
      ]),
    ).toThrow(/invalid_tool_metadata/);

    expect(() => createToolRegistry([validDefinition({ timeoutMs: 0 })])).toThrow(
      /invalid_tool_metadata/,
    );
    expect(() => createToolRegistry([validDefinition({ maxRetries: -1 })])).toThrow(
      /invalid_tool_metadata/,
    );
  });
});
