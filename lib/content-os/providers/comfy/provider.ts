import { checkProviderHealth } from "@/lib/content-os/providers/health";
import type { CreativeGenerateInput, CreativeProvider } from "@/lib/content-os/providers/creative";
import type { ProviderHealth, ProviderJobRef, ProviderJobState } from "@/lib/content-os/providers/types";
import type { ComfyClient } from "./client";

export type ComfyWorkflowResolver = (workflow: string, parameters: Record<string, unknown>) => Record<string, unknown>;

export class ComfyCreativeProvider implements CreativeProvider {
  readonly provider = "comfy";
  constructor(private readonly client: ComfyClient, private readonly resolveWorkflow: ComfyWorkflowResolver) {}

  async generate(input: CreativeGenerateInput): Promise<ProviderJobRef> {
    const prompt = this.resolveWorkflow(input.workflow, input.parameters);
    const result = await this.client.prompt({ prompt, client_id: input.idempotencyKey });
    return { provider: this.provider, providerJobId: result.providerJobId, state: normalizeState(result.state ?? "queued") };
  }

  async status(providerJobId: string): Promise<ProviderJobRef> {
    const result = await this.client.history(providerJobId);
    return { provider: this.provider, providerJobId: result.providerJobId, state: normalizeState(result.state ?? "queued") };
  }

  async cancel(providerJobId: string): Promise<void> { await this.client.interrupt(providerJobId); }
  health(): Promise<ProviderHealth> { return checkProviderHealth(() => this.client.health()); }
}

function normalizeState(value: string): ProviderJobState {
  const state = value.toLowerCase().replace(/[- ]/g, "_");
  if (["queued", "pending", "not_started"].includes(state)) return "queued";
  if (["running", "processing", "executing"].includes(state)) return "running";
  if (["success", "succeeded", "completed", "done"].includes(state)) return "succeeded";
  if (["failed", "error", "execution_error"].includes(state)) return "failed";
  if (["cancelled", "canceled"].includes(state)) return "cancelled";
  throw new Error("ComfyUI returned an unknown job state");
}
