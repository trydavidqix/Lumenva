export interface CreativeJob {
  id: string;
  type: 'image' | 'video';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  prompt: string;
  resultUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreativeJobOptions {
  prompt: string;
  type: 'image' | 'video';
  metadata?: Record<string, unknown>;
}
