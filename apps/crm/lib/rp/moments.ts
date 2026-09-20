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
    console.log('Detecting moments from transcript with', transcript.length, 'segments...');
    const moments: RPMoment[] = [];
    
    // Keyword mapping to detect moment types
    const keywords: Record<RPMomentType, string[]> = {
      conflict: ['fight', 'argue', 'idiot', 'mad', 'angry', 'hate', 'kill'],
      humor: ['haha', 'lol', 'lmao', 'funny', 'joke', 'laugh'],
      police: ['police', 'cop', 'cops', 'siren', 'arrest', 'officer'],
      action: ['shoot', 'run', 'fast', 'car', 'gun', 'punch'],
      other: []
    };

    let currentMoment: RPMoment | null = null;

    for (const segment of transcript) {
      const text = segment.text.toLowerCase();
      let detectedType: RPMomentType | null = null;

      // Find the first matching type based on keywords
      for (const [type, words] of Object.entries(keywords)) {
        if (words.some(word => text.includes(word))) {
          detectedType = type as RPMomentType;
          break;
        }
      }

      if (detectedType) {
        if (currentMoment && currentMoment.type === detectedType && (segment.start_ms - currentMoment.end_ms) < 10000) {
          // Extend current moment if it's the same type and within 10 seconds
          currentMoment.end_ms = segment.end_ms;
          currentMoment.segments.push(segment);
          currentMoment.importance_score = Math.min(1.0, currentMoment.importance_score + 0.1);
        } else {
          // Finish previous moment and start a new one
          if (currentMoment) {
            moments.push(currentMoment);
          }
          currentMoment = {
            id: `moment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            start_ms: segment.start_ms,
            end_ms: segment.end_ms,
            type: detectedType,
            importance_score: 0.5,
            description: `Detected ${detectedType} moment`,
            segments: [segment],
          };
        }
      } else {
        // Gap handling or extending context
        if (currentMoment) {
          if ((segment.start_ms - currentMoment.end_ms) >= 10000) {
            // Gap is too large, close the current moment
            moments.push(currentMoment);
            currentMoment = null;
          } else {
            // Include in current moment for context
            currentMoment.end_ms = segment.end_ms;
            currentMoment.segments.push(segment);
          }
        }
      }
    }

    if (currentMoment) {
      moments.push(currentMoment);
    }

    return moments;
  }
}
