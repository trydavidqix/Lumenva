export type ModelProviderId = "mock" | "gemini" | "groq";

export interface ModelCompletionRequest {
  sessionId: string;
  prompt: string;
  maxTokens?: number;
}

export interface ModelCompletion {
  provider: ModelProviderId;
  model: string;
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ModelProvider {
  readonly id: ModelProviderId;
  complete(request: ModelCompletionRequest): Promise<ModelCompletion>;
}

export class ModelProviderError extends Error {
  constructor(
    public readonly code: "provider_disabled",
    message: string,
  ) {
    super(message);
    this.name = "ModelProviderError";
  }
}

export class MockModelProvider implements ModelProvider {
  readonly id = "mock" as const;

  constructor(
    private readonly response = "mock-response",
    private readonly model = "mock-model",
  ) {}

  async complete(request: ModelCompletionRequest): Promise<ModelCompletion> {
    return {
      provider: this.id,
      model: this.model,
      text: this.response,
      inputTokens: request.prompt.length,
      outputTokens: this.response.length,
    };
  }
}

class DisabledModelProvider implements ModelProvider {
  constructor(
    readonly id: "gemini" | "groq",
    private readonly _model: string,
  ) {}

  async complete(_request: ModelCompletionRequest): Promise<ModelCompletion> {
    throw new ModelProviderError(
      "provider_disabled",
      `model_provider_disabled:${this.id}`,
    );
  }
}

export function createGeminiAdapter(): ModelProvider {
  return new DisabledModelProvider("gemini", "gemini");
}

export function createGroqAdapter(): ModelProvider {
  return new DisabledModelProvider("groq", "groq");
}

export function createSandboxProviderRegistry(): ReadonlyMap<ModelProviderId, ModelProvider> {
  return new Map<ModelProviderId, ModelProvider>([
    ["mock", new MockModelProvider()],
    ["gemini", createGeminiAdapter()],
    ["groq", createGroqAdapter()],
  ]);
}
