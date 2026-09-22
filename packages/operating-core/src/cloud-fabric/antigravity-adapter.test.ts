import { describe, expect, it } from 'vitest';
import { AntigravityAdapter } from './antigravity-adapter.js';
import type { TaskContract } from './execution-port.js';

const contract: TaskContract = {
  task_id: 'antigravity-test',
  goal: 'probe provider',
  scope: 'test',
  allowed_paths: [],
  constraints: [],
  capabilities: [],
  risk: 'low',
  base_sha: 'test',
  context_budget: { input_tokens: 100 },
  tool_budget: { calls: 1 },
  execution_budget: { seconds: 1 },
  preferred_provider: 'antigravity',
  evidence_required: [],
};

describe('AntigravityAdapter', () => {
  it('reports unavailable instead of simulating execution', async () => {
    const result = await new AntigravityAdapter().execute(contract);

    expect(result.status).toBe('unavailable');
    expect(result.error?.code).toBe('provider_unavailable');
  });

  it('does not advertise capabilities without a runnable provider', async () => {
    const adapter = new AntigravityAdapter();

    expect((await adapter.health()).status).toBe('unavailable');
    expect(await adapter.capabilities()).toEqual([]);
  });
});
