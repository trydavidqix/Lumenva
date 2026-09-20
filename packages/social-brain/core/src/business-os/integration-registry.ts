export interface UnifiedIntegration<TConfig = any, TState = any> {
  connect(config: TConfig): Promise<boolean>;
  sync(state: TState): Promise<void>;
  normalize(rawPayload: any): Promise<any>;
  act(action: string, payload: any): Promise<any>;
}
