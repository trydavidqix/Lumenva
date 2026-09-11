# IMPROVE-3 — EXECUTION PLANE + INFRASTRUCTURE + DEV STRUCTURE + DEPLOY/ROLLBACK

> Scope owner: Execution/Infra. Companion to the Master Blueprint (Lumenva Business OS).
> This document only ADDS concreteness to blueprint sections 4.62, 11, 13 (host/infra part),
> 16, 22, 23, 28. It does not shrink or question anything. Every blueprint gap in scope is
> turned into a decision here.

Anchored environment facts (verified 2026-09-10 on the owner Mac):

| Thing | Value | Role |
|---|---|---|
| Production VPS | `lumenva-crm`, Hetzner ID `162985793`, ~3.7 GB RAM, SSH alias `vps` / `lumenva-vps` (2.29.8.225) | RELIABILITY ONLY. Never a build/test/render target. Automation may never create, resize, reboot, or delete this ID. |
| Burst cloud runner | `~/ci-cloud/run-gate.sh`, Hetzner CX53, proven gate runner | On-demand heavy compute. Instances named `lumenva-crm-gate-<epoch>`. |
| Home Linux | SSH alias `worker` (Tailscale 100.116.144.121) / `worker-lan` (192.168.1.78) | Primary heavy-execution host. Runs BrowserMesh node, Chrome, Playwright, build, FFmpeg, Remotion, Codex CLI. Repo clone at `~/src/Lumenva`, RW deploy key `~/.ssh/lumenva_rw` (alias `github-lumenva-rw`). |
| Mac | Maestri + Chrome + SSH only | No persistent worker. Emergency-only BrowserMesh node, opt-in. |
| Codex | local `codex app-server` child process, model `gpt-5.6-luna medium` | NOT cloud. Same Mac silicon. Treated as a capped local adapter. |
| Git remote reality | Working branches (`mvp/crm-completo`, `f1/*`, etc.) are NOT pushed to GitHub. `origin` only has `main`, `blog`. | Fresh cloud boxes get source via `git bundle`, never `git clone` of a work branch. |
| Cost ceiling | €15 / month hard cap, `~/ci-cloud/spend.log` | Cost guard aborts burst creation past ceiling. |
| DB stack | Supabase / Postgres / Auth / Storage + `event_log` + workers, Next.js backend | Canonical. Migrations forward-only. Schema lives in migration + `baseline.sql` + manifest. |
| CI | GitHub Actions OFF for Lumenva prod path (CLAUDE.md constitutional) | Deploy is a scripted runbook, not a pipeline. |

---

## PART A — BROWSERMESH (blueprint 4.62)

BrowserMesh is the Execution Plane. It is a **node daemon** (one per physical host that can do
work) plus a set of **adapters** (one per kind of executable capability). The CRM/Job Engine never
runs a process itself; it hands a job to a BrowserMesh node and consumes the node's event stream
and evidence bundle.

### A.1 Component breakdown

```
runtimes/browsermesh/
├── core/                         # host-agnostic domain, zero I/O
│   ├── src/
│   │   ├── contract.ts           # start/send/stream/status/cancel/usage/collectEvidence types
│   │   ├── job.ts                # BrowserMeshJob, JobSpec, JobResult, JobClass
│   │   ├── lease.ts              # Lease, LeaseState, renewal math, TTL constants
│   │   ├── capability.ts         # CapabilityDescriptor, CapabilityGrant, CapabilityRegistry iface
│   │   ├── evidence.ts           # EvidenceItem, EvidenceBundle, hashing, manifest
│   │   ├── events.ts             # BrowserMeshEvent union (see A.4)
│   │   ├── errors.ts             # normalizeError(): timeout|rate_limit|oom|sandbox_denied|adapter_crash|cancelled|policy_denied
│   │   └── usage.ts              # UsageMeter: wall_ms, cpu_ms, rss_peak_mb, tokens_in/out, egress_bytes, cost_estimate_eur
│   └── package.json              # name: @lumenva/browsermesh-core
│
├── daemon/                       # the node process (one per host)
│   ├── src/
│   │   ├── main.ts               # bootstrap: read node config, register node, open transport
│   │   ├── node-identity.ts      # node_id (stable, per host), host_class (vps|linux|mac|cloud), labels
│   │   ├── registration.ts      # POST /nodes/register + capability advertisement
│   │   ├── heartbeat.ts         # 10s heartbeat loop (A.3)
│   │   ├── claim-loop.ts         # long-poll / LISTEN for claimable jobs, atomic claim (A.3)
│   │   ├── lease-manager.ts      # renew lease every 15s, TTL 45s, self-abort on 2 missed renews
│   │   ├── runner-supervisor.ts  # spawn adapter child, watch exit, enforce timeout-manager
│   │   ├── process-manager.ts    # PID tree tracking, cgroup/rlimit application, SIGTERM→SIGKILL ladder
│   │   ├── timeout-manager.ts    # per-job soft (warn) + hard (kill) deadlines
│   │   ├── sandbox/              # see A.5
│   │   ├── evidence-uploader.ts  # stream evidence chunks to object store, finalize manifest
│   │   ├── cancel-listener.ts    # receives cancel signal, forwards to runner-supervisor
│   │   └── metrics-exporter.ts   # push host_metrics rows (A.9 / blueprint 13)
│   └── package.json              # name: @lumenva/browsermesh-daemon
│
├── adapters/
│   ├── _base/src/adapter.ts      # Adapter interface: prepare(), run(), onEvent(), teardown(), describeCapability()
│   ├── claude/                   # A.6
│   ├── codex/                    # A.7
│   ├── shell/                    # A.8
│   ├── git/                     # A.9
│   ├── ffmpeg/                   # A.10
│   ├── remotion/                 # thin wrapper on shell+node, renders Remotion compositions
│   ├── browser/                  # Playwright/Chrome driver (Steel-first, local Chrome fallback)
│   ├── hermes/                   # learning-loop batch runner
│   └── maestri/                  # bridges to Maestri canvas agents via maestri skill CLI
│
├── sandbox/                      # reusable sandbox primitives (imported by daemon/sandbox)
│   ├── src/
│   │   ├── fs-jail.ts            # bind-mount / overlayfs workspace, path allowlist enforcement
│   │   ├── net-filter.ts        # nftables/pf egress allowlist per job, DNS pinning
│   │   ├── tool-allowlist.ts    # exec allowlist: which binaries an adapter child may spawn
│   │   ├── resource-limits.ts   # cgroup v2 (Linux) / ulimit (Mac) cpu, rss, pids, nofile
│   │   └── profiles/            # capability grant JSON per adapter (A.5)
│
├── transport/                   # how CRM/Job Engine <-> node talk (A.2)
│   ├── src/
│   │   ├── server.ts            # runs INSIDE apps/crm as route handlers + a queue table
│   │   ├── client.ts            # used by daemon
│   │   ├── queue-table.ts       # browsermesh_jobs / browsermesh_leases / browsermesh_events SQL access
│   │   ├── ws-gateway.ts        # optional WS upgrade for low-latency stream() fan-out
│   │   └── auth.ts             # node bearer token (per node_id), rotation
│
├── evidence/
│   ├── src/
│   │   ├── collector.ts         # collectEvidence(): gather stdout/stderr, artifacts, diffs, screenshots
│   │   ├── store.ts            # object store adapter (Supabase Storage bucket `evidence`, S3-compatible)
│   │   ├── manifest.ts         # EvidenceManifest schema + sha256 tree
│   │   └── retention.ts        # tag bundles with retention_class, TTL sweeper hook
│
└── security/
    ├── src/
    │   ├── node-token.ts        # mint/verify per-node tokens, scope = node_id + host_class
    │   ├── grant-resolver.ts   # merges AgentDefinition capability requirements + adapter profile + job policy -> effective CapabilityGrant
    │   ├── secret-broker.ts     # fetch just-in-time secrets from Infisical, inject as env into child only, never log
    │   └── scrubber.ts         # redact secret patterns from stdout/stderr/evidence before upload
```

Package names: `@lumenva/browsermesh-core`, `-daemon`, `-transport`, `-evidence`, `-security`,
`-adapter-<name>`. All TypeScript, Node 20+, ESM, built with the repo's existing tsup/tsconfig
base.

### A.2 Transport — how the CRM/Job Engine talks to a BrowserMesh node

**Decision: queue table as the system of record + HTTP for control + optional WS for stream fan-out.**
No node ever exposes an inbound socket. Nodes are outbound-only (works behind home NAT and
Tailscale without port-forwarding).

Three Postgres tables (in the Lumenva control DB, `browsermesh` schema):

```sql
-- browsermesh.nodes
node_id text primary key, host_class text, labels jsonb, capabilities jsonb,
token_hash text, last_heartbeat_at timestamptz, status text,       -- online|draining|offline
cpu_count int, mem_total_mb int, created_at timestamptz;

-- browsermesh.jobs
job_id uuid primary key, organization_id uuid, run_id uuid, session_id uuid,
adapter text, job_class text,                                       -- TINY|LIGHT|NORMAL|HEAVY|EXCLUSIVE
spec jsonb, capability_grant jsonb, priority int, deadline_at timestamptz,
required_labels jsonb,                                              -- e.g. {"host_class":["linux","cloud"]}
status text,          -- queued|claimed|running|waiting|completed|failed|cancelled|lost
claimed_by text references browsermesh.nodes(node_id),
lease_id uuid, lease_expires_at timestamptz,
attempt int default 0, max_attempts int default 1,
result jsonb, evidence_bundle_id uuid,
created_at timestamptz, started_at timestamptz, finished_at timestamptz;

-- browsermesh.events   (append-only; feeds stream())
event_id bigserial primary key, job_id uuid, node_id text, seq int,
type text, payload jsonb, at timestamptz;

-- browsermesh.leases
lease_id uuid primary key, job_id uuid, node_id text,
granted_at timestamptz, expires_at timestamptz, renewed_count int;
```

Control endpoints (route handlers inside `apps/crm`, node auth = bearer per-node token):

| Verb + path | Caller | Purpose |
|---|---|---|
| `POST /api/bm/nodes/register` | daemon | advertise node_id, host_class, capabilities, cpu/mem |
| `POST /api/bm/nodes/heartbeat` | daemon | 10s liveness + current load snapshot + host_metrics |
| `POST /api/bm/jobs/claim` | daemon | atomic claim (see A.3); returns 0 or 1 job + grant |
| `POST /api/bm/jobs/:id/lease/renew` | daemon | extend lease, TTL 45s |
| `POST /api/bm/jobs/:id/events` | daemon | batch-append events (progress, log lines, decisions) |
| `POST /api/bm/jobs/:id/evidence` | daemon | multipart/stream evidence chunks; finalize manifest |
| `POST /api/bm/jobs/:id/complete` | daemon | terminal result (completed/failed) + usage meter |
| `GET  /api/bm/jobs/:id/cancel` | daemon (poll) OR pushed via WS | cancel flag; daemon also checks this in heartbeat response |
| `GET  /api/bm/jobs/:id/stream` (SSE/WS) | CRM UI / Job Engine | live event fan-out from `browsermesh.events` |

