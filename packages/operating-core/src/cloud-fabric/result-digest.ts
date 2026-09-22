import type { ExecutionResult, TestResult, UsageSnapshot } from "./execution-port.js";

export interface ResultDigest {
  task_id: string;
  status: ExecutionResult["status"];
  summary: string;
  changed: string[];
  tests: TestResult[];
  important_decisions: string[];
  risk: string;
  evidence: string[];
  usage?: UsageSnapshot;
}

export function createResultDigest(
  result: ExecutionResult,
  input: { important_decisions?: string[]; risk?: string } = {},
): ResultDigest {
  return {
    task_id: result.task_id,
    status: result.status,
    summary: result.summary.slice(0, 2_000),
    changed: result.files_changed.slice(0, 100),
    tests: result.tests.slice(0, 100),
    important_decisions: (input.important_decisions ?? []).slice(0, 20),
    risk: input.risk ?? "unknown",
    evidence: result.evidence.slice(0, 100),
    ...(result.usage ? { usage: result.usage } : {}),
  };
}
