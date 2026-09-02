import type { LearningProposalStore } from './contracts';
import { clusterLearningSignals, type ClusterThresholds, type LearningCluster } from './clustering';
import { normalizeLearningSignal } from './signals';
import { upsertLearningProposal, type ProposalDraft } from './proposals';

export interface FlywheelLoopBudget {
  maxSignals: number;
  maxClusters: number;
  maxCandidates: number;
  maxModelTokens: number;
  maxCostCents: number;
  maxRuntimeMs: number;
  noProgressLimit: number;
}

export interface Phase6IterationResult {
  processedSignals: number;
  clusters: number;
  createdProposals: number;
  enrichedProposals: number;
  modelTokensUsed: number;
  costCentsUsed: number;
  stoppedReason: 'completed' | 'budget_exhausted' | 'no_progress';
}

export interface ProposalSynthesisResult {
  draft: ProposalDraft | null;
  modelTokens: number;
  costCents: number;
}

export interface RunLearningFlywheelInput {
  rawSignals: readonly unknown[];
  store: LearningProposalStore;
  thresholds: ClusterThresholds;
  budget: FlywheelLoopBudget;
  nowMs: number;
  proposalForCluster(cluster: LearningCluster): ProposalDraft | ProposalSynthesisResult | null;
}

function assertBudget(budget: FlywheelLoopBudget): void {
  const values = Object.values(budget);
  if (
    values.some((value) => !Number.isFinite(value) || value < 0) ||
    budget.noProgressLimit < 1 ||
    budget.maxRuntimeMs < 1
  ) {
    throw new Error('flywheel_budget_invalid');
  }
}

function isSynthesisResult(
  value: ProposalDraft | ProposalSynthesisResult,
): value is ProposalSynthesisResult {
  return 'draft' in value;
}

function normalizeSynthesis(
  value: ProposalDraft | ProposalSynthesisResult | null,
): ProposalSynthesisResult {
  if (value === null) return { draft: null, modelTokens: 0, costCents: 0 };
  if (!isSynthesisResult(value)) return { draft: value, modelTokens: 0, costCents: 0 };
  if (
    !Number.isFinite(value.modelTokens) ||
    value.modelTokens < 0 ||
    !Number.isFinite(value.costCents) ||
    value.costCents < 0
  ) {
    throw new Error('flywheel_synthesis_usage_invalid');
  }
  return value;
}

export async function runLearningFlywheelIteration(
  input: RunLearningFlywheelInput,
): Promise<Phase6IterationResult> {
  assertBudget(input.budget);
  const started = Date.now();
  const limitedRaw = input.rawSignals.slice(0, input.budget.maxSignals);
  const signals = limitedRaw.map(normalizeLearningSignal);
  const allClusters = clusterLearningSignals(signals, input.thresholds, input.nowMs);
  const clusters = allClusters.slice(0, input.budget.maxClusters);

  let createdProposals = 0;
  let enrichedProposals = 0;
  let candidates = 0;
  let noProgress = 0;
  let modelTokensUsed = 0;
  let costCentsUsed = 0;
  let exhausted =
    input.rawSignals.length > input.budget.maxSignals ||
    allClusters.length > input.budget.maxClusters;

  for (const cluster of clusters) {
    if (Date.now() - started >= input.budget.maxRuntimeMs) {
      exhausted = true;
      break;
    }

    const synthesis = normalizeSynthesis(input.proposalForCluster(cluster));
    modelTokensUsed += synthesis.modelTokens;
    costCentsUsed += synthesis.costCents;

    if (
      modelTokensUsed > input.budget.maxModelTokens ||
      costCentsUsed > input.budget.maxCostCents
    ) {
      exhausted = true;
      break;
    }

    const draft = synthesis.draft;
    if (!draft) {
      noProgress += 1;
      if (noProgress >= input.budget.noProgressLimit) break;
      continue;
    }
    if (candidates >= input.budget.maxCandidates) {
      exhausted = true;
      break;
    }

    const result = await upsertLearningProposal(input.store, draft);
    candidates += 1;
    noProgress = 0;
    if (result.kind === 'created') createdProposals += 1;
    else enrichedProposals += 1;
  }

  const stoppedReason = exhausted
    ? 'budget_exhausted'
    : clusters.length > 0 && noProgress >= input.budget.noProgressLimit
      ? 'no_progress'
      : 'completed';

  return {
    processedSignals: signals.length,
    clusters: clusters.length,
    createdProposals,
    enrichedProposals,
    modelTokensUsed,
    costCentsUsed,
    stoppedReason,
  };
}
