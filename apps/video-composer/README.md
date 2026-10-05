# Content OS Video Composer

Private server-to-server boundary for video composition and rendering.

The CRM owns the creative job, tenant, approvals, evidence and canonical asset.
This service is only an execution worker. It must never become the source of
truth for Content OS state.

## Runtime role

The Lumenva Video Agent lives in the CRM control plane and selects the editing
path before this worker is invoked:

- raw footage -> FFmpeg base edit, with optional HyperFrames/Remotion overlays;
- short agent-first generated motion -> HyperFrames;
- complex React or long-form composition -> Remotion.

Jules and Codex Cloud are remote render execution targets. They are not editing
engines and they do not own canonical project state.

See `docs/architecture/VIDEO_AGENT_RUNTIME.md`.

## API contract

Only these operations are part of the V1 contract:

```text
POST /v1/jobs
GET  /v1/jobs/{id}
POST /v1/jobs/{id}/cancel
GET  /health
```

`POST /v1/jobs` receives a structured script/project spec, asset references and
output format. Responses contain a provider job identifier, state and (when
ready) an output descriptor.

Provider configuration is not writable through this API. The endpoint is
private and must require a server-to-server bearer secret; the secret must
never be placed in a query string or logs.

The CRM must copy completed output into its own Storage bucket before exposing
an asset to a browser. Worker URLs and cloud-session artifact URLs are temporary
implementation details, not canonical asset identifiers.

## Engine boundary

The worker may host adapters for:

- FFmpeg;
- HyperFrames;
- Remotion.

Domain code must depend on the Video Composer boundary, not import those engines
directly. Engine selection belongs to the Video Agent router in the CRM.

The worker must accept an explicit engine/render plan from the control plane;
it must not silently re-route a job to another engine.

## Reproducibility

A final render must be reproducible from:

1. the approved project/edit spec;
2. declared source assets;
3. pinned engine/tool versions;
4. the stored brand/style inputs.

No required project state may exist only inside an ephemeral Jules or Codex
Cloud session.

## Upstream code and licenses

The current architecture was researched against video-use, HyperFrames and
Remotion, but this repository does not copy their implementation code in the
initial routing slice.

If substantial portions of an upstream project are copied into this service,
pin the source commit and preserve every required copyright/license notice in
the copied files and distribution.

The existing MoneyPrinterTurbo rule still applies: if substantial portions are
copied, preserve its copyright and MIT license notices and keep the extraction
limited to the composition path required by this service.
