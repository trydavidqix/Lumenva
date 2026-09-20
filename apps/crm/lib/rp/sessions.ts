export interface RPTranscriptSegment {
  id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker?: string;
  confidence?: number;
}

export interface RPSession {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  duration_ms: number;
  transcript: RPTranscriptSegment[];
}
