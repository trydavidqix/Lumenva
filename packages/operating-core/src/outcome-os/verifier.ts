import { ResultContract } from './result-contracts';

export interface OutcomeEvidence {
  source_ref: string;
  content_hash: string;
  observed_at: Date;
  metadata?: Record<string, any>;
}

export interface OutcomeVerifier {
  verify(evidence: OutcomeEvidence, contract: ResultContract): Promise<boolean>;
}
