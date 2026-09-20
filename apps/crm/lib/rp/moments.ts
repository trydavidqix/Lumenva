import { RPTranscriptSegment } from './sessions';

export type RPMomentType = 'humor' | 'conflict' | 'police' | 'action' | 'other';

export interface RPMoment {
  id: string;
  start_ms: number;
  end_ms: number;
  type: RPMomentType;
  importance_score: number; // 0.0 to 1.0
  description?: string;
  segments: RPTranscriptSegment[];
}

export class MomentDetectionEngine {
  constructor() {}

  async detectMoments(transcript: RPTranscriptSegment[]): Promise<RPMoment[]> {
    // Stub implementation
    console.log('Detecting moments from transcript with', transcript.length, 'segments...');
    return [];
  }
}
