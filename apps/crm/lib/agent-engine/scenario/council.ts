import type {
  CouncilChallengeInput,
  CouncilChallengeResult,
  CouncilMemberProvenance,
  CouncilPort,
  CouncilProposalInput,
  CouncilProposalResult,
  CouncilReviewInput,
  CouncilReviewResult,
  CouncilStrategyCandidate,
} from "../contracts/scenario";

export interface CouncilMemberProposal {
  candidates: CouncilStrategyCandidate[];
  disagreements: string[];
  synthesis: string;
  tokens?: number;
  costCents?: number;
}

export interface CouncilMemberChallenge {
  challenges: string[];
  missingEvidence: string[];
  fragileAssumptions: string[];
  tokens?: number;
  costCents?: number;
}

export interface CouncilMemberReview {
  summary: string;
  recommendation?: string;
  disagreements: string[];
  criticalAssumptions: string[];
  nextValidationSteps: string[];
  tokens?: number;
  costCents?: number;
}

export interface CouncilMemberAdapter {
  id: string;
  provider?: string;
  model?: string;
  propose(input: CouncilProposalInput): Promise<CouncilMemberProposal>;
  challenge(input: CouncilChallengeInput): Promise<CouncilMemberChallenge>;
  review(input: CouncilReviewInput): Promise<CouncilMemberReview>;
}

export interface GovernedCouncilConfig {
  maxMembers: number;
  maxRuntimeMs: number;
  maxTokens?: number;
  maxCostCents?: number;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Council member timed out.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function candidateKey(candidate: CouncilStrategyCandidate): string {
  return JSON.stringify({ name: candidate.name.trim().toLowerCase(), parameters: candidate.parameters });
}

function limitCandidates(candidates: CouncilStrategyCandidate[], max: number): CouncilStrategyCandidate[] {
  const seen = new Set<string>();
  const output: CouncilStrategyCandidate[] = [];
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(candidate);
    if (output.length >= max) break;
  }
  return output;
}

function provenance(
  member: CouncilMemberAdapter,
  status: CouncilMemberProvenance["status"],
  latencyMs: number,
  usage?: { tokens?: number; costCents?: number },
  error?: unknown,
): CouncilMemberProvenance {
  return {
    memberId: member.id,
    provider: member.provider,
    model: member.model,
    latencyMs,
    tokens: usage?.tokens,
    costCents: usage?.costCents,
    status,
    error: error instanceof Error ? error.message.slice(0, 300) : error ? "Council member failed." : undefined,
  };
}

export function createGovernedCouncil(
  allMembers: CouncilMemberAdapter[],
  config: GovernedCouncilConfig,
): CouncilPort {
  const members = allMembers.slice(0, Math.max(1, config.maxMembers));
  const perMemberTimeout = Math.max(100, Math.floor(config.maxRuntimeMs / Math.max(1, members.length)));

  return {
    async propose(input): Promise<CouncilProposalResult> {
      const candidates: CouncilStrategyCandidate[] = [];
      const disagreements: string[] = [];
      const syntheses: string[] = [];
      const memberProvenance: CouncilMemberProvenance[] = [];
      let tokens = 0;
      let costCents = 0;

      for (const member of members) {
        if (config.maxTokens !== undefined && tokens >= config.maxTokens) {
          memberProvenance.push(provenance(member, "skipped", 0, undefined, "Council token budget exhausted."));
          continue;
        }
        if (config.maxCostCents !== undefined && costCents >= config.maxCostCents) {
          memberProvenance.push(provenance(member, "skipped", 0, undefined, "Council cost budget exhausted."));
          continue;
        }
        const started = Date.now();
        try {
          const result = await withTimeout(member.propose(input), perMemberTimeout);
          tokens += result.tokens ?? 0;
          costCents += result.costCents ?? 0;
          candidates.push(...result.candidates);
          disagreements.push(...result.disagreements);
          if (result.synthesis.trim()) syntheses.push(`${member.id}: ${result.synthesis.trim()}`);
          memberProvenance.push(provenance(member, "ok", Date.now() - started, result));
        } catch (error) {
          memberProvenance.push(provenance(member, "failed", Date.now() - started, undefined, error));
        }
      }

      return {
        candidates: limitCandidates(candidates, Math.max(1, input.maxCandidates)),
        disagreements: dedupe(disagreements),
        memberProvenance,
        synthesis: syntheses.join("\n"),
      };
    },

    async challenge(input): Promise<CouncilChallengeResult> {
      const challenges: string[] = [];
      const missingEvidence: string[] = [];
      const fragileAssumptions: string[] = [];
      const memberProvenance: CouncilMemberProvenance[] = [];
      for (const member of members) {
        const started = Date.now();
        try {
          const result = await withTimeout(member.challenge(input), perMemberTimeout);
          challenges.push(...result.challenges);
          missingEvidence.push(...result.missingEvidence);
          fragileAssumptions.push(...result.fragileAssumptions);
          memberProvenance.push(provenance(member, "ok", Date.now() - started, result));
        } catch (error) {
          memberProvenance.push(provenance(member, "failed", Date.now() - started, undefined, error));
        }
      }
      return {
        challenges: dedupe(challenges),
        missingEvidence: dedupe(missingEvidence),
        fragileAssumptions: dedupe(fragileAssumptions),
        memberProvenance,
      };
    },

    async review(input): Promise<CouncilReviewResult> {
      const summaries: string[] = [];
      const recommendations: string[] = [];
      const disagreements: string[] = [];
      const criticalAssumptions: string[] = [];
      const nextValidationSteps: string[] = [];
      const memberProvenance: CouncilMemberProvenance[] = [];
      for (const member of members) {
        const started = Date.now();
        try {
          const result = await withTimeout(member.review(input), perMemberTimeout);
          summaries.push(`${member.id}: ${result.summary}`);
          if (result.recommendation) recommendations.push(result.recommendation);
          disagreements.push(...result.disagreements);
          criticalAssumptions.push(...result.criticalAssumptions);
          nextValidationSteps.push(...result.nextValidationSteps);
          memberProvenance.push(provenance(member, "ok", Date.now() - started, result));
        } catch (error) {
          memberProvenance.push(provenance(member, "failed", Date.now() - started, undefined, error));
        }
      }
      return {
        summary: summaries.join("\n"),
        recommendation: dedupe(recommendations).join(" | ") || undefined,
        disagreements: dedupe(disagreements),
        criticalAssumptions: dedupe(criticalAssumptions),
        nextValidationSteps: dedupe(nextValidationSteps),
        memberProvenance,
      };
    },
  };
}
