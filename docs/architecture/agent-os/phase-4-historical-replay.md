# Phase 4 Historical Replay Evidence

## Status

Implementation is complete enough to support tenant-scoped historical replay sampling through `lib/agent-engine/evals/historical-sampler.ts`, but historical replay execution evidence is **pending final verification**.

The user explicitly approved completing Phase 4 implementation without per-task test execution while away from the local Windows runner. Therefore this document records the implementation boundary and the evidence still required; it does not claim historical replay GO.

## Safety boundary

Historical replay is evaluation-only. It must remain:

- organization-scoped;
- read-only with respect to authoritative CRM/business state;
- incapable of outbound WhatsApp, email, campaign, webhook or other customer-visible communication;
- incapable of direct CRM mutation;
- marked as `historical_replay` / `eval_replay` when entering the canonical Agent Kernel;
- sanitized before repository evidence is produced;
- free of raw email/phone fields in committed fixtures or documentation.

`createHistoricalReplaySampler()` receives an injected read port instead of a concrete database client. It rejects candidates returned for another organization, sorts deterministically for reproducibility, applies a per-bucket cap, and removes obvious direct email/phone fields before replay artifacts leave the sampler.

## Required final replay evidence

Before Phase 4 can be marked GO, run a safe read-only replay and record only sanitized aggregate evidence here:

- exact organization/environment classification used for evaluation;
- exact sample counts per Product Agent;
- at least 20 historical cases per applicable Product Agent before historical metrics count toward GO;
- bucket coverage per agent;
- human-vs-agent divergence classes;
- missing/insufficient evidence counts;
- confirmation of zero authoritative CRM mutations;
- confirmation of zero external sends;
- exact numerator/denominator for measured routing, escalation, factual and quality metrics.

Governance/Judge may be documented as not historically applicable where no meaningful historical human-reference corpus exists; deterministic golden evidence must then be reported explicitly instead.

## Current evidence state

At implementation freeze preparation time, no raw production/customer transcript was queried or committed for this document. The historical replay gate is therefore **INCOMPLETE**, not failed.

This file must be updated with sanitized exact counts after the final replay execution. If those results reveal a runtime defect, the Phase 4 code SHA must change and the final technical gate must be repeated.