The seven-method blueprint contract maps to transport as:

| Contract method | Implementation |
|---|---|
| `start(spec)` | Job Engine inserts `browsermesh.jobs` row (`queued`). Returns `job_id`. |
| `send(job_id, msg)` | insert an `event` of type `input` OR write to `jobs.spec.inbox[]`; adapter's `onEvent` consumes (used for interactive Claude/Codex turns). |
| `stream(job_id)` | SSE over `browsermesh.events` ordered by `seq`. |
| `status(job_id)` | select the `jobs` row projection. |
| `cancel(job_id)` | set `jobs.status='cancelled'`, raise cancel flag; daemon acts within ≤2s. |
| `usage(job_id)` | read `jobs.result.usage` (UsageMeter) — wall_ms, cpu_ms, rss_peak_mb, tokens, egress, cost_estimate_eur. |
| `collectEvidence(job_id)` | returns EvidenceManifest + signed URLs from bucket `evidence/<job_id>/`. |

Latency path: control is HTTP long-poll (claim uses `SELECT ... FOR UPDATE SKIP LOCKED` with a
25s hold-open). `stream()` for the UI uses `ws-gateway.ts` subscribed to Postgres `LISTEN
bm_events_<job_id>` so operators see live output without polling. If WS is unavailable the UI
falls back to 1s SSE poll of the events table. **The queue table is always authoritative; WS is
an accelerator only.**

### A.3 Daemon protocol (concrete numbers)

- **Heartbeat**: every **10s**. Body = `{node_id, load1, load5, mem_avail_mb, swap_used_mb, disk_avail_gb, running_jobs:[job_id], draining:bool}`. Miss 3 (30s) → control marks node `offline`, its non-finished jobs become eligible for `lost` reclamation once their lease also expires.
- **Lease TTL = 45s**, renewed every **15s** (`renewed_count++`). Daemon self-aborts a job if it fails to renew twice in a row (it has lost the network) — kills the child, uploads partial evidence tagged `lease_lost`, exits the job as `failed`.
- **Job claim** (atomic, no double-run): daemon calls `POST /jobs/claim` with `{node_id, free_slots_by_class, labels}`. Handler runs:
  ```sql
  UPDATE browsermesh.jobs j
  SET status='claimed', claimed_by=$node, lease_id=gen_random_uuid(),
      lease_expires_at=now()+interval '45 seconds', started_at=now(), attempt=attempt+1
  WHERE j.job_id = (
    SELECT job_id FROM browsermesh.jobs
    WHERE status='queued'
      AND (required_labels IS NULL OR required_labels <@ $labels::jsonb)
      AND job_class = ANY($claimable_classes)
      AND (deadline_at IS NULL OR deadline_at > now())
    ORDER BY priority DESC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1 )
  RETURNING j.*;
  ```
  One row max, race-free. If `attempt > max_attempts` on reclamation, job goes `failed` with `reason=exhausted_attempts`.
- **Cancellation**: two paths. (1) Cancel flag returned inside every heartbeat response as `cancel:[job_id]`. (2) WS push `{type:"cancel",job_id}`. Daemon forwards to `runner-supervisor`, which sends `SIGTERM` to the child PID tree, waits **10s**, then `SIGKILL`. Adapter gets an `onCancel()` callback to flush a checkpoint first. Job ends `cancelled`, evidence uploaded with whatever exists.
- **Evidence upload**: streamed during the run, not only at the end. `evidence-uploader.ts` opens a multipart session `evidence/<job_id>/`, pushes: `stdout.log`, `stderr.log` (rotated at 5 MB, scrubbed), `events.ndjson`, `artifacts/` (adapter-declared output paths), `diff.patch` (git adapter), `screenshots/` (browser adapter), `usage.json`. On `complete`, uploader writes `manifest.json` (A.11) with a sha256 for every file and a bundle sha256 (merkle of file hashes). Control stores `evidence_bundle_id` on the job row.
- **Backpressure**: daemon advertises `free_slots_by_class` each heartbeat. If a node is at capacity it simply doesn't call `claim`. Shift OS / Resource Router (blueprint 4.59–4.60) reads `browsermesh.nodes` + queue depth to decide whether to burst a cloud node.

### A.4 Event union (`core/src/events.ts`)

```ts
type BrowserMeshEvent =
  | { type: "job.claimed";     node_id: string; at: string }
  | { type: "job.started";     adapter: string; grant_hash: string }
  | { type: "progress";        pct?: number; note: string }
  | { type: "log";             stream: "stdout" | "stderr"; line: string }
  | { type: "decision";        summary: string; detail?: string }        // blueprint 4.19
  | { type: "tool.invoked";    tool: string; args_hash: string }
  | { type: "blocker";         reason: string; needs: "input" | "approval" | "credential" }
  | { type: "checkpoint";      state_ref: string }
  | { type: "verification";    kind: string; passed: boolean; detail?: string }
  | { type: "evidence.part";   path: string; bytes: number }
  | { type: "usage";           meter: UsageMeter }
  | { type: "job.completed";   result_hash: string }
  | { type: "job.failed";      error: NormalizedError; partial_evidence: boolean }
  | { type: "job.cancelled";   at: string };
```

### A.5 Sandbox model — per-adapter capability grants

`grant-resolver.ts` computes an **effective CapabilityGrant** = intersection of:
1. adapter's static `profiles/<adapter>.json` (max it can ever ask for),
2. the AgentDefinition's `tool_policy` / capability requirements for this task (blueprint 4.4, 12.8),
3. the job's `capability_grant` from the Job Engine / Policy Engine (blueprint 4.61).

The grant is a JSON object enforced by `daemon/sandbox`:

```jsonc
// runtimes/browsermesh/sandbox/src/profiles/shell.json  (example ceiling)
{
  "filesystem": {
    "workspace_rw": ["${JOB_WORKSPACE}"],           // overlayfs upper dir, wiped after job
    "read_only":   ["/usr/lib", "/etc/ssl/certs", "${TOOLCHAIN_DIR}"],
    "deny":        ["${HOME}/.ssh", "${HOME}/.config", "/etc/shadow", "${HOME}/.infisical"]
  },
  "network": {
    "mode": "allowlist",
    "allow": ["registry.npmjs.org:443", "pypi.org:443", "files.pythonhosted.org:443"],
    "dns": ["1.1.1.1"],
    "deny_metadata_endpoint": true                   // block 169.254.169.254
  },
  "exec_allowlist": ["/bin/sh","/usr/bin/env","node","pnpm","python3","make","gcc"],
  "resources": { "cpu_pct": 400, "rss_mb": 4096, "pids": 512, "nofile": 4096, "wall_s": 1800 },
  "env_passthrough": ["PATH","LANG","TZ"],
  "secrets": []                                      // shell gets none by default
}
```

Enforcement mechanism per host class:
- **Linux (home + cloud)**: `unshare --mount --net --pid --fork` + cgroup v2 (`cpu.max`, `memory.max`, `pids.max`) + `nftables` egress allowlist in the job's net namespace + overlayfs workspace. This is the real jail.
- **Mac (emergency only)**: `sandbox-exec` profile generated from the grant (fs read/write/deny, network deny except allowlist via `sandbox` `system-network` rules) + `ulimit` for rss/nofile/pids. Weaker; Mac nodes therefore never receive `HEAVY`/secret-bearing jobs (`profiles` mark `mac_eligible:false` for git-push, deploy, payment-touching adapters).
- **VPS**: BrowserMesh daemon is **not installed**. VPS runs only the reliability set. Any attempt to schedule a job with `required_labels.host_class` including `vps` is rejected by the transport handler.

Per-adapter ceilings (the `profiles/*.json` `deny`/`allow`/`secrets` differ):

| Adapter | fs write | network | exec allowlist | secrets injected |
|---|---|---|---|---|
| `claude` | `${JOB_WORKSPACE}` only | `api.anthropic.com:443`, `api.z.ai:443` (9router), MCP hosts on job allowlist | `node`, `git` (read subcmds), repo scripts | `ANTHROPIC_API_KEY` (or 9router key) JIT, scrubbed |
| `codex` | `${JOB_WORKSPACE}` only | `chatgpt.com:443` / codex app-server localhost | `codex`, `node`, `pnpm`, `git` | Codex auth token JIT |
| `shell` | `${JOB_WORKSPACE}` | allowlist (pkg registries) | see profile above | none |
| `git` | `${JOB_WORKSPACE}/repo` | `github.com:443`, `ssh.github.com:22` only when push job | none extra | deploy key `lumenva_rw` JIT for push jobs only |
| `ffmpeg` | `${JOB_WORKSPACE}/in`, `${JOB_WORKSPACE}/out` | **none** (offline) | `ffmpeg`, `ffprobe` | none |
| `remotion` | `${JOB_WORKSPACE}` | `fonts.gstatic.com:443` + asset store | `node`, `chromium` (bundled) | none |
| `browser` | `${JOB_WORKSPACE}/downloads` | Steel Cloud API host; job-specified target domains | none (Steel remote) | Steel API key JIT; site creds via `steel credentials` |

`grant_hash = sha256(canonical_json(effective_grant))` is emitted in `job.started` and stored on
the evidence manifest, so every run is provable against the policy it ran under.

### A.6 Claude Adapter (`adapters/claude/`)

- **Purpose**: run a compiled-prompt agent turn or a multi-turn engineering task using Claude Code CLI or the Anthropic SDK, inside a sandboxed workspace.
- **Invocation modes**: `oneshot` (single compiled prompt + tools, returns `AgentResponse` JSON — blueprint 4.36), `interactive` (session; `send()` feeds user turns via `onEvent`), `headless-code` (drives `claude` CLI in a repo workspace for BUILD/CHANGE task classes).
- **Input `spec`**:
  ```ts
  {
    mode: "oneshot" | "interactive" | "headless-code",
    compiled_prompt_ref: string,        // pointer to compiled_prompt_versions row (blueprint 4.10)
    model_directive: { reasoning_policy: "FAST"|"STANDARD"|"DEEP"|"MAX", provider_hint?: string },
    tools: ToolContract[],              // only schemas the Tool Registry selected (blueprint 4.13)
    workspace: { source: "bundle" | "none", bundle_ref?: string },
    input: string | { messages: Msg[] },
    limits: { max_tokens: number, max_tool_calls: number, wall_s: number },
    mcp_servers?: McpServerRef[]         // each host must be on the net allowlist
  }
  ```
- **Runtime**: `prepare()` materializes workspace from git bundle (A.14) if `source==="bundle"`, writes a scoped `.mcp.json` and settings with `permissions.deny` mirroring the CapabilityGrant, exports the JIT key. `run()` spawns `claude -p --output-format stream-json` (headless) or calls the SDK. Every SDK/CLI event is mapped to a `BrowserMeshEvent` (`log`, `tool.invoked`, `decision`, `verification`). On finish it validates output against the `AgentResponse` schema; schema failure → bounded one repair retry (blueprint 4.53) then `job.failed` `reason=schema_error`.
- **Evidence**: full `stream-json` transcript, every tool call + args hash + result summary, final `AgentResponse`, token usage, and any repo diff (`git diff` captured by teardown).
- **Sandbox**: `claude.json` profile; network limited to the provider host(s) + declared MCP hosts; filesystem write only in workspace; secrets JIT and scrubbed from all evidence.
- **Failure normalization**: `429/overloaded → rate_limit` (Job Engine may re-queue or the Model Router triggers Emergency Handoff — blueprint 4.29); `context overflow → context_overflow` (caller recompiles); CLI non-zero without JSON → `adapter_crash` + stderr in evidence.

