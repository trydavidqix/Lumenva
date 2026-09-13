# Lumenva AI Creator Commerce + Revenue OS — Inline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` only. This plan is intentionally **inline-only**: no subagents, no delegated reviewers, no agent teams.

**Goal:** Turn the existing Lumenva Business OS into a provider-neutral Creator Commerce + Revenue OS that connects content, channels, products, offers, clicks, conversions, commissions, payouts and attributed revenue, while preserving the existing CRM Control Plane, Postgres Source of Truth, Content OS, Agent OS, Event Log, approvals, risk model and provider boundaries.

**Architecture:** Extend the existing system instead of creating a parallel runtime. Content OS remains the editorial and publishing domain; existing e-commerce adapters remain the commerce boundary; a new Lumenva Connect facade unifies provider capability discovery and routing; Creator Commerce adds commercial content/product/offer semantics; Revenue OS stores normalized financial truth and attribution; deterministic workers synchronize provider facts; agents only analyze, propose and execute allowed actions through existing governance.

**Tech Stack:** Next.js/TypeScript, Supabase/Postgres/RLS, Vitest, existing `event_log`, existing Content OS provider registry/distribution services, existing Nuvemshop adapter/webhooks, existing Agent OS/risk/approval infrastructure, existing Command Center UI patterns.

**Spec:** `docs/business-os/AI-CREATOR-COMMERCE-BLUEPRINT.md`

## Global Constraints

- Work only on the implementation branch `implementation/ai-creator-commerce-revenue-os-2026-09-13` created from `plan/ai-creator-commerce-revenue-os-2026-09-13`.
- Never merge, rebase, fast-forward, force-update or write to `main`.
- Execute inline in one session; no subagents, no teams, no delegated coding or review.
- Keep Postgres as Source of Truth; do not introduce another database, event bus, scheduler, approval system, memory system or agent runtime.
- Reuse the existing Content OS, `event_log`, Agent OS, risk model, approvals, Nuvemshop integration and provider patterns.
- All tenant-owned tables must have `organization_id`, RLS and explicit organization filters whenever an admin/service-role client is used.
- Never accept `organization_id` from an untrusted request body as tenant identity; derive tenant from authenticated server context.
- No secrets in prompts, logs, event payloads or plaintext application tables.
- API official/provider adapter first. Browser-assisted execution is a fallback only when an allowed capability exists but no direct API is available.
- `UNKNOWN` country/provider capability never means `ALLOW`.
- Commercial publication must pass existing editorial quality gates plus commerce compliance gates.
- Provider side effects must be idempotent and must never be reported as successful until confirmed by the provider or a reconciliation worker.
- Revenue OS measures real financial outcomes; vanity metrics alone never count as revenue success.
- P2+ actions must emit durable evidence/receipts through existing governance/event infrastructure.
- TDD for each domain unit: failing test -> minimal implementation -> passing test -> focused commit.
- Do not deploy to production, mutate real provider credentials, activate real payouts, or run destructive production migrations as part of repository implementation.

---

## File/Module Map

The implementation should converge on these domain boundaries. Existing files are modified only where the new contract must connect to existing behavior.

### Creator Commerce domain
- `apps/crm/lib/creator-commerce/contracts.ts` — canonical creator/product/offer/campaign/variant IDs and domain types.
- `apps/crm/lib/creator-commerce/compliance.ts` — deterministic commercial publication gate.
- `apps/crm/lib/creator-commerce/country-capabilities.ts` — ALLOW/REVIEW_REQUIRED/DENY/UNKNOWN evaluation.
- `apps/crm/lib/creator-commerce/experiments.ts` — variant experiment definitions and winner evaluation.
- `apps/crm/lib/creator-commerce/service.ts` — orchestration across Content OS, Connect, attribution and Revenue OS without provider-specific logic.
- `apps/crm/lib/creator-commerce/index.ts` — public facade.

### Lumenva Connect
- `apps/crm/lib/connect/contracts.ts` — provider families and normalized capability contract.
- `apps/crm/lib/connect/registry.ts` — provider registry/facade over existing provider-specific adapters.
- `apps/crm/lib/connect/capability-service.ts` — country/provider capability checks.
- `apps/crm/lib/connect/health.ts` — normalized provider health.
- `apps/crm/lib/connect/index.ts` — public facade.

