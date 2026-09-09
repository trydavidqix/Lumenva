import {
  runIntelligenceWorker,
  type IntelligenceWorkerDependencies,
  type IntelligenceWorkerResult,
} from "@/lib/content-os/intelligence/worker";

/**
 * Provider-agnostic worker entry point. Scheduling/authentication stay at the
 * private route; this step owns one bounded, tenant-isolated collection pass.
 */
export function processIntelligenceSources(
  dependencies: IntelligenceWorkerDependencies,
): Promise<IntelligenceWorkerResult> {
  return runIntelligenceWorker(dependencies);
}