### A.7 Codex Adapter (`adapters/codex/`)

- **Purpose**: engineering execution via the local Codex CLI (`gpt-5.6-luna medium`), used for BUILD/CHANGE tasks the roster assigns to Codex agents.
- **Key constraint**: Codex is local to whatever host runs it. The adapter is **only registered on the home Linux node and cloud burst nodes**, never Mac (Mac Codex contends with Maestri) and never VPS.
- **Input `spec`**: `{ task_prompt: string, workspace: {source:"bundle", bundle_ref}, model:"gpt-5.6-luna", effort:"medium", approval_mode:"never", writable_roots:["${JOB_WORKSPACE}/repo"], net:"restricted", wall_s, max_iterations }`. `approval_mode:"never"` because the sandbox, not Codex's own prompt, is the boundary.
- **Runtime**: `run()` invokes `codex exec --cd ${JOB_WORKSPACE}/repo --model gpt-5.6-luna --config sandbox_mode=workspace-write` (non-interactive). Streams Codex events → `BrowserMeshEvent`. `send()` is a no-op in `exec` mode; interactive Codex uses `codex proto` and pipes turns.
- **Anti-footgun**: the adapter refuses to start if it detects it is the process parent of a `codex app-server` already serving a Maestri agent on the same host (checks `ps` for `.codex-jobpilot`), to avoid the known Mac contention pattern; on Linux it just enforces the cgroup `rss_mb` ceiling.
- **Evidence**: Codex session log, per-iteration diff, final `git diff`, test/lint output it ran, `usage.json` (iterations, wall, rss peak).
- **Failure**: auth expiry → `credential` blocker (owner re-auths Codex); iteration cap hit → `job.failed` `reason=iteration_exhausted` with the partial diff preserved.

### A.8 Shell Adapter (`adapters/shell/`)

- **Purpose**: deterministic command execution — installs, builds, typecheck, lint, unit/db/e2e test runs, migrations dry-run, artifact packaging. This is the workhorse for the gate (`run-gate.sh` logic moves here).
- **Input `spec`**: `{ steps: [{ name, cmd, cwd, env?, expect_exit?:0, timeout_s }], workspace:{source:"bundle",bundle_ref}, artifacts_out: string[], fail_fast: true }`.
- **Runtime**: each step runs under the sandbox in sequence; `stdout`/`stderr` streamed as `log` events with the step name; a step exiting non-zero (when `expect_exit:0`) stops the job `failed` unless `fail_fast:false`. `artifacts_out` globs are collected into evidence and, when the job is a build, promoted to the artifact store (A.22).
- **Determinism**: no network except the profile allowlist; `SOURCE_DATE_EPOCH` and `TZ=UTC` injected; pnpm store path pinned per host to a **per-node** store (`/srv/pnpm-store-<node_id>`) so concurrent worktrees on the same host do NOT share a store (this is the documented cause of `MODULE_NOT_FOUND` worktree corruption — each BrowserMesh job gets an isolated store or a `--frozen-lockfile --prefer-offline` copy).
- **Evidence**: per-step exit code + duration table (`steps.json`), full logs, produced artifacts, `env.redacted.json`.

### A.9 Git Adapter (`adapters/git/`)

- **Purpose**: all repository mutations that must be auditable — branch create, commit, bundle produce/verify, tag, and the **only** component allowed to `git push`.
- **Operations** (`spec.op`): `bundle-create` (produce `repo.bundle` for a ref range, upload as evidence + artifact), `bundle-verify`, `materialize` (bundle → working tree for other adapters), `commit` (stages a provided diff/patch, message must be Conventional Commits — validated by regex, body required for non-trivial, trailers appended: `Co-Authored-By` + `Claude-Session`), `tag`, `push` (guarded).
- **Push guard**: `push` jobs require `capability_grant.git.push === true`, target remote must be on an allowlist (`github-lumenva-rw` only), branch must match `^(mvp|feat|fix|refactor|chore|studio|customer)/`. Push to `main` is **blocked at the adapter** — main only advances via the deploy runbook's explicit merge step with owner approval (Policy/Approval engine, R3).
- **Bundle workflow** (source delivery, A.14): `bundle-create` on the home Linux node for `main..<workbranch>`, sha256 the bundle, store in artifact bucket `git-bundles/<branch>/<sha>.bundle`. Cloud nodes `materialize` from that.
- **Evidence**: `git log --stat` of the range, the bundle file + its sha, `diff.patch`, the exact push refspec and the remote's post-push ref (from `git ls-remote`).

### A.10 FFmpeg Adapter (`adapters/ffmpeg/`)

- **Purpose**: media transcode/mux/probe for the Marketing/Video wave (blueprint 4.74, Wave 12) — assemble Remotion output + voice + captions, normalize loudness, produce delivery renditions.
- **Input `spec`**: `{ op: "probe"|"transcode"|"concat"|"mux"|"loudnorm"|"thumbnail", inputs:[{asset_ref}], graph: string /* filter_complex */, output:{container,codec,params}, deadline_s }`.
- **Runtime**: fully offline sandbox (`network.allow: []`). Inputs pulled from the asset store by `prepare()` into `${JOB_WORKSPACE}/in`, output written to `${JOB_WORKSPACE}/out`, then pushed to the asset store by `evidence-uploader` and referenced back. Hard wall clock; `nice`/`ionice` + cgroup `cpu.max` so a long render can't starve a co-located build.
- **Verification**: post-run `ffprobe` of the output asserted against the requested `container/codec/duration±0.5s` before the job is `completed` (blueprint 4.17 media policy).
- **Evidence**: `ffprobe` JSON of every input and the output, the exact `ffmpeg` command line, stderr (progress), output file + sha, `usage.json`.

### A.11 Evidence manifest schema (`evidence/src/manifest.ts`)

```jsonc
{
  "schema": "lumenva.evidence/v1",
  "job_id": "…", "run_id": "…", "session_id": "…", "organization_id": "…",
  "adapter": "claude", "node_id": "linux-home-01", "host_class": "linux",
  "grant_hash": "sha256:…",
  "started_at": "…", "finished_at": "…", "status": "completed",
  "usage": { "wall_ms": 0, "cpu_ms": 0, "rss_peak_mb": 0, "tokens_in": 0, "tokens_out": 0,
             "egress_bytes": 0, "cost_estimate_eur": 0.0 },
  "claims": [ { "claim": "unit tests pass", "verification": "shell step `pnpm test` exit 0",
                "artifact": "steps.json#/3", "result": "pass" } ],
  "files": [ { "path": "stdout.log", "bytes": 12345, "sha256": "…" },
             { "path": "artifacts/build.tar.zst", "bytes": 999, "sha256": "…" } ],
  "bundle_sha256": "sha256:…",                 // merkle over files[].sha256 sorted by path
  "retention_class": "standard",               // ephemeral(7d) | standard(90d) | release(3y)
  "scrubbed": true
}
```

### A.12 Effort — BrowserMesh components

| Component | Eng-days | Depends on |
|---|---|---|
| `core` (contracts, events, usage, errors) | 3 | — |
| `transport` (tables, control routes, claim SQL, SSE) | 5 | core, Job Engine tables (Wave 1) |
| `daemon` (heartbeat, claim loop, lease, supervisor, timeout) | 8 | core, transport |
| `sandbox` primitives (fs-jail, net-filter, cgroups, Mac profile) | 9 | daemon |
| `security` (node token, grant-resolver, secret-broker, scrubber) | 5 | Policy Engine (Wave 1), Infisical |
| `evidence` (collector, store, manifest, retention) | 4 | core, Supabase Storage bucket |
| `adapters/_base` + `shell` | 4 | daemon, sandbox |
| `adapters/git` (+ push guard + bundle) | 4 | shell, security |
| `adapters/claude` | 6 | shell, security, Prompt Compiler (Wave 2) |
| `adapters/codex` | 4 | shell, security |
| `adapters/ffmpeg` | 3 | shell, asset store |
| `adapters/remotion` | 3 | ffmpeg adapter |
| `adapters/browser` (Steel-first) | 5 | shell, Steel CLI/skill |
| `adapters/hermes`, `adapters/maestri` | 4 | base, Wave 13 / maestri skill |
| Node bring-up runbooks (home Linux, cloud image, Mac emergency) | 3 | all daemon/sandbox |
| **BrowserMesh subtotal** | **~77 eng-days** | |

---

## PART B — COMPUTE TOPOLOGY (blueprint 11 + 4.59–4.60 + 13 host metrics)

Goal restated concretely: **maximize parallel work** across Mac + home Linux + on-demand Hetzner
Cloud + Codex, while the 3.7 GB production VPS (`lumenva-crm`, ID 162985793) does reliability
only and is never a compute target.

### B.1 Host inventory and role

| Host | Label `host_class` | Concurrency budget | Never runs |
|---|---|---|---|
| Home Linux (`worker` / 100.116.144.121) | `linux` | `TINY×6`, `LIGHT×4`, `NORMAL×3`, `HEAVY×1`, `EXCLUSIVE×1` (mutually exclusive with HEAVY) | payment execution (prohibited to all automation) |
| Hetzner burst (`lumenva-crm-gate-<epoch>`, CX53) | `cloud` | `NORMAL×3`, `HEAVY×2`, `EXCLUSIVE×1` | anything after its idle-teardown |
| Mac (`localhost`) | `mac` | `TINY×2`, `LIGHT×1` — opt-in, off by default | HEAVY, EXCLUSIVE, git push, deploy, secret-bearing jobs |
| Codex (adapter on `linux`+`cloud`) | capability, not a host | counts against its host's `NORMAL` budget; global cap `codex_concurrent ≤ 2` | Mac, VPS |
| VPS (`lumenva-crm`) | `vps` — **no daemon** | 0 | ALL BrowserMesh jobs |

Concurrency budgets are advertised by each daemon as `free_slots_by_class` and enforced by the
`process-manager` (a 7th HEAVY job simply is never claimed).

### B.2 Job-class → host routing table (Resource Router decision, blueprint 4.60)

