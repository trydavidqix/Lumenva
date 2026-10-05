export const videoSourceKinds = [
  "raw-footage",
  "product-launch",
  "pull-request",
  "faceless-explainer",
  "motion-graphic",
  "lesson",
  "tutorial",
  "long-form",
  "generic",
] as const;

export type VideoSourceKind = (typeof videoSourceKinds)[number];

export const videoEngines = ["ffmpeg", "hyperframes", "remotion"] as const;
export type VideoEngine = (typeof videoEngines)[number];

export const videoRenderTargets = ["jules", "codex-cloud"] as const;
export type VideoRenderTarget = (typeof videoRenderTargets)[number];

export type VideoFormat = "9:16" | "1:1" | "16:9";

export type VideoProjectRequest = {
  sourceKind: VideoSourceKind;
  format: VideoFormat;
  targetDurationSeconds?: number;
  hasRawFootage?: boolean;
  needsMotionGraphics?: boolean;
  needsComplexReactComposition?: boolean;
  needsCaptions?: boolean;
  preferredEngine?: Exclude<VideoEngine, "ffmpeg">;
  renderTarget?: VideoRenderTarget;
};

export type VideoRoute = {
  baseEditor: "ffmpeg" | null;
  compositionEngine: "hyperframes" | "remotion" | null;
  renderTarget: VideoRenderTarget;
  reason: string;
};

export type VideoCutSegment = {
  sourceAssetId: string;
  startMs: number;
  endMs: number;
  beat?: string;
  reason?: string;
};

export type VideoOverlaySlot = {
  id: string;
  startMs: number;
  endMs: number;
  brief: string;
  engine?: "hyperframes" | "remotion";
};

export type VideoEditDecisionList = {
  version: 1;
  segments: VideoCutSegment[];
  overlays: VideoOverlaySlot[];
};

export type VideoQaResult = {
  passed: boolean;
  pass: number;
  issues: Array<{
    code: string;
    severity: "warning" | "error";
    atMs?: number;
    message: string;
  }>;
};