### Revenue OS
- `apps/crm/lib/revenue/contracts.ts` — canonical sales/payment/refund/commission/payout/attribution types.
- `apps/crm/lib/revenue/ledger.ts` — append/update rules for normalized financial facts.
- `apps/crm/lib/revenue/attribution.ts` — deterministic attribution model and confidence/evidence.
- `apps/crm/lib/revenue/metrics.ts` — GMV, gross/net revenue, commission, EPC, revenue/video and related aggregates.
- `apps/crm/lib/revenue/reconciliation.ts` — provider-to-ledger reconciliation and unknown-outcome handling.
- `apps/crm/lib/revenue/service.ts` — tenant-scoped queries and write orchestration.
- `apps/crm/lib/revenue/index.ts` — public facade.

### Existing integration seams to extend
- `apps/crm/lib/content-os/events.ts`
- `apps/crm/lib/content-os/providers/distribution.ts`
- `apps/crm/lib/content-os/providers/registry.ts`
- `apps/crm/lib/content-os/distribution/publication-service.ts`
- `apps/crm/lib/content-os/distribution/metrics-service.ts`
- `apps/crm/lib/content-os/orchestrator.ts`
- `apps/crm/lib/ecommerce/types.ts`
- `apps/crm/lib/ecommerce/index.ts`
- existing Nuvemshop adapter/webhooks/services
- existing Agent OS governance/risk/approval seams

### API and UI
- `apps/crm/app/api/v1/creator-commerce/**`
- `apps/crm/app/api/v1/revenue/**`
- `apps/crm/app/api/v1/connect/**`
- `apps/crm/app/app/command/creator-commerce/**` or the exact existing Command Center route convention discovered during execution
- focused components under `apps/crm/components/creator-commerce/**`

### Database
- new migration(s) after the latest repository migration number.
- update `supabase/baseline.sql` and `supabase/migrations/MANIFEST.md` in the same task as the schema migration.
- regenerate DB types with the repository-supported generator; never hand-edit generated types.

---

### Task 0: Branch lock, doctrine read and baseline verification

**Files:** no product code changes.

**Produces:** isolated implementation branch and a verified baseline.

- [ ] Create `implementation/ai-creator-commerce-revenue-os-2026-09-13` from `plan/ai-creator-commerce-revenue-os-2026-09-13`.
- [ ] Record both the implementation branch starting SHA and the current `main` SHA.
- [ ] Read `AGENTS.md`, `CLAUDE.md`, database migration rules, multi-tenancy rules, testing rules, architecture docs, current Content OS docs and current channel/e-commerce provider contracts.
- [ ] Run the repository baseline verification suite available in the execution environment before feature edits.
- [ ] Record all pre-existing failures separately so later validation can distinguish inherited failures from implementation regressions.
- [ ] Commit only if a branch-local execution note is needed; otherwise keep Task 0 code-free.

### Task 1: Canonical Creator Commerce contracts

**Files:**
- Create: `apps/crm/lib/creator-commerce/contracts.ts`
- Create: `apps/crm/lib/creator-commerce/contracts.test.ts`
- Create: `apps/crm/lib/creator-commerce/index.ts`

**Interfaces:**
- Produces IDs/types consumed by Revenue OS, Content OS metadata, experiments and APIs.

- [ ] Write tests that reject missing tenant identity and malformed creator/product/offer/campaign/variant identifiers.
- [ ] Define canonical types for `CreatorProfileRef`, `CommerceProductRef`, `OfferRef`, `CampaignRef`, `CreativeVariantRef`, `CommerceContentRef` and normalized market/language fields.
- [ ] Add status enums for creator/product/offer/campaign lifecycle without provider-specific values leaking into the domain.
- [ ] Add helper that produces a stable attribution dimension object from `{creatorId, productId, offerId, campaignId, creativeVariantId, contentId}`.
- [ ] Run focused tests.
- [ ] Commit: `feat(creator-commerce): add canonical commerce contracts`.

### Task 2: Country Capability Gate

**Files:**
- Create: `apps/crm/lib/creator-commerce/country-capabilities.ts`
- Create: `apps/crm/lib/creator-commerce/country-capabilities.test.ts`

**Interfaces:**
- Produces `evaluateCountryCapability(input): CapabilityDecision` where decision is `ALLOW | REVIEW_REQUIRED | DENY | UNKNOWN`.

