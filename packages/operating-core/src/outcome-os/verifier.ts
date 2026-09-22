import { ResultContract } from './result-contracts.js';

export interface OutcomeEvidence {
  source_ref: string;
  content_hash: string;
  observed_at: Date;
  metadata?: Record<string, any>;
}

export type VerificationResult = {
  result: 'verified' | 'rejected' | 'needs_human';
  reason?: string;
};

export interface OutcomeVerifier {
  verify(evidence: OutcomeEvidence[], contract: ResultContract): Promise<VerificationResult>;
}

export class AppointmentBookedVerifier implements OutcomeVerifier {
  async verify(evidence: OutcomeEvidence[], contract: ResultContract): Promise<VerificationResult> {
    const hasCalendarEvent = evidence.some(e => e.metadata?.calendar_event_ref);
    const hasAcceptanceMsg = evidence.some(e => e.metadata?.acceptance_message_ref);

    if (hasCalendarEvent && hasAcceptanceMsg) {
      return { result: 'verified' };
    } else if (hasCalendarEvent || hasAcceptanceMsg) {
      return { result: 'needs_human', reason: 'Missing partial evidence' };
    }

    return { result: 'rejected', reason: 'Missing required evidence' };
  }
}
