import { describe, it, expect } from 'vitest';
import { AppointmentBookedVerifier, OutcomeEvidence } from '../../src/outcome-os/verifier';
import { ResultContract } from '../../src/outcome-os/result-contracts';

describe('AppointmentBookedVerifier (Shadow Mode)', () => {
  const verifier = new AppointmentBookedVerifier();
  const mockContract: ResultContract = {
    id: 'mock-id',
    outcomeDefinitionId: 'def-id',
    terms: {}
  };

  it('should return verified when both calendar_event_ref and acceptance_message_ref are present', async () => {
    const evidence: OutcomeEvidence[] = [
      {
        source_ref: 'calendar',
        content_hash: 'hash1',
        observed_at: new Date(),
        metadata: { calendar_event_ref: 'evt_123' }
      },
      {
        source_ref: 'whatsapp',
        content_hash: 'hash2',
        observed_at: new Date(),
        metadata: { acceptance_message_ref: 'msg_123' }
      }
    ];

    const res = await verifier.verify(evidence, mockContract);
    expect(res.result).toBe('verified');
  });

  it('should return needs_human when only one evidence is present', async () => {
    const evidence: OutcomeEvidence[] = [
      {
        source_ref: 'calendar',
        content_hash: 'hash1',
        observed_at: new Date(),
        metadata: { calendar_event_ref: 'evt_123' }
      }
    ];

    const res = await verifier.verify(evidence, mockContract);
    expect(res.result).toBe('needs_human');
  });

  it('should return rejected when no required evidence is present', async () => {
    const evidence: OutcomeEvidence[] = [
      {
        source_ref: 'system',
        content_hash: 'hash3',
        observed_at: new Date(),
        metadata: { some_other_ref: 'abc' }
      }
    ];

    const res = await verifier.verify(evidence, mockContract);
    expect(res.result).toBe('rejected');
  });
});