- [ ] Test that `UNKNOWN` never becomes `ALLOW`.
- [ ] Test precedence: `DENY` overrides `REVIEW_REQUIRED`; expired/stale evidence degrades to `UNKNOWN` or `REVIEW_REQUIRED` according to policy.
- [ ] Define normalized fields: provider, country, capability, status, requirements, termsVersion, lastVerifiedAt, source/evidence refs.
- [ ] Implement deterministic decision evaluation with no LLM dependency.
- [ ] Run tests.
- [ ] Commit: `feat(connect): add country capability gate`.

### Task 3: Commercial Compliance Gate

**Files:**
- Create: `apps/crm/lib/creator-commerce/compliance.ts`
- Create: `apps/crm/lib/creator-commerce/compliance.test.ts`

**Interfaces:**
- Consumes existing editorial quality result and country capability decision.
- Produces `PASS | REVIEW_REQUIRED | BLOCK` plus machine-readable reasons/evidence.

- [ ] Test blocks for failed editorial quality, prohibited claims, missing commercial disclosure, identity/likeness restrictions and country/provider denial.
- [ ] Test review-required behavior for unresolved/unknown capability.
- [ ] Implement deterministic gate composition; no model may override a hard block.
- [ ] Ensure every output includes evidence refs and rule identifiers.
- [ ] Run tests.
- [ ] Commit: `feat(creator-commerce): add commercial compliance gate`.

### Task 4: Revenue OS schema and RLS foundation

**Files:**
- Create: next numbered migration, containing only Creator Commerce/Revenue OS schema required by this project.
- Modify: `supabase/baseline.sql`
- Modify: `supabase/migrations/MANIFEST.md`
- Regenerate: repository DB types file(s)
- Add/modify migration/RLS invariant tests.

**Produces:** durable tenant-isolated tables for:
`creator_profiles`, `commerce_products`, `commerce_offers`, `commerce_campaigns`, `creative_variants`, `provider_country_capabilities`, `sales`, `sale_items`, `payments`, `refunds`, `chargebacks`, `affiliate_programs`, `affiliate_links`, `affiliate_conversions`, `commissions`, `payouts`, `attributions`, `revenue_snapshots`, `revenue_goals`, `commerce_experiments`, `commerce_experiment_variants`.

- [ ] Write migration-contract tests first for required columns, constraints, indexes and RLS.
- [ ] Every tenant table gets `organization_id` and organization-first indexes on hot access paths.
- [ ] Add provider/external-id uniqueness constraints needed for idempotent reconciliation.
- [ ] Model money in integer minor units plus ISO currency code; never floating-point money.
- [ ] Model append-only provider facts/evidence where history matters; do not overwrite audit history.
- [ ] Add RLS for each tenant table.
- [ ] Append the migration to baseline and MANIFEST in the same task.
- [ ] Regenerate DB types using the project-supported command.
- [ ] Run migration/RLS/type checks.
- [ ] Commit: `feat(revenue): add revenue and creator commerce schema`.

### Task 5: Revenue canonical ledger

**Files:**
- Create: `apps/crm/lib/revenue/contracts.ts`
- Create: `apps/crm/lib/revenue/ledger.ts`
- Create: `apps/crm/lib/revenue/ledger.test.ts`
- Create: `apps/crm/lib/revenue/index.ts`

**Interfaces:**
- Produces normalized write functions for sale/payment/refund/chargeback/commission/payout facts.

- [ ] Test idempotent upsert by `{organizationId, provider, externalId}`.
- [ ] Test organization mismatch rejection.
- [ ] Test refund/chargeback cannot silently mutate original sale evidence.
- [ ] Implement normalized ledger writes using tenant-scoped repository interfaces.
- [ ] Preserve provider raw references only as evidence metadata, not as business-domain truth.
- [ ] Run tests.
- [ ] Commit: `feat(revenue): add canonical financial ledger`.

### Task 6: Attribution Engine

**Files:**
- Create: `apps/crm/lib/revenue/attribution.ts`
- Create: `apps/crm/lib/revenue/attribution.test.ts`

**Interfaces:**
- Produces `attributeConversion(input): AttributionResult[]` with explicit model, confidence, evidence and dimensions.

