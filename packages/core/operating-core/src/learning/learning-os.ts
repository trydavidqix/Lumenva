/**
 * Wave 17: Learning OS
 */

export interface Experience {
  id: string;
  timestamp: string;
  context: string;
  outcome: 'success' | 'failure' | 'partial';
  data: Record<string, unknown>;
}

export interface Reflection {
  experienceId: string;
  insights: string[];
  proposedChanges: string[];
}

export interface LearningCandidate {
  id: string;
  reflection: Reflection;
  status: 'pending_eval' | 'in_review' | 'approved' | 'rejected';
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  capabilityMatrix: Record<string, unknown>;
}

/**
 * Process stub representing Eval -> Review -> Approved -> Skill
 */
export class LearningProcess {
  public async evaluate(candidate: LearningCandidate): Promise<LearningCandidate> {
    return { ...candidate, status: 'in_review' };
  }

  public async review(candidate: LearningCandidate, approved: boolean): Promise<LearningCandidate> {
    return { ...candidate, status: approved ? 'approved' : 'rejected' };
  }

  public async crystallize(candidate: LearningCandidate): Promise<Skill> {
    if (candidate.status !== 'approved') {
      throw new Error('Cannot crystallize a candidate that is not approved');
    }
    return {
      id: `skill-${candidate.id}`,
      name: 'New Skill',
      description: 'Learned from experience',
      capabilityMatrix: {}
    };
  }
}
