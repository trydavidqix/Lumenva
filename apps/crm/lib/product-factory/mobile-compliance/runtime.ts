import type { MobilePlatform, MobileProjectSnapshot, RuntimeReviewReport } from "./contracts";

export interface RuntimeReviewInput {
  organizationId: string;
  projectId: string;
  buildRef: string;
  artifactRef: string;
  artifactHash: string;
  platform: MobilePlatform;
  snapshot: MobileProjectSnapshot;
}

export interface RuntimeReviewAdapter {
  review(input: RuntimeReviewInput): Promise<RuntimeReviewReport>;
}

export async function runRuntimeReview(input: RuntimeReviewInput, adapter?: RuntimeReviewAdapter): Promise<RuntimeReviewReport> {
  if (!adapter) {
    return {
      runtimeReviewId: `runtime-not-run:${input.artifactHash}`,
      platform: input.platform,
      status: "NOT_RUN",
      evidenceRefs: [],
      steps: [],
      createdAt: new Date().toISOString(),
    };
  }
  const report = await adapter.review(input);
  if (report.platform !== input.platform) throw new Error("runtime review platform mismatch");
  return report;
}
