import { describe, expect, it } from 'vitest';

import {
  INNGEST_PHASE_7_APP_ID,
  createPhase7InngestClient,
  createPhase7InngestBenchmarkFunction,
} from '@/lib/agent-engine/durable-benchmark/adapters/inngest/sdk-runtime';

describe('Phase 7 Inngest SDK wiring', () => {
  it('creates a dedicated dev-safe Inngest client for the isolated benchmark', () => {
    const client = createPhase7InngestClient({ isDev: true });

    expect(INNGEST_PHASE_7_APP_ID).toBe('deskcomm-agent-os-phase-7-benchmark');
    expect(client).toBeDefined();
  });

  it('defines the benchmark as an Inngest function using the canonical Phase 7 run event', () => {
    const client = createPhase7InngestClient({ isDev: true });
    const fn = createPhase7InngestBenchmarkFunction(client);

    expect(fn).toBeDefined();
  });
});
