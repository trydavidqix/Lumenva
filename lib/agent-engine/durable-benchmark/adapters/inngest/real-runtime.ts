import type { InngestBenchmarkInvocationPort, InngestBenchmarkInvocationResult } from './functions';
import { INNGEST_PHASE_7_EVENT_NAMES } from './functions';

interface InngestRealRuntimeDependencies {
  send(input: {
    name: string;
    data: Readonly<Record<string, unknown>>;
  }): Promise<unknown>;
  waitForResult(input: {
    runId: string;
  }): Promise<InngestBenchmarkInvocationResult>;
}

function assertSyntheticOrganization(organizationId: string): void {
  if (!organizationId.startsWith('synthetic-')) {
    throw new Error('phase7_inngest_requires_synthetic_organization');
  }
}

export function createInngestRealBenchmarkInvocation(
  dependencies: InngestRealRuntimeDependencies,
): InngestBenchmarkInvocationPort {
  return async ({ run }) => {
    assertSyntheticOrganization(run.organizationId);

    await dependencies.send({
      name: INNGEST_PHASE_7_EVENT_NAMES.run,
      data: {
        runId: run.runId,
        scenarioId: run.scenarioId,
        scenarioVersion: run.scenarioVersion,
        organizationId: run.organizationId,
      },
    });

    return dependencies.waitForResult({ runId: run.runId });
  };
}