- [ ] Test exact click/sub-id match outranks weaker UTM/referrer evidence.
- [ ] Test no fabricated attribution when evidence is insufficient.
- [ ] Implement deterministic priority for click_id/sub_id/provider conversion IDs, then UTM/content dimensions, then explicit unknown/unattributed result.
- [ ] Persist creator/product/offer/campaign/content/variant relationships only when supported by evidence.
- [ ] Preserve multi-touch evidence even if MVP chooses a single primary attribution.
- [ ] Run tests.
- [ ] Commit: `feat(revenue): add attribution engine`.

### Task 7: Revenue metrics and KPI engine

**Files:**
- Create: `apps/crm/lib/revenue/metrics.ts`
- Create: `apps/crm/lib/revenue/metrics.test.ts`

**Produces:** deterministic metrics for GMV, gross revenue, net revenue, commission pending/approved/paid, refunds, chargebacks, conversion rate, CTR, EPC, revenue per 1k views, revenue/video, revenue/creator, revenue/product, revenue/campaign and margin where inputs permit.

- [ ] Test all money calculations in integer minor units.
- [ ] Test division-by-zero behavior returns null/undefined rather than fake zero where semantics differ.
- [ ] Test grouped metrics never cross organization boundaries.
- [ ] Implement pure calculation functions before persistence/query adapters.
- [ ] Run tests.
- [ ] Commit: `feat(revenue): add revenue KPI engine`.

### Task 8: Lumenva Connect provider-neutral contracts

**Files:**
- Create: `apps/crm/lib/connect/contracts.ts`
- Create: `apps/crm/lib/connect/registry.ts`
- Create: `apps/crm/lib/connect/registry.test.ts`
- Create: `apps/crm/lib/connect/index.ts`

**Interfaces:**
- Provider families: commerce, marketplace, affiliate, payment, social_commerce, publishing.
- Normalized capability verbs: connect, disconnect, healthCheck, initialSync, incrementalSync, registerWebhooks, handleWebhook, refreshCredentials, getProducts, getOrders, getSales, getCommissions, getRefunds, getPayouts.

- [ ] Test provider registration/resolution and missing-capability behavior.
- [ ] Implement capability declaration rather than assuming every provider supports every verb.
- [ ] Wrap existing Content OS distribution providers and existing e-commerce adapter contracts instead of duplicating them.
- [ ] Run tests.
- [ ] Commit: `feat(connect): add provider-neutral gateway`.

### Task 9: Adapt existing Nuvemshop into Lumenva Connect

**Files:**
- Modify: `apps/crm/lib/ecommerce/types.ts`
- Modify: `apps/crm/lib/ecommerce/index.ts`
- Modify existing Nuvemshop adapter/services only as required.
- Add focused adapter contract tests.

**Interfaces:**
- Nuvemshop becomes the first commerce provider proving `getProducts/getOrders/getSales/getRefunds/healthCheck` capabilities through Connect.

- [ ] Write contract tests around existing Nuvemshop behavior first.
- [ ] Add a thin adapter from current e-commerce contracts to Connect; do not rewrite working OAuth/webhook code.
- [ ] Keep webhook signature verification and tenant lookup in existing hardened path.
- [ ] Ensure normalized provider outputs carry external IDs, provider refs and event timestamps for reconciliation.
- [ ] Run Nuvemshop and Connect tests.
- [ ] Commit: `feat(connect): expose Nuvemshop through Connect`.

### Task 10: Provider health and capability service

**Files:**
- Create: `apps/crm/lib/connect/health.ts`
- Create: `apps/crm/lib/connect/capability-service.ts`
- Create tests for both.

- [ ] Normalize provider health into healthy/degraded/unavailable/auth_expired/unknown plus evidence.
- [ ] Combine provider-declared capability, country gate and tenant connection state into one query result.
- [ ] Never advertise a capability as available when country status is UNKNOWN/DENY or provider connection lacks required auth.
- [ ] Run tests.
- [ ] Commit: `feat(connect): add provider health and capability resolution`.

### Task 11: Revenue synchronization and reconciliation

**Files:**
- Create: `apps/crm/lib/revenue/reconciliation.ts`
- Create: `apps/crm/lib/revenue/reconciliation.test.ts`
- Extend existing worker/job boundary rather than create a scheduler.

**Interfaces:**
- Consumes normalized provider sales/refunds/commissions/payouts.
- Produces idempotent Revenue OS facts and reconciliation findings.

