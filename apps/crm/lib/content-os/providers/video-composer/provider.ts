import { checkProviderHealth } from "@/lib/content-os/providers/health";
import type { ProviderHealth, ProviderJobRef, ProviderJobState } from "@/lib/content-os/providers/types";
import type { VideoComposer, VideoComposeInput } from "@/lib/content-os/providers/video-composer";
import type { VideoComposerClient } from "./client";

export class MptVideoComposer implements VideoComposer {
  readonly provider: string = "mpt-composer";
  constructor(private readonly client: VideoComposerClient) {}
  async compose(input: VideoComposeInput): Promise<ProviderJobRef> {
    const job = await this.client.create({ ...input });
    return this.map(job);
  }
  async status(providerJobId: string): Promise<ProviderJobRef> { return this.map(await this.client.status(providerJobId)); }
  async cancel(providerJobId: string): Promise<void> { await this.client.cancel(providerJobId); }
  health(): Promise<ProviderHealth> { return checkProviderHealth(() => this.client.health()); }
  private map(job: { providerJobId: string; state: string }): ProviderJobRef { return { provider: this.provider, providerJobId: job.providerJobId, state: normalizeState(job.state) }; }
}

/** Same contract, reserved for the future first-party composer implementation. */
export class LumenvaVideoComposer extends MptVideoComposer {
  readonly provider = "lumenva-composer";
}

function normalizeState(value: string): ProviderJobState {
  const state = value.toLowerCase().replace(/[- ]/g, "_");
  if (["queued", "pending", "waiting"].includes(state)) return "queued";
  if (["running", "processing", "rendering"].includes(state)) return "running";
  if (["success", "succeeded", "completed", "done"].includes(state)) return "succeeded";
  if (["failed", "error"].includes(state)) return "failed";
  if (["cancelled", "canceled"].includes(state)) return "cancelled";
  throw new Error("Video Composer returned an unknown job state");
}
