import { serve } from 'inngest/next';

import {
  createPhase7InngestBenchmarkFunction,
  createPhase7InngestClient,
} from '@/lib/agent-engine/durable-benchmark/adapters/inngest/sdk-runtime';

const inngest = createPhase7InngestClient({ isDev: process.env.NODE_ENV !== 'production' });
const phase7Benchmark = createPhase7InngestBenchmarkFunction(inngest);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [phase7Benchmark],
});
