import type { CreativeProvider } from "@/lib/content-os/providers/creative";
import type { DistributionProvider } from "@/lib/content-os/providers/distribution";
import type { IntelligenceProvider } from "@/lib/content-os/providers/intelligence";
import type { VideoComposer } from "@/lib/content-os/providers/video-composer";

export class ContentOsProviderRegistry {
  private readonly intelligence = new Map<string, IntelligenceProvider>();
  private readonly creative = new Map<string, CreativeProvider>();
  private readonly composers = new Map<string, VideoComposer>();
  private readonly distribution = new Map<string, DistributionProvider>();

  registerIntelligence(provider: IntelligenceProvider): void {
    this.intelligence.set(provider.provider, provider);
  }

  registerCreative(provider: CreativeProvider): void {
    this.creative.set(provider.provider, provider);
  }

  registerComposer(provider: VideoComposer): void {
    this.composers.set(provider.provider, provider);
  }

  registerDistribution(provider: DistributionProvider): void {
    this.distribution.set(provider.provider, provider);
  }

  getIntelligence(name: string): IntelligenceProvider {
    return this.resolve(this.intelligence, name, "intelligence");
  }

  getCreative(name: string): CreativeProvider {
    return this.resolve(this.creative, name, "creative");
  }

  getComposer(name: string): VideoComposer {
    return this.resolve(this.composers, name, "video composer");
  }

  getDistribution(name: string): DistributionProvider {
    return this.resolve(this.distribution, name, "distribution");
  }

  private resolve<T>(providers: Map<string, T>, name: string, kind: string): T {
    const provider = providers.get(name);
    if (!provider) {
      throw new Error(`Unknown ${kind} provider: ${name}`);
    }
    return provider;
  }
}