| Job class | Typical work | Preferred host order | Notes |
|---|---|---|---|
| `TINY` | lint one file, typecheck a small diff, `git bundle-verify`, schema validation, a single eval case | `linux` → `mac` (if enabled) → `cloud` (only if already alive) | never burst a cloud box for TINY |
| `LIGHT` | one test file, one adapter oneshot Claude turn, ProjectSpec patch apply, doc intake fetch | `linux` → `cloud` (if alive) → `mac` | |
| `NORMAL` | package unit suite, Codex feature task, a Studio variant render, an integration test group | `linux` (if HEAVY slot free) → `cloud` | if `linux` NORMAL slots full AND queue age > 90s → burst `cloud` |
| `HEAVY` | full `pnpm -r build`, full repo test matrix, E2E with browsers, video render, `pnpm lint` whole repo after big merge | `cloud` (burst) → `linux` (only if no cloud and queue age > 5m) | **default HEAVY target is a fresh cloud box**, matching the proven `run-gate.sh` pattern |
| `EXCLUSIVE` | DB restore test, migration apply against a scratch DB, disaster-recovery drill, dependency upgrade bomb | `cloud` (dedicated burst box, nothing else co-scheduled) | tears down immediately after |

### B.3 Resource Router pick algorithm (`packages/shift-os/src/resource-router.ts`)

```
input: job {class, required_labels, deadline_at, est_rss_mb, est_wall_s, needs_codex}
1. candidates = nodes where status='online'
                and (required_labels ⊆ node.labels)
                and node has a free slot for job.class
                and node.mem_avail_mb >= est_rss_mb * 1.3
                and (job.class != EXCLUSIVE or node has zero running_jobs)
2. if candidates empty:
     if job.class in {NORMAL,HEAVY,EXCLUSIVE} and cost_guard.ok() and queue_age(job) > threshold(class):
        burst_cloud_node(job.class)          # B.4 ; job stays queued, claimed when node registers
        return WAIT
     else:
        return WAIT (log 'no_capacity')
3. score(node) =  100*prefer_rank(job.class, node.host_class)      # table B.2
               +   1.0*(node.mem_avail_mb/1024)
               -  25*(node.load5 / node.cpu_count)
               -  40*(node.host_class=='cloud' ? cloud_minute_cost_penalty : 0)
               -  15*(node.host_class=='mac' ? 1 : 0)
               +  20*(job.deadline_at and node.host_class=='cloud' and tight_deadline ? 1 : 0)
4. pick argmax(score). Tie -> lowest running_jobs -> lowest node_id.
5. write job.required_labels? no — routing is advisory; the node still claims via A.3 SKIP LOCKED.
   Router enforces by setting job.required_labels = {host_class:[picked.host_class]} and,
   for a burst, {node_id:[new_node_id]} so only the fresh box takes it.
```

`threshold(class)`: NORMAL 90s, HEAVY 30s, EXCLUSIVE 0s (burst immediately).

### B.4 Burst cloud lifecycle (`infra/cloud/burst.sh`, wraps the proven `run-gate.sh`)

Create:
1. `cost_guard.ok()` — see B.5. If not, router returns WAIT and raises a `costs` incident.
2. `hcloud server create --name lumenva-crm-gate-$(date +%s) --type cx53 --image debian-12 --ssh-key lumenva_ci --label role=gate --label ttl=90m`. **Assert the returned ID ≠ 162985793** (and name matches `^lumenva-crm-gate-`); abort hard otherwise.
3. cloud-init installs Node 20, pnpm, ffmpeg, chromium deps, the BrowserMesh daemon package (from a tarball baked into a snapshot `lumenva-gate-base`, rebuilt monthly), and a one-shot systemd unit `browsermesh-daemon` with `BM_NODE_LABELS='{"host_class":["cloud"]}'` and a node token minted by the create call.
4. Daemon registers → router's queued job (pinned via `required_labels.node_id`) gets claimed.
5. Append to `~/ci-cloud/spend.log`: `ISO8601  create  <id>  cx53  <hourly_eur>`.

Teardown (whichever fires first):
- **Idle**: daemon reports `running_jobs:[]` for 10 consecutive min → daemon calls `POST /nodes/drain-self`; control confirms no queued job needs it → `infra/cloud/burst.sh destroy <id>`.
- **TTL**: `ttl=90m` label + an `infra/cloud/reaper.sh` cron (every 15 min, on home Linux) destroys any `role=gate` server older than 90 min regardless.
- **Orphan sweep**: same reaper lists `hcloud server list -l role=gate`; any server not present in `browsermesh.nodes` as `online` in the last 20 min is destroyed and logged `orphan_destroyed`.
- Every destroy appends `spend.log`: `ISO8601  destroy  <id>  runtime_min=<n>  cost_eur=<n>`.
- **The reaper explicitly skips ID 162985793 and any name not matching `lumenva-crm-gate-*`.**

### B.5 Cost guard (`infra/cloud/cost-guard.sh`)

- Ledger: `~/ci-cloud/spend.log`, one line per event; a `spend-report` sums `cost_eur` for the current calendar month.
- **Ceiling €15 / month.** `cost_guard.ok()` returns false when `month_to_date + est_cost_of_one_more_hour > 15`. CX53 ≈ €0.03–0.05/h, so the ceiling is ~300–500 gate-hours/month — generous, but bounded.
- At 80% (€12) the guard raises a `costs` incident to Command Center and switches HEAVY routing preference to `linux` fallback (slower, free).
- Reaper's orphan sweep is the backstop against a runaway meter (a crashed create that never registered still gets destroyed within 15 min → max leak ≈ €0.02).
- Weekly `spend-report` posted to the owner (WhatsApp per the escalation rule) with create/destroy counts and total.

### B.6 Git source to a fresh cloud box (blueprint gap — branches not on GitHub)

Work branches never reach GitHub `origin`. Delivery is by **git bundle over the artifact store**:

1. On the home Linux node, a `git` adapter `bundle-create` job runs for `main..<workbranch>` (or `<lastGoodSha>..<headSha>` for incremental): `git bundle create repo.bundle main..<branch>`.
2. Bundle sha256'd, uploaded to Supabase Storage `git-bundles/<branch>/<headSha>.bundle`, recorded in `browsermesh.artifacts`.
3. The cloud job's `spec.workspace = { source:"bundle", bundle_ref:"git-bundles/<branch>/<headSha>.bundle" }`.
4. Cloud daemon `prepare()`: download bundle → `git init` + `git fetch repo.bundle <branch>` + `git checkout` → verify `git rev-parse HEAD == headSha` (fail job `bundle_mismatch` otherwise).
5. For incremental jobs the base tree is a cached `lumenva-base.bundle` (main only, refreshed daily) so only the delta bundle crosses the wire.
6. Results (diffs, new commits) come back the same way: cloud `git` adapter produces a `result.bundle` for its new commits, home Linux `materialize`s it onto the work branch. **No cloud box ever holds a push credential** (git push happens only from home Linux, guarded — A.9).

Caveat carried from CLAUDE.md: bundles exclude nothing from `.git`, so `git`-shelling tests work
fine on cloud (unlike the rsync-minus-`.git` VPS pattern). But cloud bundles are `main..branch`
only — a test needing full history (`git log` deep) gets `--all` bundle variant, flagged in spec.

### B.7 Host / infra metrics (blueprint 13, the host part)

`daemon/metrics-exporter.ts` pushes a `browsermesh.host_metrics` row every heartbeat (10s),
downsampled to 1-min rollups by `workers/cleanup-worker`:

```sql
-- browsermesh.host_metrics
node_id text, at timestamptz,
load1 real, load5 real, load15 real, cpu_pct real,
mem_total_mb int, mem_avail_mb int, swap_used_mb int,
disk_avail_gb real, disk_io_read_mbps real, disk_io_write_mbps real,
net_rx_mbps real, net_tx_mbps real,
running_jobs int, jobs_by_class jsonb,
temp_c real null, uptime_s bigint,
primary key (node_id, at)
```

Derived infra signals for Command Center → Infrastructure dashboard (blueprint 4.1, 13):
`host_saturation = load5 / cpu_count` (alert > 1.5 sustained 5 min), `mem_pressure = 1 -
mem_avail/mem_total` (alert > 0.9), `swap_active` (alert swap_used > 256 MB on any node),
`queue_wait_p50/p95` per job class, `burst_minutes_today`, `spend_month_eur`, `orphan_count`.
The **VPS** (no daemon) is monitored by the existing Ops Watcher on the VPS itself — same
`host_metrics` table, `node_id='vps-lumenva-crm'`, pushed by a tiny `infra/vps/metrics-push.sh`
cron so the dashboard has one uniform source. VPS alert thresholds are tighter
(`mem_pressure > 0.8` pages, given 3.7 GB and the historical OOM).

### B.8 Effort — compute topology

| Item | Eng-days | Depends on |
|---|---|---|
| `resource-router.ts` + scoring + WAIT/burst signal | 4 | BrowserMesh transport, `browsermesh.nodes` |
| `infra/cloud/burst.sh` + `reaper.sh` + base snapshot bake | 4 | hcloud token, daemon package |
| `cost-guard.sh` + `spend-report` + incident hook | 2 | spend.log convention (exists) |
| git-bundle delivery (adapter op + artifact bucket + prepare()) | 3 | git adapter, Storage bucket |
| `host_metrics` table + exporter + rollups + VPS push | 3 | daemon |
| Command Center Infrastructure dashboard wiring | 3 | metrics, Wave 5 |
| **Compute topology subtotal** | **~19 eng-days** | |

---

## PART C — SUPABASE MIGRATION / BASELINE / MANIFEST WORKFLOW (blueprint 8, 2.16, ADR-023)

New domains to land: `agent-definition`, `session`, `studio`, `customer-delivery` (blueprint
8.3–8.7), plus `browsermesh` (Part A) and `infra` (`host_nodes`, `host_metrics`, `approvals`,
`evidence`, `incidents` — 8.2).

### C.1 Layout (`supabase/`)

```
supabase/
├── baseline.sql              # full current schema, regenerated, NEVER hand-edited for changes
├── migrations/               # forward-only, timestamp-prefixed, applied set is immutable
│   ├── 20260912090000_agentdef_core.sql
│   ├── 20260912090500_agentdef_contracts.sql
│   ├── 20260915100000_session_core.sql
│   ├── 20260915100500_session_routing.sql
│   ├── 20260920110000_browsermesh.sql
│   ├── 20260922120000_infra_ops.sql
│   ├── 20261001130000_studio_domain.sql
│   └── 20261110140000_customer_delivery.sql
├── policies/                 # one file per table group: RLS policies, re-runnable (drop+create)
│   ├── agentdef.policies.sql
│   ├── session.policies.sql
│   ├── studio.policies.sql
│   ├── customer_delivery.policies.sql
│   └── browsermesh.policies.sql
├── seeds/                    # dev/staging only, idempotent upserts
├── tests/                    # pgTAP: RLS isolation, FK integrity, tenancy
│   ├── agentdef.rls.test.sql
│   ├── session.isolation.test.sql
│   └── crosstenant.test.sql
├── manifest.json            # see C.3 — the source-of-truth index of schema objects + versions
└── schema.lock              # sha256 of (baseline.sql + sorted migration filenames) ; CI/gate compares
```

### C.2 Workflow rules (concrete)

