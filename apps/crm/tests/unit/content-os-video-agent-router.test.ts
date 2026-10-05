import { describe, expect, it } from "vitest";
import { routeVideoProject } from "@/lib/content-os/video-agent/router";
import { skillsForVideoRoute } from "@/lib/content-os/video-agent/skills";

describe("Content OS video agent router", () => {
  it("keeps plain raw-footage editing on FFmpeg without loading a composition engine", () => {
    const request = {
      sourceKind: "raw-footage",
      format: "9:16",
      hasRawFootage: true,
    } as const;

    const route = routeVideoProject(request);

    expect(route).toMatchObject({
      baseEditor: "ffmpeg",
      compositionEngine: null,
      renderTarget: "jules",
    });
    expect(skillsForVideoRoute(request, route)).toEqual(["video-agent"]);
  });

  it("uses HyperFrames only as the overlay engine for agent-first raw-footage motion", () => {
    const request = {
      sourceKind: "raw-footage",
      format: "16:9",
      hasRawFootage: true,
      needsMotionGraphics: true,
      needsCaptions: true,
    } as const;

    const route = routeVideoProject(request);

    expect(route.compositionEngine).toBe("hyperframes");
    expect(skillsForVideoRoute(request, route)).toEqual([
      "video-agent",
      "hyperframes-core",
      "hyperframes-cli",
      "general-video",
      "embedded-captions",
    ]);
  });

  it("routes a pull-request demo to the dedicated HyperFrames workflow", () => {
    const request = {
      sourceKind: "pull-request",
      format: "16:9",
      targetDurationSeconds: 25,
    } as const;

    const route = routeVideoProject(request);

    expect(route.compositionEngine).toBe("hyperframes");
    expect(skillsForVideoRoute(request, route)).toContain("pr-to-video");
  });

  it("routes long-form lessons to Remotion and loads only the needed Remotion skills", () => {
    const request = {
      sourceKind: "lesson",
      format: "16:9",
      targetDurationSeconds: 600,
      needsCaptions: true,
    } as const;

    const route = routeVideoProject(request);

    expect(route.compositionEngine).toBe("remotion");
    expect(skillsForVideoRoute(request, route)).toEqual([
      "video-agent",
      "remotion-best-practices",
      "remotion-render",
      "remotion-captions",
    ]);
  });

  it("honors Codex Cloud as the explicit render target without changing the editing engine", () => {
    const request = {
      sourceKind: "product-launch",
      format: "9:16",
      renderTarget: "codex-cloud",
    } as const;

    expect(routeVideoProject(request)).toMatchObject({
      compositionEngine: "hyperframes",
      renderTarget: "codex-cloud",
    });
  });

  it("allows an explicit Remotion override for generated compositions", () => {
    const request = {
      sourceKind: "motion-graphic",
      format: "1:1",
      preferredEngine: "remotion",
    } as const;

    expect(routeVideoProject(request).compositionEngine).toBe("remotion");
  });
});
