import { RPMoment } from './moments';
import { RPSession } from './sessions';

export interface RPClipCandidate {
  id: string;
  moment_id: string;
  start_ms: number;
  end_ms: number;
  score: number;
  tags: string[];
}

export class ClipSelector {
  constructor() {}

  async extractCandidates(
    session: RPSession,
    moment: RPMoment,
    pre_context_ms: number = 5000,
    post_context_ms: number = 5000
  ): Promise<RPClipCandidate[]> {
    // Stub implementation
    console.log(`Extracting clip candidates for moment ${moment.id} in session ${session.id}...`);
    return [
      {
        id: `clip-${Date.now()}`,
        moment_id: moment.id,
        start_ms: Math.max(0, moment.start_ms - pre_context_ms),
        end_ms: Math.min(session.duration_ms, moment.end_ms + post_context_ms),
        score: moment.importance_score,
        tags: [moment.type],
      }
    ];
  }
}