1. **Every change is a new migration file.** `pnpm db:new <slug>` scaffolds `supabase/migrations/<utc>_<slug>.sql` with a header block (author, date, domain, ADR ref, rollback note: application-rollback vs forward-compensating).
2. **Applied migrations are immutable.** A pre-commit hook + the gate's `db:verify` step recompute `schema.lock`; if a file whose timestamp is ≤ the last-applied timestamp changed content-hash, the gate **fails** `reason=applied_migration_edited`.
3. **Forward-only fixes.** A mistake in an applied migration is corrected by a new `_fix_` migration (`ALTER`/`DROP`/backfill), never by editing the original (ADR-023).
4. **Baseline is generated, not authored.** `pnpm db:baseline` = spin scratch Postgres → apply `baseline.sql`? no — apply **all** migrations from empty → `pg_dump --schema-only --no-owner` → write `baseline.sql`. Baseline exists so a fresh env (new cloud scratch DB, DR restore target) reaches current schema in one shot without replaying 200 migrations. Baseline is regenerated after each merged migration and committed alongside it.
5. **Manifest is updated in the same commit** as the migration (C.3). The gate checks manifest ↔ live-schema drift.
6. **RLS first.** No new tenant table is merged without: `organization_id uuid not null` (or a documented non-tenant exception), an entry in `policies/<domain>.policies.sql`, and a pgTAP isolation test in `supabase/tests/`. Blueprint 12.2 / ADR: `organization_id` comes from the trusted session, never request body.
7. **Apply path**:
   - **Local/dev**: `supabase db reset` (replays migrations + seeds).
   - **Staging / scratch (cloud gate, DR drill)**: `supabase db push --db-url $SCRATCH` or `psql -f baseline.sql` then only migrations after baseline's timestamp.
   - **Lumenva production control DB**: `supabase migration up --linked` run from the **deploy runbook** (Part D), never from CI, gated by an R3 approval, with a fresh `pg_dump` taken immediately before (Part E).
8. **Customer-delivery domain caveat** (blueprint 2.17): `customer_projects`, `project_repositories`, etc. hold only *control metadata* in the Lumenva DB. A customer product's own DB (Neon — decision D.1) has its **own** migration set generated by `packages/project-generator`, versioned inside that customer's repo, never mixed into `supabase/migrations/`.

### C.3 `manifest.json` schema

```jsonc
{
  "schema": "lumenva.dbmanifest/v1",
  "generated_at": "2026-09-12T09:10:00Z",
  "baseline_sha256": "sha256:…",
  "last_applied_migration": "20261110140000_customer_delivery",
  "domains": {
    "agent-definition": {
      "migrations": ["20260912090000_agentdef_core", "20260912090500_agentdef_contracts"],
      "tables": [
        { "name": "agent_definitions", "tenant": true, "rls": true, "pk": "agent_id",
          "fks": [], "policy_file": "policies/agentdef.policies.sql",
          "test": "tests/agentdef.rls.test.sql" },
        { "name": "agent_versions", "tenant": true, "rls": true, "pk": "id",
          "fks": [{ "column": "agent_id", "ref": "agent_definitions.agent_id" }] },
        { "name": "compiled_prompt_versions", "tenant": true, "rls": true, "pk": "id",
          "immutable": true, "note": "append-only, prompt_hash unique per (agent_version,policy_version)" }
      ]
    },
    "session": {
      "migrations": ["20260915100000_session_core", "20260915100500_session_routing"],
      "tables": [
        { "name": "agent_sessions", "tenant": true, "rls": true },
        { "name": "session_snapshots", "tenant": true, "rls": true, "append_only": true },
        { "name": "model_locks", "tenant": true, "rls": true },
        { "name": "tool_calls", "tenant": true, "rls": true, "idempotency_key": "unique" },
        { "name": "provider_quotas", "tenant": false, "rls": false, "note": "global reference data" }
      ]
    },
    "studio":            { "migrations": ["20261001130000_studio_domain"], "tables": [ /* studio_projects … studio_deployments, all tenant+rls */ ] },
    "customer-delivery": { "migrations": ["20261110140000_customer_delivery"], "tables": [ /* customer_projects … project_health_checks, tenant+rls, metadata only */ ] },
    "browsermesh":       { "migrations": ["20260920110000_browsermesh"], "tables": [ /* nodes(global), jobs, events(append_only), leases, host_metrics, artifacts */ ] },
    "infra-ops":         { "migrations": ["20260922120000_infra_ops"], "tables": [ /* approvals, evidence, incidents, notifications */ ] }
  }
}
```

`pnpm db:verify` (runs in the gate and the deploy runbook): connects to a scratch DB with all
migrations applied, introspects `information_schema`, and asserts: every manifest table exists
with declared PK/FKs; every `rls:true` table has `rowsecurity=true` and ≥1 policy; every
`append_only`/`immutable` table has the blocking trigger or `REVOKE UPDATE,DELETE`; `schema.lock`
matches. Any mismatch → non-zero exit.

### C.4 Effort — DB workflow

| Item | Eng-days | Depends on |
|---|---|---|
| `db:new`/`db:baseline`/`db:verify` scripts + `schema.lock` + pre-commit hook | 3 | existing supabase CLI setup |
| `manifest.json` schema + generator + drift check | 3 | db:verify |
| Migration authoring: agentdef (2), session (2), browsermesh (1), infra-ops (1), studio (1), customer-delivery (1) files + RLS + pgTAP | 12 | schema designs from Waves 1/2/3/4/6/10 |
| Cross-tenant pgTAP suite | 3 | migrations |
| **DB workflow subtotal** | **~21 eng-days** | |

---

## PART D — DEPLOYMENT (blueprint 22)

### D.1 Open decision resolved — default customer-product infrastructure

**Pick: Cloudflare (Pages + Workers) + Neon Postgres** as the single frozen Product Factory
default profile, with **Supabase Auth/Storage** used only when a product needs hosted auth/file
storage out of the box; otherwise Cloudflare Access + R2.

Rationale (stated, not hedged): Neon gives per-branch database branching that maps 1:1 to the
Studio branch→preview flow and to cheap ephemeral preview DBs; Cloudflare Pages/Workers has no
cold-start tax, flat low cost, and first-class preview URLs per branch; both have clean IaC/API.
The alternative (Vercel + Supabase) stays viable and is kept behind the same seam.

**Swap seam:** `packages/project-generator` never emits provider names into `ProjectSpec`
semantics (blueprint 28). It emits an abstract `DeploymentTarget`:

```ts
interface DeploymentTarget {
  hosting: "cloudflare-pages" | "vercel";
  edge_functions: "cloudflare-workers" | "vercel-functions";
  database: "neon" | "supabase";
  auth: "supabase-auth" | "cloudflare-access" | "none";
  storage: "r2" | "supabase-storage" | "none";
}
```

`integrations/<provider>/deploy-adapter.ts` implements one interface —
`provision(env)`, `deploy(artifact, env)`, `promote(preview→prod)`, `healthcheck(url)`,
`rollback(release_target)`, `destroy(env)`. Changing the default = changing one constant
(`DEFAULT_DEPLOYMENT_TARGET`) plus having the other adapter implemented. No generator or
ProjectSpec change.

### D.2 Open decision resolved — framework boundary (custom runtime vs provider SDK)

**Pick: Lumenva custom runtime owns canonical state; provider SDKs live strictly behind
`packages/model-router/providers/<name>/` adapters and behind BrowserMesh adapters. SDKs are
call-transport only.**

Concretely, an SDK (Anthropic SDK, OpenAI/Codex, Gemini, Groq, future) MAY be used for: HTTP
transport, streaming parsing, token counting, tool-call schema plumbing, retry/backoff helpers.
An SDK MUST NOT own: agent identity, session truth, memory, authorization decisions,
cross-provider handoff state, the execution loop, or the state machine. Those are
`packages/agent-runtime`.

