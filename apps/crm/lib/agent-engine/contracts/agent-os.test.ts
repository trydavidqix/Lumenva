import { describe, expect, it } from 'vitest';

import {
  deriveToolIdempotencyKey,
  evaluateLoopBudget,
  evaluateNoProgress,
  evaluateRepeatedTool,
  evaluateToolFailure,
  isAgentRunTransitionAllowed,
  isTerminalAgentRunStatus,
  validateAgentLoopSpec,
  type AgentLoopSpec,
} from './agent-os';

const validLoop: AgentLoopSpec = {
  goal: 'qualificar o lead com segurança',
  maxSteps: 8,
  maxToolCalls: 12,
  maxTokens: 16_000,
  maxCostCents: 50,
  maxRuntimeMs: 60_000,
  repeatedToolLimit: 3,
  noProgressLimit: 3,
};

const retryableTool = {
  id: 'crm.contact.update',
  risk: 'r1_reversible_write',
  hasSideEffect: true,
  idempotencyRequired: true,
  timeoutMs: 5_000,
  maxRetries: 2,
} as const;

describe('Agent OS canonical contracts', () => {
  it('reconhece somente estados terminais canônicos', () => {
    expect(isTerminalAgentRunStatus('completed')).toBe(true);
    expect(isTerminalAgentRunStatus('policy_denied')).toBe(true);
    expect(isTerminalAgentRunStatus('waiting_approval')).toBe(false);
    expect(isTerminalAgentRunStatus('retryable_failure')).toBe(false);
    expect(isTerminalAgentRunStatus('running')).toBe(false);
  });

  it('não permite ressuscitar uma execução terminal', () => {
    expect(isAgentRunTransitionAllowed('completed', 'running')).toBe(false);
    expect(isAgentRunTransitionAllowed('policy_denied', 'running')).toBe(false);
    expect(isAgentRunTransitionAllowed('cancelled', 'running')).toBe(false);
  });

  it('permite pausa, retomada e encerramento a partir de estados não terminais', () => {
    expect(isAgentRunTransitionAllowed('running', 'waiting_approval')).toBe(true);
    expect(isAgentRunTransitionAllowed('waiting_approval', 'running')).toBe(true);
    expect(isAgentRunTransitionAllowed('retryable_failure', 'running')).toBe(true);
    expect(isAgentRunTransitionAllowed('running', 'completed')).toBe(true);
  });

  it('interrompe quando maxSteps é atingido', () => {
    expect(evaluateLoopBudget(validLoop, {
      steps: validLoop.maxSteps,
      toolCalls: 0,
      tokensUsed: 0,
      costCents: 0,
      runtimeMs: 0,
    })).toEqual({ kind: 'stop', reason: 'max_steps_exhausted' });
  });

  it('interrompe quando maxToolCalls é atingido', () => {
    expect(evaluateLoopBudget(validLoop, {
      steps: 0,
      toolCalls: validLoop.maxToolCalls,
      tokensUsed: 0,
      costCents: 0,
      runtimeMs: 0,
    })).toEqual({ kind: 'stop', reason: 'max_tool_calls_exhausted' });
  });

  it('interrompe quando maxTokens é atingido', () => {
    expect(evaluateLoopBudget(validLoop, {
      steps: 0,
      toolCalls: 0,
      tokensUsed: validLoop.maxTokens,
      costCents: 0,
      runtimeMs: 0,
    })).toEqual({ kind: 'stop', reason: 'max_tokens_exhausted' });
  });

  it('interrompe quando maxCostCents é atingido', () => {
    expect(evaluateLoopBudget(validLoop, {
      steps: 0,
      toolCalls: 0,
      tokensUsed: 0,
      costCents: validLoop.maxCostCents,
      runtimeMs: 0,
    })).toEqual({ kind: 'stop', reason: 'max_cost_exhausted' });
  });

  it('interrompe quando maxRuntimeMs é atingido', () => {
    expect(evaluateLoopBudget(validLoop, {
      steps: 0,
      toolCalls: 0,
      tokensUsed: 0,
      costCents: 0,
      runtimeMs: validLoop.maxRuntimeMs,
    })).toEqual({ kind: 'stop', reason: 'max_runtime_exhausted' });
  });

  it('permite continuar quando todos os budgets estão abaixo do limite', () => {
    expect(evaluateLoopBudget(validLoop, {
      steps: validLoop.maxSteps - 1,
      toolCalls: validLoop.maxToolCalls - 1,
      tokensUsed: validLoop.maxTokens - 1,
      costCents: validLoop.maxCostCents - 0.01,
      runtimeMs: validLoop.maxRuntimeMs - 1,
    })).toEqual({ kind: 'continue' });
  });

  it('interrompe ferramenta repetida com os mesmos argumentos normalizados', () => {
    expect(evaluateRepeatedTool(validLoop, [
      { tool: 'crm.contact.update', args: { status: 'qualified', id: 'c1' } },
      { tool: 'crm.contact.update', args: { id: 'c1', status: 'qualified' } },
      { tool: 'crm.contact.update', args: { status: 'qualified', id: 'c1' } },
    ])).toEqual({ kind: 'stop', reason: 'repeated_tool_exhausted' });
  });

  it('não bloqueia ferramentas diferentes nem argumentos materialmente diferentes', () => {
    expect(evaluateRepeatedTool(validLoop, [
      { tool: 'crm.contact.read', args: { id: 'c1' } },
      { tool: 'crm.contact.update', args: { id: 'c1', status: 'qualified' } },
      { tool: 'crm.contact.update', args: { id: 'c1', status: 'proposal' } },
    ])).toEqual({ kind: 'continue' });
  });

  it('interrompe passos sem progresso material até o limite configurado', () => {
    expect(evaluateNoProgress(validLoop, [
      'stage:qualified|next:send_proposal',
      'stage:qualified|next:send_proposal',
      'stage:qualified|next:send_proposal',
    ])).toEqual({ kind: 'stop', reason: 'no_progress_exhausted' });
  });

  it('permite continuar quando o fingerprint de progresso muda', () => {
    expect(evaluateNoProgress(validLoop, [
      'stage:qualifying|next:collect_budget',
      'stage:qualified|next:send_proposal',
      'stage:qualified|next:await_reply',
    ])).toEqual({ kind: 'continue' });
  });

  it('classifica falha transitória dentro do limite como retryable', () => {
    expect(evaluateToolFailure(retryableTool, {
      failureCount: 1,
      retryable: true,
    })).toEqual({ kind: 'retry', reason: 'tool_retryable_failure' });
  });

  it('interrompe após esgotar retries da ferramenta', () => {
    expect(evaluateToolFailure(retryableTool, {
      failureCount: retryableTool.maxRetries + 1,
      retryable: true,
    })).toEqual({ kind: 'stop', reason: 'tool_retry_exhausted' });
  });

  it('interrompe imediatamente uma falha permanente', () => {
    expect(evaluateToolFailure(retryableTool, {
      failureCount: 1,
      retryable: false,
    })).toEqual({ kind: 'stop', reason: 'tool_permanent_failure' });
  });

  it('deriva a mesma idempotency key para a mesma identidade lógica', () => {
    const left = deriveToolIdempotencyKey({
      runId: 'run-1',
      stepId: 'step-4',
      tool: 'crm.contact.update',
      businessTarget: { status: 'qualified', contactId: 'c1' },
    });
    const right = deriveToolIdempotencyKey({
      runId: 'run-1',
      stepId: 'step-4',
      tool: 'crm.contact.update',
      businessTarget: { contactId: 'c1', status: 'qualified' },
    });

    expect(left).toBe(right);
  });

  it('muda a idempotency key quando muda uma parte da identidade de execução', () => {
    const base = {
      runId: 'run-1',
      stepId: 'step-4',
      tool: 'crm.contact.update',
      businessTarget: { contactId: 'c1' },
    } as const;

    const key = deriveToolIdempotencyKey(base);

    expect(deriveToolIdempotencyKey({ ...base, runId: 'run-2' })).not.toBe(key);
    expect(deriveToolIdempotencyKey({ ...base, stepId: 'step-5' })).not.toBe(key);
    expect(deriveToolIdempotencyKey({ ...base, tool: 'crm.contact.delete' })).not.toBe(key);
    expect(deriveToolIdempotencyKey({ ...base, businessTarget: { contactId: 'c2' } })).not.toBe(key);
  });

  it('aceita loop spec válido', () => {
    expect(validateAgentLoopSpec(validLoop)).toEqual([]);
  });

  it('rejeita goal vazio e limites não positivos', () => {
    const errors = validateAgentLoopSpec({
      ...validLoop,
      goal: '   ',
      maxSteps: 0,
      maxToolCalls: -1,
      repeatedToolLimit: 0,
    });

    expect(errors).toContain('goal_required');
    expect(errors).toContain('maxSteps_must_be_positive_integer');
    expect(errors).toContain('maxToolCalls_must_be_positive_integer');
    expect(errors).toContain('repeatedToolLimit_must_be_positive_integer');
  });

  it('permite orçamento de custo zero, mas não negativo', () => {
    expect(validateAgentLoopSpec({ ...validLoop, maxCostCents: 0 })).toEqual([]);
    expect(validateAgentLoopSpec({ ...validLoop, maxCostCents: -1 })).toContain(
      'maxCostCents_must_be_non_negative',
    );
  });
});
