export interface LumaVideoGenerationOptions {
  prompt: string;
  duration?: number;
  aspectRatio?: string;
}

export interface LumaVideoGenerationResult {
  id: string;
  url: string;
  status: 'pending' | 'completed' | 'failed';
}

export class LumaClient {
  constructor(private readonly apiKey: string) {}

  async generateVideo(options: LumaVideoGenerationOptions): Promise<LumaVideoGenerationResult> {
    return {
      id: `luma-vid-${Date.now()}`,
      url: 'https://example.com/luma-video.mp4',
      status: 'pending'
    };
  }
}
