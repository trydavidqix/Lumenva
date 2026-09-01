import type { DurableBenchmarkScenario } from './scenarios';

export function shouldInjectFault(input: {
  scenario: DurableBenchmarkScenario;
  stepId: string;
  occurrence: number;
}): boolean {
  return input.scenario.faults.some(
    (fault) => fault.stepId === input.stepId && fault.occurrence === input.occurrence,
  );
}