- [ ] Test replay safety and duplicate provider events.
- [ ] Test unknown side-effect/outcome requires reconciliation instead of optimistic success.
- [ ] Test provider correction creates durable corrective state/evidence.
- [ ] Implement incremental sync cursor/checkpoint interface compatible with existing worker patterns.
- [ ] Run tests.
- [ ] Commit: `feat(revenue): add provider reconciliation`.

### Task 12: Extend Content OS commercial metadata and events

**Files:**
- Modify: `apps/crm/lib/content-os/events.ts`
- Modify: editorial/publication metadata seams only where needed.
- Add tests around event schema and commercial dimensions.

**Produces:** content events that can carry references to creator, product, offer, campaign and variant without coupling Content OS to provider specifics.

- [ ] Add backward-compatible optional commercial refs to event/domain metadata.
- [ ] Add event names required by the blueprint where they belong in existing event families: product discovered/shortlisted, attribution created, revenue anomaly, experiment lifecycle and winner detected.
- [ ] Keep existing event_log as the only durable event bus.
- [ ] Run event contract tests.
- [ ] Commit: `feat(content): link content events to commerce dimensions`.

### Task 13: Publishing path commerce gate integration

**Files:**
- Modify: `apps/crm/lib/content-os/distribution/publication-service.ts`
- Modify: `apps/crm/lib/content-os/orchestrator.ts` only at the existing publication/quality seam.
- Add focused tests.

- [ ] Write tests proving a passed editorial gate is still insufficient when commerce compliance blocks.
- [ ] Require a commerce compliance receipt for commercial content before provider publication jobs are created.
- [ ] Preserve existing idempotency semantics and provider-confirmation semantics.
- [ ] Non-commercial content must continue working without Creator Commerce metadata.
- [ ] Run publication/orchestrator tests.
- [ ] Commit: `feat(content): enforce commerce gate before commercial publication`.

### Task 14: Distribution metrics -> revenue attribution bridge

**Files:**
- Modify: `apps/crm/lib/content-os/distribution/metrics-service.ts`
- Create: small bridge module under `apps/crm/lib/creator-commerce/` or `apps/crm/lib/revenue/` based on repository conventions.
- Add tests.

- [ ] Preserve canonical engagement metrics.
- [ ] Link publication_job_id/content_id to attribution dimensions.
- [ ] Do not infer sales from engagement metrics.
- [ ] Emit a normalized observation for the learning/experiment layer after metrics snapshots are persisted.
- [ ] Run tests.
- [ ] Commit: `feat(revenue): connect content performance to attribution dimensions`.

### Task 15: Affiliate program and commission lifecycle

**Files:**
- Create focused repository/service modules under `apps/crm/lib/revenue/affiliate/` or the repository-consistent equivalent.
- Add tests.

**Interfaces:**
- Normalize program, link, conversion, commission and payout lifecycle independent of Amazon/Hotmart/Awin/etc.

- [ ] Test commission states pending/approved/reversed/paid.
- [ ] Test commission currency and amount reconciliation.
- [ ] Test affiliate conversion can exist before commission becomes final.
- [ ] Test payout references cannot retroactively fabricate sale attribution.
- [ ] Implement provider-neutral affiliate domain/service.
- [ ] Run tests.
- [ ] Commit: `feat(revenue): add affiliate commission lifecycle`.

### Task 16: Creator Commerce experiments and winner engine

**Files:**
- Create: `apps/crm/lib/creator-commerce/experiments.ts`
- Create: `apps/crm/lib/creator-commerce/experiments.test.ts`

**Interfaces:**
- Experiments vary hook, CTA, thumbnail, voice, scene order, length, caption style, product angle, creator, language or market.
- Outcome data comes from Content metrics + Revenue metrics.

- [ ] Test no winner is declared without minimum evidence/window.
- [ ] Test revenue KPI can be selected as primary objective while keeping safety/compliance gates non-bypassable.
- [ ] Test experiment isolation by organization.
- [ ] Implement deterministic comparison and explicit `inconclusive` result.
- [ ] Emit winner evidence rather than self-modifying prompts/config directly.
- [ ] Run tests.
- [ ] Commit: `feat(creator-commerce): add controlled experiment engine`.

### Task 17: Creator Commerce orchestration service

