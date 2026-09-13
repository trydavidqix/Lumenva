import type {
  Phase6IterationResult,
  RunLearningFlywheelInput,
} from '../flywheel/orchestrator';
import { runLearningFlywheelIteration } from '../flywheel/orchestrator';

export interface HermesLearningService {
  runIteration(input: RunLearningFlywheelInput): Promise<Phase6IterationResult>;
}

export function createHermesLearningService(
  deps: { runIteration?: typeof runLearningFlywheelIteration } = {},
): HermesLearningService {
  const runIteration = deps.runIteration ?? runLearningFlywheelIteration;
  return { runIteration };
}
