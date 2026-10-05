import type { VideoProjectRequest, VideoRoute } from "./contracts";

const HYPERFRAMES_FIRST = new Set<VideoProjectRequest["sourceKind"]>([
  "product-launch",
  "pull-request",
  "faceless-explainer",
  "motion-graphic",
]);

const REMOTION_FIRST = new Set<VideoProjectRequest["sourceKind"]>([
  "lesson",
  "tutorial",
  "long-form",
]);

export function routeVideoProject(input: VideoProjectRequest): VideoRoute {
  const renderTarget = input.renderTarget ?? "jules";

  if (input.sourceKind === "raw-footage" || input.hasRawFootage) {
    if (!input.needsMotionGraphics && !input.needsComplexReactComposition && !input.preferredEngine) {
      return {
        baseEditor: "ffmpeg",
        compositionEngine: null,
        renderTarget,
        reason: "Raw footage stays on the deterministic FFmpeg edit path when no generated motion layer is required.",
      };
    }

    const compositionEngine =
      input.preferredEngine ??
      (input.needsComplexReactComposition ? "remotion" : "hyperframes");

    return {
      baseEditor: "ffmpeg",
      compositionEngine,
      renderTarget,
      reason:
        compositionEngine === "remotion"
          ? "Raw footage uses FFmpeg for cuts and Remotion only for the complex generated overlay/composition layer."
          : "Raw footage uses FFmpeg for cuts and HyperFrames for lightweight agent-first motion overlays.",
    };
  }

  if (input.preferredEngine) {
    return {
      baseEditor: null,
      compositionEngine: input.preferredEngine,
      renderTarget,
      reason: "An explicit engine preference was supplied for a generated composition.",
    };
  }

  if (input.needsComplexReactComposition || REMOTION_FIRST.has(input.sourceKind)) {
    return {
      baseEditor: null,
      compositionEngine: "remotion",
      renderTarget,
      reason: "The project benefits from a React composition model or belongs to a long-form structured workflow.",
    };
  }

  if (HYPERFRAMES_FIRST.has(input.sourceKind)) {
    return {
      baseEditor: null,
      compositionEngine: "hyperframes",
      renderTarget,
      reason: "The project matches an agent-first HyperFrames workflow.",
    };
  }

  const longEnoughForRemotion = (input.targetDurationSeconds ?? 0) > 90;
  return {
    baseEditor: null,
    compositionEngine: longEnoughForRemotion ? "remotion" : "hyperframes",
    renderTarget,
    reason: longEnoughForRemotion
      ? "Generic generated video over 90 seconds routes to Remotion for maintainable long-form composition."
      : "Generic short generated video routes to HyperFrames for faster agent-first composition.",
  };
}
