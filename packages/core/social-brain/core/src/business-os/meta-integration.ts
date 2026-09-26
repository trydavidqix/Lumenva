import { UnifiedIntegration } from './integration-registry';

export interface MetaConfig {
  accessToken: string;
  phoneNumberId: string;
}

export interface MetaState {
  lastSyncTime: string;
}

export class MetaIntegration implements UnifiedIntegration<MetaConfig, MetaState> {
  private config: MetaConfig | null = null;

  async connect(config: MetaConfig): Promise<boolean> {
    this.config = config;
    // Mock connection
    console.log('Connecting to Meta WhatsApp...');
    return true;
  }

  async sync(state: MetaState): Promise<void> {
    if (!this.config) throw new Error('Not connected');
    // Mock sync
    console.log(`Syncing Meta data since ${state.lastSyncTime}`);
  }

  async normalize(rawPayload: any): Promise<any> {
    // Mock normalization
    return {
      id: rawPayload.id || 'unknown',
      source: 'meta-whatsapp',
      data: rawPayload,
    };
  }

  async act(action: string, payload: any): Promise<any> {
    if (!this.config) throw new Error('Not connected');
    
    const token = process.env.META_ACCESS_TOKEN || this.config.accessToken;
    const url = `https://graph.facebook.com/v19.0/${this.config.phoneNumberId}/${action}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`Meta API error: ${response.statusText}`);
    }
    
    return response.json();
  }
}