**The seam** is the `ModelProvider` interface (blueprint 4.50) — `generate()`, `stream()`,
`health()`, `getQuota()`, `capabilities()`, `normalizeError()` — plus a `Session` object that is
always a Lumenva-owned Postgres-backed entity passed *into* the provider call, never a
provider-side "thread"/"assistant". If a provider offers server-side sessions/assistants/threads,
the adapter treats them as a disposable cache keyed by Lumenva `session_id` and reconstructs from
Lumenva state on any miss (blueprint 4.24, "provider conversation history is NOT durable
memory"). Replacing a provider = new folder under `providers/`, register in Model Capability
Registry as `candidate`, run agent-specific evals (ADR-015), promote. Zero runtime code change.

### D.3 Lumenva production deploy runbook (GitHub Actions OFF — blueprint 22, CLAUDE.md)

Deploy of the Lumenva CRM/control-plane itself. Executed as a scripted runbook, driven by the
**Release Manager agent** through BrowserMesh `shell`/`git` adapters, with an R3 approval gate.

`infra/deploy/lumenva/` scripts, run in order:

| Step | Script | What | Gate |
|---|---|---|---|
| 0 | `preflight.sh` | assert clean work branch, `schema.lock` matches, `manifest` no drift on scratch DB, target commit chosen | — |
| 1 | `build.sh` | on **home Linux or a burst `cloud` box** (never VPS): `pnpm i --frozen-lockfile` → `pnpm -r typecheck lint` → `pnpm -r test` → `pnpm -r build` → `apps/crm` standalone output tarball `crm-<sha>.tar.zst` | all suites green (evidence bundle) |
| 2 | `artifact.sh` | sha256 tarball, upload to Storage `releases/lumenva/crm-<sha>.tar.zst`, write draft Release Manifest (D.5) | — |
| 3 | `db-backup.sh` | `pg_dump -Fc` of production control DB → `backups/predeploy/<sha>-<ts>.dump` (Storage + VPS local copy) | dump size sane vs last |
| 4 | `db-migrate.sh` | `supabase migration up --linked` against production; on any error → stop, do NOT proceed | **R3 approval** (Approval Engine) before this step |
| 5 | `ship.sh` | `scp crm-<sha>.tar.zst vps:/srv/releases/` → `ssh vps 'cd /srv/lumenva && ./activate.sh <sha>'` — extracts to `/srv/lumenva/releases/<sha>`, repoints `current` symlink, `systemctl reload lumenva-crm` (zero-downtime: new node process, old drains) | — |
| 6 | `healthcheck.sh` | poll `https://<crm-domain>/api/health` (checks: process up, DB reachable, migration head == expected, event_log writable, WAHA reachable) for 90s | must pass 3 consecutive |
| 7 | `finalize.sh` | mark Release Manifest `status=live`, set `rollback_target = previous <sha>`, record `deployment_id`, notify owner | — |
| R | `rollback.sh <target_sha>` | repoint `current` symlink to `/srv/lumenva/releases/<target_sha>`, `systemctl reload`; if migrations were applied and are **not** backward-compatible → run the named forward-compensating migration instead (never `migration down`); re-run healthcheck | invoked on step-6 failure or owner call |

`main` only advances when a deploy is finalized `live`: `finalize.sh` fast-forwards `origin/main`
to the deployed commit (the one place a push to main happens, via the git adapter with an
explicit R3 grant). Everything stays reproducible from `main` + Release Manifest.

### D.4 Customer product pipeline (blueprint 22 line 2, Wave 9–10)

Per customer project (isolated repo, blueprint 4.81 / ADR-021). Driven by `workers/deploy-worker`
+ `integrations/<provider>/deploy-adapter.ts` (D.1).

```
branch (feature/*)                → git adapter: commit, bundle
   → build-worker (cloud/linux)   → install, typecheck, lint, unit, db (Neon branch DB), integration, e2e, a11y
   → security scan                → dep audit + secret scan + SAST (semgrep) ; R3 blocker on high sev
   → preview deploy               → deploy-adapter.deploy(artifact, env=preview)
                                     Cloudflare Pages preview URL + Neon branch DB seeded
   → CLIENT approval              → Studio Client Portal "approve" event (opaque token, blueprint 4.69)
   → PRODUCTION approval          → owner R3 approval in Command Center
   → production deploy            → deploy-adapter.promote(preview→prod)  (or deploy(artifact, env=prod))
                                     custom domain bind, Neon prod branch migrate (forward-only)
   → healthcheck                  → deploy-adapter.healthcheck(prod_url) : 200 on /health, TLS valid,
                                     DB migration head == manifest, smoke path (home + 1 key action)
   → release registered          → Release Manifest (D.5) persisted to project_releases,
                                     rollback_target = previous release commit + Neon PITR timestamp
```

Rollback for customer products: `deploy-adapter.rollback(release_target)` — Cloudflare Pages
"rollback to deployment" API to the previous build; Neon PITR / branch reset to the
`db_snapshot_ref` timestamp in the manifest if the release included a non-backward-compatible
migration; otherwise leave DB (forward-compatible) and only revert the build.

### D.5 Release Manifest — real JSON schema

`packages/project-generator/src/release-manifest.schema.json` (JSON Schema draft 2020-12,
also used for Lumenva's own releases in D.3):

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://lumenva.dev/schemas/release-manifest/v1.json",
  "title": "Lumenva Release Manifest",
  "type": "object",
  "required": ["schema_version","release_id","project","kind","release_version","commit",
               "created_at","created_by","environment","artifacts","schema_state",
               "tests","security","status","rollback_target"],
  "additionalProperties": false,
  "properties": {
    "schema_version":   { "const": "lumenva.release/v1" },
    "release_id":       { "type": "string", "format": "uuid" },
    "project":          { "type": "string", "description": "'lumenva-crm' or customer_project_id" },
    "kind":             { "enum": ["lumenva-control-plane", "customer-product"] },
    "release_version":  { "type": "string", "description": "semver or date-seq, e.g. 2026.09.14-3" },
    "commit":           { "type": "string", "pattern": "^[0-9a-f]{40}$" },
    "commit_branch":    { "type": "string" },
    "bundle_ref":       { "type": "string", "description": "git-bundles/<branch>/<sha>.bundle" },
    "created_at":       { "type": "string", "format": "date-time" },
    "created_by":       { "type": "string", "description": "agent_id or user id (Release Manager)" },
    "deployment_id":    { "type": ["string","null"] },
    "environment": {
      "type": "object",
      "required": ["name","target"],
      "properties": {
        "name":   { "enum": ["preview","staging","production"] },
        "target": {
          "type": "object",
          "required": ["hosting","database"],
          "properties": {
            "hosting":        { "enum": ["cloudflare-pages","vercel","vps-systemd"] },
            "edge_functions": { "enum": ["cloudflare-workers","vercel-functions","none"] },
            "database":       { "enum": ["neon","supabase","postgres-vps"] },
            "auth":           { "enum": ["supabase-auth","cloudflare-access","none"] },
            "storage":        { "enum": ["r2","supabase-storage","none"] },
            "region":         { "type": "string" },
            "domain":         { "type": ["string","null"] }
          }
        }
      }
    },
    "artifacts": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object",
        "required": ["name","kind","uri","sha256","bytes"],
        "properties": {
          "name":   { "type": "string" },
          "kind":   { "enum": ["app-tarball","static-bundle","container-image","source-bundle","sourcemap"] },
          "uri":    { "type": "string" },
          "sha256": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
          "bytes":  { "type": "integer", "minimum": 0 }
        }
      }
    },
    "schema_state": {
      "type": "object",
      "required": ["migration_head","forward_only","backward_compatible"],
      "properties": {
        "migration_head":       { "type": "string", "description": "last applied migration id" },
        "applied_this_release":  { "type": "array", "items": { "type": "string" } },
        "forward_only":         { "const": true },
        "backward_compatible":  { "type": "boolean", "description": "false => rollback needs compensating migration" },
        "compensating_migration": { "type": ["string","null"] },
        "db_snapshot_ref":      { "type": ["string","null"], "description": "pg_dump uri or Neon PITR timestamp taken pre-deploy" }
      }
    },
    "required_secrets": {
      "type": "array",
      "items": { "type": "object", "required": ["key","source"],
                 "properties": { "key": { "type": "string" },
                                 "source": { "enum": ["infisical","cloudflare-secret","neon-env"] } } },
      "description": "references only — never values (blueprint 12.6)"
    },
    "tests": {
      "type": "object",
      "required": ["passed","suites"],
      "properties": {
        "passed": { "type": "boolean" },
        "suites": {
          "type": "array",
          "items": { "type": "object", "required": ["name","result","count"],
                     "properties": { "name": { "type": "string" },
                                     "result": { "enum": ["pass","fail","skip"] },
                                     "count": { "type": "integer" },
                                     "evidence_bundle_id": { "type": ["string","null"] } } }
        }
      }
    },
    "security": {
      "type": "object",
      "required": ["status"],
      "properties": {
        "status": { "enum": ["pass","pass-with-waivers","fail"] },
        "dep_audit": { "enum": ["pass","fail","n/a"] },
        "secret_scan": { "enum": ["pass","fail"] },
        "sast": { "enum": ["pass","fail","n/a"] },
        "waivers": { "type": "array", "items": { "type": "string" } }
      }
    },
    "preview_url": { "type": ["string","null"] },
    "healthcheck": {
      "type": "object",
      "properties": {
        "url": { "type": "string" }, "passed": { "type": "boolean" },
        "checked_at": { "type": ["string","null"], "format": "date-time" },
        "checks": { "type": "array", "items": { "type": "string" } }
      }
    },
    "approvals": {
      "type": "array",
      "items": { "type": "object", "required": ["kind","by","at"],
                 "properties": { "kind": { "enum": ["client","production","migration-r3"] },
                                 "by": { "type": "string" }, "at": { "type": "string", "format": "date-time" },
                                 "approval_id": { "type": "string" } } }
    },
    "status":          { "enum": ["draft","building","built","deploying","live","failed","rolled-back","superseded"] },
    "rollback_target": {
      "type": "object",
      "required": ["commit"],
      "properties": {
        "release_id": { "type": ["string","null"] },
        "commit":     { "type": "string", "pattern": "^[0-9a-f]{40}$" },
        "artifact_uri": { "type": ["string","null"] },
        "db_action":  { "enum": ["none","app-rollback","compensating-migration","pitr-restore"] },
        "db_ref":     { "type": ["string","null"] }
      }
    },
    "evidence_bundle_id": { "type": ["string","null"] }
  }
}
```

Persisted: Lumenva releases → `infra-ops` domain / a `lumenva_releases` table; customer releases →
`project_releases` (blueprint 8.7). One row per release, `status` transitions are append-only via
`session_snapshots`-style history.

### D.6 Effort — deployment

| Item | Eng-days | Depends on |
|---|---|---|
| `infra/deploy/lumenva/*` runbook scripts + `activate.sh`/`rollback.sh` on VPS | 5 | BrowserMesh shell/git adapters, VPS layout |
| Release Manifest schema + validator + persistence (both kinds) | 3 | manifest infra |
| `integrations/cloudflare/deploy-adapter.ts` (Pages+Workers+R2) | 6 | DeploymentTarget seam |
| `integrations/neon/*` (branch DB provision, migrate, PITR rollback) | 5 | project-generator DB gen |
| `integrations/vercel/deploy-adapter.ts` (alt, kept behind seam) | 4 | seam |
| `workers/deploy-worker` + `build-worker` orchestration of the customer pipeline | 6 | Job Engine, BrowserMesh |
| security scan step (semgrep + secret scan + dep audit wrapper) | 3 | shell adapter |
| Release Manager agent definition + evals (Agent Birth) | 3 | Wave 2 factory |
| **Deployment subtotal** | **~35 eng-days** | |

---

## PART E — BACKUP, DR, RECOVERY (blueprint 23)

### E.1 Targets, method, location, retention

| Data | Method | Primary location | Secondary | Frequency | Retention |
|---|---|---|---|---|---|
| Lumenva control DB (Postgres) | `pg_dump -Fc` full + WAL/PITR if Supabase-managed | Supabase Storage `backups/db/` | home Linux `~/backups/lumenva-db/` + weekly to VPS `/srv/backups/` | full daily 02:00 UTC; PITR continuous (managed) | daily 14d, weekly 8w, monthly 12m |
| Pre-deploy DB snapshot | `pg_dump -Fc` (D.3 step 3) | Storage `backups/predeploy/` | — | every deploy | keep last 20 + all `release`-tagged |
| Code / branches | git bundles of every work branch + `origin/main`,`blog` | Storage `git-bundles/` | home Linux `~/src/Lumenva` (live), Mac clone (cold) | on every merge + nightly `--all` bundle | nightly bundles 30d, per-release bundle 3y |
| Agent definitions / compiled prompts | rows in `agent-definition` domain (already versioned, append-only) + nightly JSON export | Storage `backups/agents/<date>.json` | git bundle of `packages/agent-definition/definitions/` | nightly | 90d rolling + all `certified` versions forever (in DB) |
| Memory (durable) | included in control-DB dump; plus nightly logical export of `customer_memories`,`memory_candidates` | Storage `backups/memory/` (encrypted, age/gpg) | — | nightly 23:00 (blueprint 7.3 stagger) | 90d; legal-hold rows excluded from purge |
| Media / assets | Supabase Storage bucket versioning + nightly `rclone` sync | R2 `lumenva-assets-backup` | — | nightly | 60d versions |
| BrowserMesh durable state (leases/jobs/artifacts index) | in control DB dump | — | — | with DB | with DB |
| Evidence bundles | object store, `retention_class` tag drives TTL sweeper | Storage `evidence/` | release-tagged copied to `backups/evidence-release/` | on creation | ephemeral 7d, standard 90d, release 3y |
| Secrets | **not backed up as data** — Infisical is source of truth; export its recovery kit to owner's offline store quarterly | Infisical | owner offline | quarterly | n/a |
| Infra config / runbooks | in git (`infra/`) → covered by code bundles | — | — | — | 3y |
| Customer product DBs (Neon) | Neon automated backups + PITR per project | Neon | monthly `pg_dump` to Storage `backups/customer/<project>/` | continuous + monthly | Neon default + 12 monthly dumps |

Encryption: all off-Supabase copies (home Linux, VPS, R2 memory/evidence) encrypted at rest with
`age` using a key in Infisical + an offline copy with the owner. `pg_dump` files `age`-encrypted
before leaving the DB host.

### E.2 Cron (all on home Linux unless noted; `infra/backups/crontab`)

```
# m h  dom mon dow   command
  0 2   *   *   *     infra/backups/db-full.sh            # pg_dump -Fc control DB -> Storage + local + verify restorable
 30 2   *   *   *     infra/backups/agents-export.sh      # agent defs + compiled prompts JSON -> Storage
  0 3   *   *   *     infra/backups/assets-sync.sh        # rclone Supabase Storage assets -> R2
  0 23  *   *   *     infra/backups/memory-export.sh      # encrypted logical export of memory tables
 20 23  *   *   *     infra/backups/branch-bundles.sh     # git bundle --all for every local branch -> Storage
 40 23  *   *   *     infra/backups/evidence-tier.sh      # move release-tagged evidence to long-term prefix
  0 4   *   *   0     infra/backups/weekly-to-vps.sh      # ssh vps: copy latest db dump + bundles to /srv/backups
 15 4   *   *   0     infra/backups/restore-test.sh       # E.3 automated restore drill -> report
  0 5   1   *   *     infra/backups/monthly-customer-db.sh
 */15 *  *   *   *     infra/cloud/reaper.sh              # orphan/TTL gate-box sweep (Part B.4)
  0 9   *   *   1     infra/cloud/spend-report.sh         # weekly cost report to owner
