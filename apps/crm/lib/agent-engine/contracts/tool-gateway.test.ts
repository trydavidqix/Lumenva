import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import type { AgentToolDefinition } from '../tools/registry';
import {
  executeThroughToolGateway,
  wrapToolSetWithGateway,
} from '../tools/gateway';

function tool(
  risk: AgentToolDefinition['risk'],
  overrides: Partial<AgentToolDefinition> = {},
): AgentToolDefinition {
  const hasSideEffect = risk !== 'r0_read';
  return {
    id: `tool.${risk}`,
    owner: 'agent-engine.test',
    source: 'internal',
    schema: { kind: 'inline', value: {} },
    risk,
    hasSideEffect,
    idempotencyRequired: hasSideEffect,
    timeoutMs: 10_000,
    maxRetries: 1,
    ...overrides,
  };
}

const baseContext = {
  organizationId: 'org-1',
  agentId: 'agent-1',
  autonomyLevel: 'autopilot_low_risk' as const,
  tenantPolicy: {},
  agentPolicy: {},
};

describe('Agent OS Tool Gateway', () => {
  it('executa R0/R1 permitido e nunca deixa o modelo sobrepor a policy', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true });

    const result = await executeThroughToolGateway({
      ...baseContext,
      tool: tool('r1_reversible_write'),
      args: { stage: 'qualified' },
      idempotencyKey: 'idem-1',
      execute,
      approvalStore: null,
    });

    expect(result).toEqual({ kind: 'executed', result: { ok: true } });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('R2 em autopilot_low_risk pausa para aprovação e não executa', async () => {
    const execute = vi.fn();
    const save = vi.fn();
    const load = vi.fn();

    const result = await executeThroughToolGateway({
      ...baseContext,
      tool: tool('r2_external_communication', { id: 'send_message' }),
      args: { body: 'Olá' },
      idempotencyKey: 'idem-send-1',
      execute,
      approvalStore: { save, load },
    });

    expect(result.kind).toBe('pending_approval');
    expect(execute).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('R4 é negado antes de qualquer execute', async () => {
    const execute = vi.fn();

    const result = await executeThroughToolGateway({
      ...baseContext,
      autonomyLevel: 'autopilot_expanded',
      tool: tool('r4_destructive_admin'),
      args: {},
      idempotencyKey: 'idem-r4',
      execute,
      approvalStore: null,
    });

    expect(result).toEqual({ kind: 'denied', reason: 'r4_requires_human' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('tools MCP usam o mesmo gateway de policy/risco/idempotência', async () => {
    const execute = vi.fn();
    const wrapped = wrapToolSetWithGateway(
      {
        crm_assign_conversation: {
          execute,
        },
      } as never,
      {
        ...baseContext,
        definitions: new Map([
          [
            'crm_assign_conversation',
            tool('r1_reversible_write', {
              id: 'crm_assign_conversation',
              source: 'mcp',
            }),
          ],
        ]),
        approvalStore: null,
        idempotencyKeyFor: () => 'idem-mcp-1',
      },
    );

    await (wrapped.crm_assign_conversation as { execute: (args: unknown) => Promise<unknown> }).execute({
      conversation_id: 'conv-1',
    });

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('o caminho MCP suportado é obrigado a passar pelo Tool Gateway', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib/agent-engine/edge/crm/mcp-tools.ts'),
      'utf8',
    );

    expect(source).toContain('pickToolsFromMcp');
  });
});