**Files:**
- Create: `apps/crm/lib/creator-commerce/service.ts`
- Create: `apps/crm/lib/creator-commerce/service.test.ts`

**Interfaces:**
- Coordinates planning/status queries across content, connect, revenue and experiments.
- Does not call provider SDKs directly.

- [ ] Test end-to-end domain flow with mocked repositories/providers: content -> publication receipt -> metrics -> sale -> attribution -> revenue snapshot -> experiment result.
- [ ] Test denied country capability prevents publish/commerce action before provider call.
- [ ] Test all cross-domain calls preserve organization identity.
- [ ] Implement the thinnest orchestration layer needed for API/agents.
- [ ] Run tests.
- [ ] Commit: `feat(creator-commerce): add orchestration facade`.

### Task 18: Read APIs for Creator Commerce, Revenue and Connect

**Files:**
- Create tenant-authenticated v1 routes under `apps/crm/app/api/v1/creator-commerce/`, `revenue/`, and `connect/` following existing API wrapper/authz conventions.
- Add route tests.

**Endpoints:**
- overview/status
- creators
- products/offers/campaigns
- content performance
- experiments
- revenue summary
- compare creators/products/campaigns
- commissions/payouts
- attribution detail
- provider health
- country capability check

- [ ] Derive org from trusted auth context.
- [ ] Use `ok()/fail()` convention.
- [ ] Add explicit organization filters even for service-role/admin reads.
- [ ] Return aggregated evidence/receipts, not secrets/raw sensitive provider payloads.
- [ ] Run API tests.
- [ ] Commit: `feat(api): expose creator commerce and revenue reads`.

### Task 19: Governed write APIs

**Files:**
- Create only the minimal action endpoints needed for controlled workflows, using existing policy/risk/approval infrastructure.
- Add route and policy tests.

**Actions:**
- create/update creator profile
- shortlist product/offer
- create campaign/experiment
- request commercial publication
- request provider sync/reconciliation
- low-risk allowed publication execution path only when policy and gates pass

- [ ] Classify each action using existing risk/autonomy model.
- [ ] P3/P4 actions must produce approval requirement rather than execute.
- [ ] No endpoint can bypass country/compliance/tenant gates.
- [ ] Provider side effects must use idempotency keys.
- [ ] Run tests.
- [ ] Commit: `feat(api): add governed creator commerce actions`.

### Task 20: Deterministic worker integration

**Files:**
- Modify existing worker/scheduler/job registration paths; do not create a second scheduler.
- Add worker tests.

**Jobs:**
`provider.healthcheck`, `provider.refresh_auth`, `provider.sync`, `provider.webhook.process`, `creator.analytics.sync`, `content.metrics.sync`, `revenue.aggregate`, `revenue.reconcile`, `affiliate.commission.sync`, `attribution.reconcile`, `revenue.anomaly.scan`.

- [ ] Map each job to an idempotent handler and bounded retry policy.
- [ ] Keep heavy/slow provider work outside request lifecycle.
- [ ] Persist checkpoints before/after side effects according to existing job conventions.
- [ ] Escalate only anomalies/unknown outcomes to agents/humans.
- [ ] Run worker tests.
- [ ] Commit: `feat(workers): schedule creator commerce revenue jobs`.

### Task 21: Revenue anomaly detection

**Files:**
- Create: `apps/crm/lib/revenue/anomalies.ts`
- Create: `apps/crm/lib/revenue/anomalies.test.ts`

- [ ] Detect material refund spikes, commission reversals, revenue drops, payout mismatch and attribution gaps with deterministic thresholds/config.
- [ ] Produce evidence-rich findings only; never auto-change financial truth.
- [ ] Emit existing `event_log` events for agent investigation.
- [ ] Run tests.
- [ ] Commit: `feat(revenue): add deterministic anomaly detection`.

### Task 22: Agent/Maestri capability surface

**Files:**
- Modify existing Agent OS capability/tool registry and policy surfaces only; do not create another agent runtime.
- Add capability/policy tests.

**Capabilities:**
- creator list/get
- product discover/rank
- content plan/status/publish request
- content performance
- affiliate commissions
- revenue summary/comparisons
- provider health
- country capability check
- experiment create/result