```

VPS-side cron (`infra/vps/crontab`): `*/5 * * * * infra/vps/metrics-push.sh` (B.7),
`0 */6 * * * infra/vps/health-selfcheck.sh` (independent Ops Watcher path, blueprint 14).

### E.3 Restore test procedure (weekly, automated — `restore-test.sh`)

1. Burst a `cloud` box labeled `role=dr-drill` (separate from `role=gate`; cost-guarded; ID-checked ≠ 162985793).
2. Install Postgres 15. `age`-decrypt the latest `db-full` dump.
3. `pg_restore -j4` into a fresh DB. Record wall time = **RTO measurement**.
4. Assertions: `pnpm db:verify` against the restored DB (manifest match); row counts for `organizations`, `contacts`, `agent_sessions`, `compiled_prompt_versions`, `customer_memories` within 2% of a control query taken against production at dump time (stored in the dump's sidecar `.meta.json`); newest `event_log` row timestamp ≤ dump time and ≥ dump time − 26h (freshness).
5. Restore the latest `main` git bundle into an empty dir, `git fsck`, `pnpm i --frozen-lockfile`, `pnpm -r typecheck` — proves code backup is buildable.
6. Restore one random `evidence` bundle, verify `bundle_sha256` merkle.
7. Write `backups/restore-tests/<date>.json`: `{rto_seconds, dump_age_hours, row_deltas, db_verify:pass|fail, code_build:pass|fail, evidence_check:pass|fail}`. Any `fail` or `rto_seconds > 1800` → `incidents` row + owner WhatsApp.
8. Destroy the drill box. Log to `spend.log`.

**RTO target 30 min, RPO target 24h** (PITR narrows RPO to ~minutes for the managed control DB;
the 24h is the guaranteed floor from daily dumps if PITR is unavailable). Quarterly: a **manual**
full DR rehearsal that also re-points a staging CRM at the restored DB and runs the Session
Runtime golden E2E (blueprint 15.5) against it.

### E.4 Recovery scenarios → action (concrete, blueprint 21/23)

| Event | Action |
|---|---|
| Bad Lumenva deploy, app-level | `rollback.sh <previous_sha>` — symlink flip + `systemctl reload`, ≤ 60s. Migrations forward-compatible → DB untouched. |
| Bad deploy, migration not backward-compatible | run the named `compensating_migration` from the manifest, then symlink flip. Never `migration down`. |
| Control DB corruption / bad data write | PITR to just before the offending txn (managed) OR `pg_restore` latest dump + replay `event_log` deltas from the last good snapshot. |
| Home Linux dies | Bring BrowserMesh work up on burst `cloud` nodes (topology already supports `linux`→`cloud` fallback). Restore `~/src/Lumenva` from `main` bundle on a new box. No control-plane impact (VPS unaffected). |
| VPS dies | Provision new Hetzner box (NOT reusing ID), `age`-decrypt weekly `/srv/backups` copy or pull latest dump from Storage, `pg_restore`, deploy latest `releases/lumenva/` artifact via `ship.sh` against the new host, repoint DNS. RTO ~45–60 min. |
| Ransomware / Supabase account loss | Rebuild from: home Linux local dumps + VPS weekly copies + git bundles + Infisical recovery kit. All three exist off Supabase. |
| Evidence store loss | Non-critical; release-tagged evidence duplicated in `backups/evidence-release/`. |

### E.5 Effort — backup/DR

| Item | Eng-days | Depends on |
|---|---|---|
| Backup scripts (db-full, agents-export, memory-export, branch-bundles, assets-sync, tiering) | 5 | Storage buckets, `age` key in Infisical |
| `weekly-to-vps.sh` + VPS `/srv/backups` layout | 1 | ssh vps |
| `restore-test.sh` automated drill + report + incident hook | 4 | burst infra, `db:verify` |
| Recovery runbooks (`infra/disaster-recovery/*.md`) + quarterly rehearsal script | 3 | all above |
| Crontab install + monitoring of cron success (dead-man's switch → incident) | 2 | incidents table |
| **Backup/DR subtotal** | **~15 eng-days** | |

---

## PART F — CREATION ORDER: `packages/` + `runtimes/` + `workers/` MAPPED TO WAVES (blueprint 16, 17)

Rule from blueprint: no empty folders — a package/dir is created only in the wave that first needs
it, with a real first file and a passing test.

### Wave-by-wave creation

**PHASE 0 — Canonical Audit.** Creates NO code packages. Creates `docs/architecture/`,
`docs/adr/`, `docs/provider-docs-index/`, `docs/agent-source-pack/`, `docs/runbooks/`,
`evidence/` (root), and the Phase-0 deliverable markdowns. Also `supabase/` skeleton
(`baseline.sql` from current DB, empty `migrations/` already exists, `manifest.json` seeded from
current schema, `schema.lock`). — *why first:* everything downstream keys off the current-state
map and the immutable-migration guardrail.

**WAVE 1 — Operating Core.** Create:
- `packages/shared/` (types, result/either, ids, clock, logger) — everything imports this.
- `packages/policy-engine/` (foundation: actor/action → allow/deny, RBAC hook).
- `packages/approval-engine/` (foundation: request/decision/scope).
- `packages/evidence/` (EvidenceItem/Bundle domain — the package; BrowserMesh's `evidence/` reuses it).
- `packages/agent-definition/` with `definitions/ contracts/ authority/ autonomy/ communication/ versioning/` — but only `contracts/` + `versioning/` get real files now (AgentDefinition, BehaviorContract, AuthorityPolicy, AutonomyPolicy, CommunicationContract, AgentResponseSchema).
- `packages/agent-runtime/` — only `sessions/ state/` now (SessionState, SessionEvent, SessionSnapshot, StateReducer).
- `workers/` root + `workers/dispatcher/` + `workers/scheduler/` (Job Engine execution: queued→claimed→running→completed→evidence).
- `supabase/migrations/` first files: `infra_ops` (approvals, evidence, incidents, notifications), Job Engine tables, session-core primitives.
- *why:* Job Engine + Evidence + Policy + the state primitives are the substrate every later wave stands on (dependency graph line: Operating Core precedes everything).

**WAVE 2 — Agent Birth + Prompt Compiler.** Create:
- `packages/agent-factory/` (`discovery/ documentation-intake/ requirement-extractor/ source-provenance/ compiler/ certification/ publishing/`).
- `packages/prompt-compiler/` (`modules/ compiler/ validation/ hashing/ versions/`).
- `packages/skill-registry/` (`discovery/ routing/ loader/ validation/`).
- `packages/tool-registry/` (`discovery/ capabilities/ search/ schemas/ authorization/`).
- `packages/agent-definition/` — now fill `authority/ autonomy/ communication/` fully; add InstructionHierarchy.
- `packages/agent-runtime/` — add `guardrails/ verification/`.
- `packages/agent-evals/` (`golden/ behavior/ identity/ tools/ handoff/ injection/ security/`) — certification needs it.
- `workers/eval-worker/`.
- `supabase/migrations/`: `agentdef_core`, `agentdef_contracts` + RLS + pgTAP.
- *why:* Dependency-graph hard rule — Agent Factory must exist before any agent is migrated/created en masse.

**WAVE 3 — Session-Aware Runtime MVP.** Create:
- `packages/agent-runtime/` — fill `runtime/ context/ memory/ handoff/ tools/` (Context Compiler, Budget, Structured Compaction, Context Hash, Handoff Pack, Emergency Handoff, Continuity Validator, Tool Runtime, Tool Idempotency, Session/Customer Memory, Memory Gate).
- `packages/model-router/` (`providers/ registry/ routing/ scoring/ locks/ quota/ drain/ health/ circuit-breaker/`). `providers/` first files: `mock/`, `gemini/`, `groq/`.
- `packages/memory/` (durable memory domain — distinct from runtime's session memory).
- `workers/agent-worker/`, `workers/model-health-worker/`.
- `supabase/migrations/`: `session_core`, `session_routing` (agent_sessions, snapshots, checkpoints, model_locks, model_handoffs, tool_calls, tool_state, model_registry, model_capabilities, provider_quotas, model_usage, routing_decisions, memory_candidates, customer_memories, eval_suites, eval_runs, model_scores) + RLS + isolation pgTAP.
- *why:* Runtime is the spine; needs Factory (compiled prompts) and Operating Core (state, evidence) already present.

**WAVE 4 — BrowserMesh + Shift OS.** Create:
- `runtimes/browsermesh/` — full subtree per Part A: `core/ daemon/ transport/ sandbox/ security/ evidence/ adapters/`. Adapters this wave: `_base/`, `shell/`, `git/`, `claude/`, `codex/`, plus `maestri/` and `hermes/` stubs, `browser/` (Steel-first).
- `packages/shift-os/` (`shift-planner/ wake/ sleep/ capacity/ queue-monitor/ concurrency-governor/ resource-router/`). `resource-router.ts` per Part B.3.
- `infra/browsermesh/` (node bring-up), `infra/cloud/` (`burst.sh`, `reaper.sh`, `cost-guard.sh`, `spend-report.sh`), `infra/linux/` (home node config), `infra/vps/` (metrics-push, health-selfcheck — daemon NOT installed here).
- `supabase/migrations/`: `browsermesh` (nodes, jobs, events, leases, host_metrics, artifacts) — `nodes`/`provider_quotas` global, rest tenant+RLS.
- `workers/build-worker/`, `workers/cleanup-worker/` (metrics rollups, evidence TTL sweep).
- *why:* Execution plane + placement; everything heavy from here down runs through it.

**WAVE 5 — Command Center.** Create:
- `apps/crm/app/command/` (Overview, Chat, Agents, Workforce, Jobs, Workflows, Activity, Sessions, Infrastructure, Dev, Approvals, Incidents, Costs).
- `apps/crm/lib/bm-transport/` (client into `runtimes/browsermesh/transport`), Infrastructure dashboard wiring to `host_metrics` (B.7), Costs panel to `spend.log`/burst ledger.
- `workers/notification-worker/`.
- *why:* First operator surface over everything Waves 1–4 produced.

**WAVE 6 — Studio Commercial MVP.** Create:
- `packages/studio-spec/` (ProjectSpec, stable IDs, mutation/patch/versioning).
- `packages/studio-templates/`, `packages/studio-components/`, `packages/studio-renderer/` (preview).
- `apps/crm/app/studio/` routes + `apps/client-portal/` (opaque-token portal).
- `workers/studio-worker/`.
- `supabase/migrations/`: `studio_domain` (studio_projects…studio_deployments) + RLS.
- *why:* First Product Delivery slice; needs Command Center + runtime + BrowserMesh render jobs.

**WAVE 7 — Studio Editor.** Create `packages/studio-canvas/` (UI Canvas, inspector, patches, undo/redo, AI edits, variant mixing). Extends `studio-spec` mutation. No new infra.

**WAVE 8 — Asset Intelligence.** Create `packages/asset-engine/` (Magic Layers, OCR, vectorization, segmentation, LayerManifest, Reverse Design, Semantic UI Mapper). Add `runtimes/browsermesh/adapters/ffmpeg/` real impl + `adapters/remotion/`. `workers/` reuse studio-worker with an asset queue namespace.

**WAVE 9 — Product Factory Web.** Create:
- `packages/project-generator/` (`architect/ build-planner/ generators/{website,webapp,db,auth,api}/ git-factory/ testing-gen/ qa-repair/`) + `release-manifest.schema.json` + `DeploymentTarget` type (D.1).
- `integrations/cloudflare/`, `integrations/neon/` (deploy adapters, D.4).
- `workers/deploy-worker/`.
- `supabase/migrations/`: `customer_delivery` (customer_projects, project_repositories, project_environments, project_resources, project_releases, project_domains, project_health_checks) + RLS (metadata only).
- `infra/deploy/lumenva/` runbook scripts also land here (Lumenva's own deploy formalized alongside the customer pipeline).

**WAVE 10 — Mobile + Delivery.** Extend `project-generator/generators/mobile/` (Expo/RN). Create `integrations/vercel/` (alt seam), production deploy + monitoring + `project_health_checks` polling in `workers/deploy-worker`. Release management + maintenance loops. Full backup/DR crontab (Part E) installed and the weekly `restore-test.sh` activated.

**WAVE 11 — Unified Business Integrations.** Create `integrations/google/`, `integrations/meta/`, `packages/integrations/` (canonical conversation/message/participant/channel mapping), `workers/integration-worker/`. Voice/Realtime engineering slots in here.

**WAVE 12 — Marketing + Video.** Create `packages/asset-engine/` marketing extensions, `workers/marketing-worker/`. `runtimes/browsermesh/adapters/ffmpeg` + `remotion` promoted to production quality (loudnorm, rendition matrix). Video pipeline: script→storyboard→assets→voice→captions→Remotion→FFmpeg→QA→export as BrowserMesh HEAVY jobs on `cloud`.

**WAVE 13 — Hermes + Advanced Memory.** Create `packages/memory/` advanced (semantic/episodic/procedural/operational, knowledge graph), fill `runtimes/browsermesh/adapters/hermes/`, `workers/memory-worker/` advanced. Learning candidates → governed promotion (no auto).

**WAVE 14 — Evals + Agent Evolution.** Extend `packages/agent-evals/` (continuous regression, cross-model qualification, behavior fingerprints, provider certification). `workers/eval-worker/` scaled. No new infra packages.

**WAVE 15 — Autonomy + Optimization.** Extend `packages/shift-os/` (workforce/host/quota prediction), `packages/model-router/scoring/` (free-first optimization), progressive-autonomy config in `packages/policy-engine/`. Cost optimization reads the burst ledger. No new packages.

### F.1 `integrations/` and `infra/` creation summary

| Dir | Created in | First real content |
|---|---|---|
| `integrations/github/` | Wave 1 (bundle/push needs) → real in Wave 4 (git adapter) | deploy key wiring, `git ls-remote` guard |
| `integrations/supabase/` | Wave 1 | migration/baseline/manifest tooling |
| `integrations/cloudflare/` | Wave 9 | Pages/Workers/R2 deploy adapter |
| `integrations/neon/` | Wave 9 | branch DB provision + migrate + PITR |
| `integrations/vercel/` | Wave 10 | alt deploy adapter behind seam |
| `integrations/google/`,`meta/` | Wave 11 | OAuth + canonical mappers |
| `integrations/payments/` | Wave 9 (customer products may need) | provider adapter, no execution of transfers |
| `infra/vps/` | Wave 4 | metrics-push, health-selfcheck |
| `infra/linux/` | Wave 4 | home node daemon unit + pnpm-store-per-node |
| `infra/cloud/` | Wave 4 | burst/reaper/cost-guard |
| `infra/browsermesh/` | Wave 4 | node bring-up + base snapshot bake |
| `infra/deploy/` | Wave 9 | Lumenva runbook + customer pipeline glue |
| `infra/monitoring/` | Wave 5 | dashboard queries, alert rules |
| `infra/backups/`,`infra/disaster-recovery/` | Wave 10 (scripts staged Wave 4) | crontab, restore-test, DR runbooks |

---

## PART G — CONSOLIDATED EFFORT + DEPENDENCIES

| Block | Eng-days | Hard prerequisites |
|---|---|---|
| BrowserMesh (Part A) | ~77 | Job Engine tables (W1), Policy Engine (W1), Prompt Compiler (W2), Infisical, Supabase Storage |
| Compute topology / Resource Router / burst / cost guard / git-bundle / host metrics (Part B) | ~19 | BrowserMesh transport + daemon, `browsermesh.nodes`, hcloud API token |
| Supabase migration/baseline/manifest workflow + all new-domain migrations (Part C) | ~21 | supabase CLI setup (exists), schema designs from W1/W2/W3/W4/W6/W9/W10 |
| Deployment: Lumenva runbook + customer pipeline + Release Manifest + deploy adapters (Part D) | ~35 | BrowserMesh shell/git adapters, DeploymentTarget seam, Neon/Cloudflare accounts, Approval Engine |
| Backup / DR / recovery (Part E) | ~15 | Storage buckets, `age` key, burst infra, `db:verify` |
| **Execution + Infra grand total** | **~167 eng-days** | (parallelizable across 2–3 infra engineers → ~10–12 calendar weeks) |

Critical path: `packages/shared` → Job Engine (W1) → BrowserMesh `core`+`transport`+`daemon`
(W4) → `sandbox`+`security` (W4) → `adapters/shell`+`git` (W4) → Resource Router + burst (W4) →
everything heavy downstream. Prompt Compiler (W2) gates `adapters/claude`. DeploymentTarget seam
(W9) gates both deploy adapters. Nothing in Part D/E can complete before BrowserMesh shell+git
adapters exist.

Sequencing note for the owner's "maximum parallelism" goal: the BrowserMesh daemon + shell/git
adapters + Resource Router + burst scripts (~35 of the 167 days) are the unlock — once those
land, every subsequent wave's build/test/render/deploy work fans out across home Linux + burst
cloud + Codex automatically, and the infra work itself parallelizes with Waves 5+.

---

## PART H — OPEN DECISIONS: FINAL PICKS + SWAP SEAMS (blueprint 28)

| Open decision | Pick | Swap seam (keeps it reversible) |
|---|---|---|
| Default infra for generated customer products | **Cloudflare Pages/Workers + Neon Postgres** (Supabase Auth/Storage only when the product needs hosted auth/files; else Cloudflare Access + R2) | `DeploymentTarget` type in `packages/project-generator` + `integrations/<provider>/deploy-adapter.ts` implementing `provision/deploy/promote/healthcheck/rollback/destroy`. Default is one constant `DEFAULT_DEPLOYMENT_TARGET`. ProjectSpec never names a provider (ADR-021, blueprint 28). |
| AgentDefinition persistence split | **Preserve existing agent identity records; add new versioned contract tables (`behavior_contracts`, `authority_policies`, … `compiled_prompt_versions`) with FK to the identity row** | `packages/agent-definition/versioning/` is the only writer; a `AgentDefinitionRepository` interface hides whether a field lives on the legacy table or a contract table. Migrating a column later = repo change, no caller change. |
| Framework boundary: custom runtime vs provider SDK | **Custom runtime owns canonical state/identity/policy/memory/routing/handoff/loop. Provider SDKs are call-transport only, behind `ModelProvider` adapters and BrowserMesh adapters.** | `ModelProvider` interface (`generate/stream/health/getQuota/capabilities/normalizeError`) + a Lumenva-owned `Session` passed into every call. Provider-side threads/assistants treated as disposable cache keyed by Lumenva `session_id`. New provider = new folder under `model-router/providers/`, register as `candidate`, eval, promote. |

---

## SUMMARY

This document turns the blueprint's Execution/Infra sections into buildable specs with no open
"maybe". BrowserMesh becomes a concrete monorepo subtree (`runtimes/browsermesh/` with
`core/daemon/transport/sandbox/security/evidence/adapters`), an outbound-only node daemon with a
Postgres queue-table transport (10s heartbeat, 45s lease renewed every 15s, race-free
`FOR UPDATE SKIP LOCKED` claim, streamed evidence upload with a sha256 merkle manifest), a
per-adapter capability-grant sandbox (Linux namespaces+cgroups+nftables, weak `sandbox-exec` on
Mac, no daemon on the VPS), and full specs for the Claude, Codex, Shell, Git and FFmpeg adapters.
The compute topology runs maximum parallel work across home Linux + on-demand Hetzner CX53 burst
boxes (`lumenva-crm-gate-*`, TTL+orphan reaper, €15/mo cost guard, ID `162985793` fenced off) +
Codex + optional Mac, with a scored Resource Router and `git bundle`-over-artifact-store source
delivery since work branches never hit GitHub. The Supabase workflow is fixed as
migration+baseline+manifest with `schema.lock`, forward-only enforcement, and per-domain RLS/pgTAP
for the agent-definition, session, studio, customer-delivery, browsermesh and infra-ops domains.
Deployment is a scripted runbook (build on Linux/cloud → artifact → `scp`+symlink-activate on the
VPS → healthcheck → finalize, with an R3 gate before migrations and a symlink-flip rollback),
GitHub Actions stay off, and customer products get a branch→preview→client-approval→prod pipeline
with a real JSON-Schema Release Manifest. Backup/DR is a concrete crontab (daily `pg_dump`,
nightly encrypted memory/agent exports, nightly `git bundle --all`, weekly copy to VPS, weekly
automated restore drill with RTO 30 min / RPO 24h). The two open decisions resolve to
Cloudflare+Neon (behind a `DeploymentTarget` adapter seam) and a custom runtime that owns all
canonical state with provider SDKs confined to `ModelProvider` adapters. Every `packages/` +
`runtimes/` + `workers/` directory is mapped to the wave that first creates it, and infra effort
totals ~167 engineer-days with the BrowserMesh daemon + shell/git adapters + Resource Router +
burst scripts (~35 days) as the parallelism unlock on the critical path.
