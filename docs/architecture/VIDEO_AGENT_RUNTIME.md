# Lumenva Video Agent Runtime

Status: implementation branch, 2026-10-05.

## Decision

The Lumenva Video Agent is part of the Lumenva Business OS / Content OS. It is
not a separate product and it does not make `apps/video-composer` the source of
truth.

The CRM remains the control plane and owner of the creative job, tenant,
approval, evidence and canonical output asset. `apps/video-composer` remains a
private rendering boundary.

The runtime adopts the strongest ideas found in the current agent-video
community without coupling the product to one renderer:

- **video-use architecture** for raw-footage editing: transcript-first reasoning,
  EDL, FFmpeg cuts, on-demand visual inspection, self-evaluation and persisted
  project memory.
- **HyperFrames** for fast agent-first motion and dedicated workflows.
- **Remotion** for React-heavy, reusable and long-form compositions.
- **FFmpeg** as the deterministic cut/audio/concat/encode backbone.
- **Jules / Codex Cloud** as remote render execution targets; they are execution
  environments, not authoring engines.

## Upstream evidence pins

Research was performed against these exact upstream heads:

| Upstream | Pin | Role |
|---|---|---|
| `browser-use/video-use` | `b877063835e6ea6e457124da7e28a0ae26691dc3` | Editing architecture reference |
| `heygen-com/hyperframes` | `6791ea580c811fe3f1a532a2ced4bbed29008ee7` (v0.8.130) | Agent-first motion/workflows |
| `remotion-dev/remotion` | `45c1caeca5a57fc152774bbd2e3a777772930aa8` | React video + official agent skills |

No third-party implementation code is copied in this change. If code from an
upstream is vendored later, preserve the applicable license notice and pin the
source commit in the vendored directory.

## Runtime shape

```text
Maestri / Content OS
        |
        v
Lumenva Video Agent
        |
        +-- raw footage ----------------------+
        |                                     |
        |                              transcript/EDL
        |                                     |
        |                                  FFmpeg
        |                                     |
        |                     +---------------+---------------+
        |                     |                               |
        |              HyperFrames overlay             Remotion overlay
        |                     |                               |
        +-- generated --------+-------------------------------+
                              |
                    deterministic router
                              |
                  visual + technical critic
                              |
                     preview / approval
                              |
                   Jules or Codex Cloud
                              |
                          final.mp4
                              |
                  Content OS canonical asset
```

## Routing policy

1. Raw footage always keeps FFmpeg as the base editor.
2. HyperFrames is the default generated-motion layer for short/agent-first work:
   product launches, PR demos, faceless explainers and lightweight motion.
3. Remotion is preferred for React-heavy composition, reusable component systems
   and long-form lessons/tutorials.
4. An explicit engine preference may override the generated-composition choice.
5. Remote render target is separate from the editing engine.
6. Do not load both engine skill trees by default.

The executable routing contract lives in
`apps/crm/lib/content-os/video-agent/{contracts,router,skills}.ts`.

## Progressive skill disclosure

The Video Agent skill is always the entrypoint. It selects the route first and
only then loads the minimum external knowledge needed.

HyperFrames route:

```text
video-agent
  -> hyperframes-core
  -> hyperframes-cli
  -> exactly one workflow skill
  -> embedded-captions only when needed
```

Remotion route:

```text
video-agent
  -> remotion-best-practices
  -> remotion-render
  -> remotion-captions only when needed
```

This intentionally avoids installing/loading every video skill into every
agent context.

## Raw-footage editing contract

The Lumenva implementation follows the proven architecture, not the exact
video-use source code:

```text
inventory
 -> word-level transcript
 -> packed transcript
 -> strategy
 -> user/approval gate
 -> EDL
 -> FFmpeg cut
 -> generated overlay slots in parallel
 -> preview
 -> self-eval
 -> critic
 -> final render
 -> persist evidence/memory
```

Canonical EDL primitives are defined in `contracts.ts`. Future implementation
must preserve these production invariants:

- cuts snap to word boundaries when transcript data is available;
- captions are placed on the output timeline, not original-source timestamps;
- audio boundaries receive a short anti-pop fade;
- generated overlays are isolated by slot;
- subtitles are composed after visual overlays;
- preview is verified before final render;
- self-correction has a finite retry cap;
- source footage is immutable.

## Render execution

`jules` and `codex-cloud` are execution targets only. The project produced by
Remotion/HyperFrames/FFmpeg must be reproducible from repository state plus
declared assets. No canonical state may exist only inside an ephemeral cloud
session.

Final render flow:

```text
approved VideoProjectSpec + assets
 -> repository/workspace
 -> cloud runner
 -> engine CLI
 -> final.mp4
 -> copy into Content OS storage
 -> evidence + asset record
```

A failed cloud render must leave the creative job retryable; it must not be
reported as success because an ephemeral worker disappeared.

## What is deliberately not implemented yet

This first slice establishes the deterministic router, minimal skill loading
contract and architecture boundary. It does not yet:

- call Jules or Codex Cloud APIs;
- vendor video-use helpers;
- add a second source of truth outside Content OS;
- expose a browser route directly to a renderer;
- install every HyperFrames/Remotion skill globally;
- replace the existing `VideoComposer` provider contract.

Those are later slices behind tests and provider boundaries.