- [ ] Tools call domain services, never providers directly.
- [ ] Encode read/write/risk metadata on each capability.
- [ ] Ensure model/tool execution cannot bypass policy or self-grant higher autonomy.
- [ ] Run Agent OS contract tests.
- [ ] Commit: `feat(agent-os): expose creator commerce capabilities`.

### Task 23: MCP/CLI facade if the repository already has the canonical seam

**Files:**
- Extend existing Lumenva MCP/CLI modules discovered during execution; do not create an unrelated standalone CLI package.
- Add contract tests.

- [ ] Map MCP/CLI commands to the same domain services/API contracts used by the app.
- [ ] No direct provider credentials or provider SDK calls from MCP/CLI.
- [ ] Commands reflect blueprint names where consistent with existing CLI conventions: creators, products, content queue/status, affiliate commissions, revenue today/compare, connect health, country check.
- [ ] Run MCP/CLI tests.
- [ ] Commit: `feat(cli): expose governed creator commerce commands`.

### Task 24: Command Center overview

**Files:**
- Create/modify the existing Command Center route hierarchy for `/command/creator-commerce` following actual repo conventions.
- Create focused components under `apps/crm/components/creator-commerce/`.
- Add UI/component tests.

**Overview:** revenue today, commission today, GMV, top creator/product/creative, revenue/video, published today, running experiments, integration health, incidents and approvals.

- [ ] Reuse existing Command Center shell/navigation/design system.
- [ ] Server-fetch from the read APIs/domain queries; no provider calls from React components.
- [ ] Show stale/unknown states explicitly rather than fabricating zeros.
- [ ] Add loading/error/empty states.
- [ ] Run component and route tests.
- [ ] Commit: `feat(command): add creator commerce overview`.

### Task 25: Command Center detail pages

**Files:**
- Add existing-shell pages for creators, products, content, experiments, channels/connect, attribution and revenue.
- Add tests for highest-risk interactions.

- [ ] Creator performance drilldown by revenue/content.
- [ ] Product/offer ranking with evidence and commission/revenue metrics.
- [ ] Content table linking publication metrics to attributed revenue.
- [ ] Experiment detail with variants/evidence/window/winner status.
- [ ] Provider/channel health and country capability status.
- [ ] Attribution trace from sale/conversion back to content/campaign dimensions.
- [ ] Revenue/commission/payout summaries with reconciliation status.
- [ ] Commit: `feat(command): add creator commerce detail views`.

### Task 26: Existing Nuvemshop -> Revenue OS end-to-end proof

**Files:**
- Focused integration tests across Nuvemshop/Connect/Revenue/Attribution.

- [ ] Fixture a Nuvemshop order event through the existing provider normalization seam.
- [ ] Reconcile it into canonical sale/payment data.
- [ ] Link to content/campaign only when attribution evidence exists.
- [ ] Apply a refund event and verify net revenue changes without losing original sale history.
- [ ] Verify replay remains idempotent.
- [ ] Verify organization B cannot read organization A facts.
- [ ] Commit: `test(revenue): prove Nuvemshop revenue pipeline`.

### Task 27: Commercial publication end-to-end proof

**Files:**
- Integration tests spanning Content OS + compliance + distribution + metrics + Revenue OS.

- [ ] Commercial content in ALLOW market + passed gates creates one publication job.
- [ ] UNKNOWN/REVIEW_REQUIRED market cannot silently publish.
- [ ] BLOCK cannot create provider side effect.
- [ ] Provider success changes local publication state only after confirmation.
- [ ] Metrics collection does not fabricate financial outcome.
- [ ] Commit: `test(creator-commerce): prove governed publish pipeline`.

### Task 28: Learning loop integration

**Files:**
- Extend the canonical existing learning/evolution/Hermes seam present in the execution branch; do not create a parallel learner.
- Add tests.

- [ ] Feed experiment/revenue observations as evidence with creator/product/hook/format/market dimensions.
- [ ] Recommendations must retain evidence and temporal window.
- [ ] Learning can propose next experiments/prior changes but cannot bypass policy, compliance or activation governance.
- [ ] Revenue is an outcome signal, not an authority signal.
- [ ] Run learning contract tests.
- [ ] Commit: `feat(learning): add creator commerce revenue outcomes`.

### Task 29: Security, privacy and adversarial tenant verification

**Files:**
- Add/extend invariant/security tests.

