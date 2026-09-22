import type { ExecutionPort, ExecutionResult, RiskLevel, TaskComplexity, TaskContract } from './execution-port';

export interface BenchmarkCase {
  id: string;
  task_type: string;
  contract: TaskContract;
  risk: RiskLevel;
  complexity: TaskComplexity;
}

export interface BenchmarkSample {
  case_id: string;
  executor: string;
  status: ExecutionResult['status'];
  tests_passed: boolean;
  latency_ms: number;
  input_tokens?: number;
  output_tokens?: number;
  cached_tokens?: number;
  cost_usd?: number;
}

export interface BenchmarkReport {
  samples: BenchmarkSample[];
  by_executor: Record<string, {
    samples: number;
    success_rate: number;
    deterministic_pass_rate: number;
    avg_latency_ms: number;
    avg_cost_usd?: number;
  }>;
}

export async function runBenchmark(
  cases: BenchmarkCase[],
  executors: ExecutionPort[],
): Promise<BenchmarkReport> {
  const samples: BenchmarkSample[] = [];
  for (const testCase of cases) {
    for (const executor of executors) {
      const start = Date.now();
      const result = await executor.execute(testCase.contract);
      const latency = Date.now() - start;
      samples.push({
        case_id: testCase.id,
        executor: executor.name,
        status: result.status,
        tests_passed: result.tests.length > 0 && result.tests.every((test) => test.passed),
        latency_ms: result.usage?.duration_ms ?? latency,
        input_tokens: result.usage?.input_tokens,
        output_tokens: result.usage?.output_tokens,
        cached_tokens: result.usage?.cached_input_tokens,
        cost_usd: result.usage?.cost_usd,
      });
    }
  }

  const names = [...new Set(samples.map((sample) => sample.executor))];
  const by_executor = Object.fromEntries(names.map((name) => {
    const rows = samples.filter((sample) => sample.executor === name);
    const costs = rows.flatMap((row) => row.cost_usd === undefined ? [] : [row.cost_usd]);
    return [name, {
      samples: rows.length,
      success_rate: rows.filter((row) => row.status === 'success').length / rows.length,
      deterministic_pass_rate: rows.filter((row) => row.tests_passed).length / rows.length,
      avg_latency_ms: rows.reduce((sum, row) => sum + row.latency_ms, 0) / rows.length,
      avg_cost_usd: costs.length ? costs.reduce((sum, cost) => sum + cost, 0) / costs.length : undefined,
    }];
  }));

  return { samples, by_executor };
}
