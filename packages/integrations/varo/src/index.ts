export interface VaroImageGenerationOptions {
  prompt: string;
  width?: number;
  height?: number;
}

export interface VaroImageGenerationResult {
  id: string;
  url: string;
  status: 'pending' | 'completed' | 'failed';
}

export class VaroClient {
  constructor(private readonly apiKey: string) {}

  async generateImage(options: VaroImageGenerationOptions): Promise<VaroImageGenerationResult> {
    return {
      id: `varo-img-${Date.now()}`,
      url: 'https://example.com/varo-image.png',
      status: 'pending'
    };
  }
}
