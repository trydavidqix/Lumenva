---
name: video-agent
description: Route and execute Lumenva video editing/generation work with progressive disclosure. Use for raw footage, product/PR videos, explainers, lessons, motion graphics, captions and render planning. Route first; load only the engine skills required by that route.
---

# Lumenva Video Agent

## Permanent rule

For any video editing or video generation task in this repository, start here.
Do not preload all Remotion and HyperFrames skills.

1. Inspect the requested video shape.
2. Use the deterministic policy in
   `apps/crm/lib/content-os/video-agent/router.ts`.
3. Load only the skill names returned by
   `apps/crm/lib/content-os/video-agent/skills.ts`.
4. Keep Content OS as the source of truth.
5. Keep final render execution separate from the authoring engine.

## Raw footage

Use the video-use architecture as the editing model:

- transcript-first reasoning;
- on-demand visual inspection instead of frame dumping;
- EDL as the cut contract;
- FFmpeg for deterministic cuts/audio/concat;
- generated overlay slots in parallel;
- preview -> self-eval -> critic -> finite fix loop;
- persist decisions/evidence.

Do not copy upstream helper code implicitly. If code is vendored, pin the source
commit and preserve its license.

## HyperFrames route

Load `hyperframes-core` and `hyperframes-cli`, then exactly one workflow
skill when possible. Add caption/media skills only when the task needs them.

Use HyperFrames for short agent-first motion, product launch, PR-to-video,
faceless explainer and lightweight motion graphics.

## Remotion route

Load `remotion-best-practices` and `remotion-render`. Load
`remotion-captions` only when captions are required.

Use Remotion for complex React composition, reusable component systems,
long-form lessons/tutorials, or an explicit Remotion request.

## Render

The engine may be authored locally while the final MP4 is rendered on Jules or
Codex Cloud. Never assume the user's local machine is the final renderer.

Cloud render is successful only when the MP4 artifact is produced, validated
and copied into the canonical Content OS asset flow.

## Quality gate

Before final delivery:

- inspect representative rendered frames and cut boundaries;
- verify duration, resolution, FPS, audio and caption alignment;
- run one independent critic pass for publishable content;
- fix and re-check, with a maximum of three automatic self-correction passes.
