import type { VideoProjectRequest, VideoRoute } from "./contracts";

export type VideoSkillName =
  | "video-agent"
  | "hyperframes-core"
  | "hyperframes-cli"
  | "product-launch-video"
  | "pr-to-video"
  | "faceless-explainer"
  | "embedded-captions"
  | "general-video"
  | "remotion-best-practices"
  | "remotion-render"
  | "remotion-captions";

const hyperframesWorkflowBySource: Partial<Record<VideoProjectRequest["sourceKind"], VideoSkillName>> = {
  "product-launch": "product-launch-video",
  "pull-request": "pr-to-video",
  "faceless-explainer": "faceless-explainer",
};

export function skillsForVideoRoute(
  request: VideoProjectRequest,
  route: VideoRoute,
): VideoSkillName[] {
  const skills: VideoSkillName[] = ["video-agent"];

  if (route.compositionEngine === "hyperframes") {
    skills.push("hyperframes-core", "hyperframes-cli");
    skills.push(hyperframesWorkflowBySource[request.sourceKind] ?? "general-video");
    if (request.needsCaptions) skills.push("embedded-captions");
  }

  if (route.compositionEngine === "remotion") {
    skills.push("remotion-best-practices", "remotion-render");
    if (request.needsCaptions) skills.push("remotion-captions");
  }

  return [...new Set(skills)];
}