- [ ] Prove cross-tenant reads/writes fail for every new table/service/API route.
- [ ] Prove service-role code has explicit organization filters.
- [ ] Prove request bodies cannot override tenant identity.
- [ ] Prove provider secrets are excluded from events/API responses/logs.
- [ ] Prove `UNKNOWN` capability cannot be coerced to ALLOW.
- [ ] Prove hard compliance blocks cannot be overridden by a model/tool result.
- [ ] Prove idempotency key reuse with a different payload returns conflict.
- [ ] Commit: `test(security): harden creator commerce tenant boundaries`.

### Task 30: Observability and operational evidence

**Files:**
- Extend existing audit/event/receipt/incident mechanisms only.
- Add tests where applicable.

- [ ] Add structured events/receipts for provider sync, publication, revenue reconciliation, attribution, experiment completion and anomaly findings.
- [ ] Include organization, entity refs, request/idempotency refs and evidence refs without secrets/PII leakage.
- [ ] Ensure failures distinguish retryable, blocked, provider unavailable, auth expired and reconciliation required.
- [ ] Commit: `feat(observability): add creator commerce evidence trail`.

### Task 31: Architecture and operator documentation

**Files:**
- Update/create architecture docs under existing Business OS/architecture doc conventions.
- Update API/domain diagrams and operational runbooks.

- [ ] Document canonical ownership: Content OS creates/distributes; Connect abstracts providers; Revenue OS owns financial normalization; Attribution links evidence; Agent OS governs actions; Postgres is truth.
- [ ] Document provider onboarding checklist and Country Capability Gate.
- [ ] Document financial reconciliation semantics and unknown-outcome handling.
- [ ] Document how to add Shopify/TikTok/Amazon/Hotmart later without changing core domains.
- [ ] Document emergency disable/rollback paths.
- [ ] Commit: `docs: document creator commerce revenue architecture`.

### Task 32: Full verification and branch completion

**Files:** no new product behavior unless fixing failures discovered by verification.

- [ ] Run all focused Creator Commerce/Connect/Revenue tests.
- [ ] Run Content OS and Nuvemshop regression suites.
- [ ] Run typecheck.
- [ ] Run lint and repository-specific channel/tenant linters.
- [ ] Run unit tests.
- [ ] Run database/RLS/migration tests.
- [ ] Run build.
- [ ] Run governance/harness checks required by repository doctrine.
- [ ] Compare branch diff against the recorded starting SHA and against `main`; verify `main` was never changed.
- [ ] Perform an inline adversarial review of tenant isolation, financial correctness, idempotency, provider side effects, compliance bypass and secret leakage.
- [ ] Fix only verified regressions until all branch-introduced failures are green.
- [ ] Write a completion report with: final branch SHA, migrations, APIs, UI pages, tests run, pre-existing failures (if any), unresolved external/prod-only validation and explicit statement that no merge to `main` occurred.
- [ ] Final commit only if verification fixes or completion docs changed files.

---

## Execution Order / Checkpoints

Execute strictly in this order:

1. Tasks 0–4 establish branch safety, contracts, gates and durable schema.
2. Tasks 5–11 establish Revenue OS + Connect + Nuvemshop proof boundary.
3. Tasks 12–17 wire Content OS, publication, attribution, affiliate and experiment flows.
4. Tasks 18–23 expose governed APIs, jobs and Agent/MCP/CLI surfaces.
5. Tasks 24–28 add Command Center, end-to-end proofs and learning integration.
6. Tasks 29–32 harden security, observability, docs and full verification.

Do not pause between tasks for routine approval. Continue inline until the branch is complete. Stop only for one of these conditions:

- a repository doctrine conflict that makes two requirements impossible to satisfy simultaneously;
- a required external irreversible action (production deploy, real payout, provider credential mutation, destructive remote migration);
- an environment/tooling blocker that prevents both local and remote verification and cannot be safely worked around;
- a product decision absent from the spec that materially changes legal/commercial behavior and cannot be encoded conservatively as `REVIEW_REQUIRED`/disabled.

## Completion Definition

The implementation branch is complete only when all branch-introduced tests/type/build checks are green, the Nuvemshop revenue pipeline and governed commercial publication flows are proven end-to-end in tests, tenant isolation is adversarially tested, the Command Center can answer revenue/commission/creator/product/content/attribution/provider-health questions, learning receives evidence-backed revenue outcomes, and `main` remains untouched.
