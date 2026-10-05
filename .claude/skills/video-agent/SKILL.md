---
name: video-agent
description: Route and execute Lumenva video editing/generation work with progressive disclosure. Use for raw footage, product/PR videos, explainers, lessons, motion graphics, captions and render planning. Route first; load only the engine skills required by that route.
---

# Lumenva Video Agent

Use `apps/crm/lib/content-os/video-agent/router.ts` before selecting a video
engine. Load only the skills returned by
`apps/crm/lib/content-os/video-agent/skills.ts`.

- Raw footage: transcript/EDL -> FFmpeg base edit -> optional generated overlays.
- HyperFrames: agent-first short motion and dedicated workflows.
- Remotion: complex React composition and long-form/reusable video.
- Jules/Codex Cloud: render execution targets, never source of truth.

Never preload every video skill. Preserve Content OS ownership of approvals,
evidence and the canonical output asset.

Before final delivery, inspect rendered frames/cut boundaries, verify media
properties and run an independent critic pass for publishable content. Limit
automatic fix/re-render loops to three passes.
