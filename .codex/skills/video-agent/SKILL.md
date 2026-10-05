---
name: video-agent
description: Route and execute Lumenva video editing/generation work with progressive disclosure. Use for raw footage, product/PR videos, explainers, lessons, motion graphics, captions and render planning. Route first; load only the engine skills required by that route.
---

# Lumenva Video Agent

Read `apps/crm/lib/content-os/video-agent/router.ts` and
`apps/crm/lib/content-os/video-agent/skills.ts` before video work.

Rules:

- FFmpeg is the base editor for raw footage.
- HyperFrames is the default for short agent-first generated motion/workflows.
- Remotion is preferred for complex React and long-form composition.
- Load only the selected engine's required skills.
- Jules/Codex Cloud are final-render targets, not authoring engines.
- Content OS owns job state, approval, evidence and the canonical asset.
- Validate preview/media properties and run a critic pass before final output.
- Cap automatic self-correction at three passes.
