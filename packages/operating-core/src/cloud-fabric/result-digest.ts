import type { ExecutionResult, ResultDigest } from './execution-port';

export function toResultDigest(result: ExecutionResult): ResultDigest {
  return {
    task_id: result.task_id,
    execution_id: result.execution_id,
    status: result.status,
    summary: result.summary ?? result.evidence,
    files_changed: result.files_changed,
    tests_passed: result.tests.length > 0 && result.tests.every((test) => test.passed),
    risks: result.risks ?? [],
    evidence_refs: [
      ...(result.artifacts ?? []),
      ...(result.logs ?? []),
      ...(result.evidence ? [result.evidence] : []),
    ],
    usage: result.usage,
  };
}
