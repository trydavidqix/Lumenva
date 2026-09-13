# Lumenva Scenario Lab + Council + OASIS Design

Date: 2026-09-13
Status: Design approved in chat; implementation gated by written-spec review
Branch: `feature/scenario-lab-council-oasis-2026-09-13`
Base: `design/hermes-unified-learning-os-2026-09-13`

## 1. Purpose

Build a governed decision-intelligence subsystem inside the existing Lumenva Agent OS that combines:

- **Council** for multi-model deliberation, challenge, synthesis and review;
- **Scenario Lab** as the Lumenva-native orchestration and product surface;
- **OASIS-compatible simulation** behind a replaceable simulation port for synthetic social/business dynamics;
- **Evidence Engine** for multi-run evaluation, stability, sensitivity, provenance and historical backtesting;
- **Hermes** as the learning destination only after explicit evaluation and promotion gates.

The subsystem answers questions such as:

> What happens if we increase a plan from EUR 49 to EUR 79?

without treating model-generated behavior as truth or prediction. Outputs are decision-support hypotheses with measurable evidence and uncertainty.

## 2. Existing architectural constraints

This design extends the existing Agent Engine. It does not create a second agent runtime.

The existing architecture remains authoritative:

1. Supabase/Postgres owns business truth.
2. `event_log` owns immutable business facts.
3. jobs/checkpoints/retries own execution infrastructure.
4. the Agent Kernel owns bounded orchestration.
5. policies own deterministic allow/deny/approval decisions.
6. memory and graph providers remain derived projections.
7. new autonomy starts OFF/SHADOW.
8. evidence, not model self-report, determines terminal success.
9. learning creates candidates that require evaluation and promotion before ACTIVE behavior.

The Scenario Lab must compose with these invariants rather than bypass them.

## 3. Product boundary

### 3.1 In scope

- scenario definition and lifecycle;
- evidence-pack construction from authorized Lumenva sources;
- scenario compilation into actors, assumptions, variables, constraints and strategies;
- Council proposal/review rounds;
- synthetic population generation;
- replaceable simulation-engine contract;
- initial OASIS-compatible adapter/worker;
- deterministic run budgets and termination;
- repeated runs with independent seeds;
- baseline/proposal/counterfactual comparison;
- stability and sensitivity analysis;
- evidence coverage and confidence components;
- historical backtesting;
- result critique and Decision Brief generation;
- `/command/scenarios` user experience;
- Hermes learning-candidate bridge;
- tenant isolation, RLS, provenance and auditability;
- feature flags and OFF/SHADOW rollout.

### 3.2 Explicitly out of scope

- copying MiroFish source or prompts into the proprietary core;
- treating simulations as calibrated forecasts without empirical calibration;
- writing synthetic facts into authoritative CRM state;
- granting an external simulator direct database credentials;
- autonomous production actions based only on a simulation result;
- production migration execution, production deploy, production secrets changes or merging to `main` from this branch;
- replacing Graphiti/Postgres with Zep;
- replacing the existing Agent Kernel with MiroFish/OASIS runtime behavior.

## 4. Core user flow

```text
Decision question
      |
      v
Evidence Pack Builder
      |
      v
Council: propose / challenge / synthesize
      |
      v
Scenario Compiler
      |
      v
Population Builder
      |
      v
SimulationKernel
   /        \
Mock      OASIS adapter
      |
      v
Multi-Run Evaluator
      |
      v
Council Review + Critic
      |
      v
Evidence / Confidence Engine
      |
      v
Decision Brief
      |
      v
Optional Hermes learning candidate
```

The system may repeat Council -> simulation -> review while bounded by deterministic limits.

## 5. Domain model

### 5.1 Scenario

A scenario is a tenant-scoped decision experiment with:

- question;
- decision variables;
- baseline;
- candidate strategies;
- assumptions;
- constraints;
- evidence references;
- actor/population specification;
- run budget;
- status;
- provenance.

Recommended lifecycle:

```text
DRAFT
-> EVIDENCE_READY
-> COMPILED
-> READY
-> RUNNING
-> ANALYZING
-> COMPLETED

Alternative terminal states:
CANCELLED | FAILED | EXPIRED
```

### 5.2 Strategy

A strategy is one concrete decision configuration to compare against baseline and other strategies.

Example:

- baseline: EUR 49 for everyone;
- A: EUR 59 for everyone;
- B: EUR 69 for everyone;
- C: EUR 79 for new customers, EUR 59 for existing customers.

### 5.3 Synthetic actor

A synthetic actor is generated for a simulation population and must never be confused with a real person or CRM contact.

Required metadata:

- `synthetic = true`;
- `scenario_id`;
- `population_id`;
- `actor_template_id`;
- `seed` or deterministic derivation key;
- `generator_version`;
- evidence references used to derive the template;
- creation timestamp.

No synthetic actor receives real CRM identity fields unless a later privacy-reviewed feature explicitly requires a controlled pseudonymous mapping.

### 5.4 Run

A run executes exactly one strategy under one engine configuration and one seed. Repeated runs create a distribution rather than a single answer.

Each run records:

- engine adapter/version;
- model/provider versions where available;
- seed;
- population version;
- scenario compiler version;
- Council version/config hash;
- start/end timestamps;
- budgets;
- terminal state;
- event/artifact references;
- metrics;
- errors/failure classification.

## 6. Data model

Create additive, tenant-scoped tables following existing repository migration conventions:

- `scenario_definitions`
- `scenario_evidence`
- `scenario_assumptions`
- `scenario_actor_templates`
- `scenario_populations`
- `scenario_strategies`
- `scenario_runs`
- `scenario_run_events`
- `scenario_agent_actions`
- `scenario_outcomes`
- `scenario_metrics`
- `scenario_comparisons`
- `scenario_reports`
- `scenario_backtests`
- `scenario_calibration`

All business-facing tables include `organization_id` and RLS.

All synthetic records include explicit synthetic/provenance markers where relevant. Simulation artifacts must not be inserted into authoritative CRM fact tables.

`event_log` remains the immutable operational history for lifecycle facts such as scenario created, run started, run completed, run failed, report generated and learning candidate proposed.

## 7. Contracts

### 7.1 CouncilPort

The Scenario Lab consumes Council through an internal contract instead of binding to one CLI or provider.

Conceptual interface:

```ts
interface CouncilPort {
  propose(input: CouncilProposalInput): Promise<CouncilProposalResult>
  review(input: CouncilReviewInput): Promise<CouncilReviewResult>
  challenge(input: CouncilChallengeInput): Promise<CouncilChallengeResult>
}
```

Responsibilities:

- enumerate available council members/adapters;
- generate independent proposals where configured;
- redact member identity from peer review when useful;
- synthesize disagreements rather than hide them;
- preserve per-member provenance;
- obey token/cost/runtime budgets;
- degrade when a member is unavailable;
- never grant tools or permissions to a model by prompt text.

The existing Helixforge/Council patterns may inspire behavior, but the Scenario Lab integrates them behind this contract.

### 7.2 SimulationEnginePort

```ts
interface SimulationEnginePort {
  prepare(input: PrepareSimulationInput): Promise<PreparedSimulation>
  run(input: RunSimulationInput): Promise<SimulationRunHandle>
  status(handle: SimulationRunHandle): Promise<SimulationRunStatus>
  cancel(handle: SimulationRunHandle): Promise<void>
  collectArtifacts(handle: SimulationRunHandle): Promise<SimulationArtifacts>
}
```

The first implementations are:

- `MockSimulationEngine` for deterministic tests;
- `OasisSimulationEngine` for external synthetic simulation.

No product code depends directly on OASIS process details.

### 7.3 ScenarioEvaluator

```ts
interface ScenarioEvaluator {
  evaluate(input: ScenarioEvaluationInput): Promise<ScenarioEvaluation>
}
```

It computes comparisons, stability, variance, sensitivity, evidence coverage and calibration-related metrics. It does not ask an LLM to invent a numeric confidence score.

## 8. Evidence Pack Builder

The Evidence Pack Builder gathers only authorized context relevant to the decision.

Potential sources:

- CRM facts;
- historical sales/leads;
- conversation aggregates;
- campaigns and analytics;
- approved internal documents;
- published knowledge/RAG;
- derived Graphiti context;
- optional external research through governed adapters.

Authority order follows the existing Agent OS memory doctrine:

```text
Postgres/CRM truth
> published knowledge/RAG
> derived graph/memory
> model prior knowledge
```

Every evidence item carries source type, source identifier, timestamp, authority level, tenant and retrieval provenance.

## 9. Scenario Compiler

MiroFish's social-media-oriented ontology is not copied. Lumenva defines a business-oriented scenario ontology.

Canonical concepts include:

- Actor;
- CustomerSegment;
- Organization;
- Competitor;
- Product;
- Offer;
- Market;
- Channel;
- EmployeeRole;
- Regulator;
- Resource;
- Constraint;
- Incentive;
- Decision;
- Event;
- Relationship;
- KPI.

The compiler transforms question + evidence + Council hypotheses into a typed `CompiledScenario`.

It must distinguish:

- observed fact;
- derived fact;
- user assumption;
- Council hypothesis;
- simulation parameter.

These categories are never silently merged.

## 10. Population Builder

The Population Builder creates synthetic distributions, not copies of real contacts.

Initial MVP target:

- 24-50 synthetic actors;
- 8-12 simulation rounds;
- 3-5 strategies;
- 5 independent seeds per strategy.

Population templates may use aggregate real data, but generation must minimize exposure of individual personal data.

Scale above the MVP only after measurement shows that larger populations improve decision quality enough to justify cost and latency.

## 11. OASIS worker boundary

OASIS should run in a thin isolated Python worker/service.

The worker receives a sanitized, explicit simulation payload and never receives:

- `service_role` credentials;
- unrestricted database access;
- tenant secrets;
- direct authority to mutate CRM state.

The Lumenva side owns authoritative run state in Postgres and execution history in `event_log`/job infrastructure.

The worker returns typed progress events and artifacts. Process IDs, temporary JSON files and subprocess lifecycle are implementation details of the worker, not business state.

Worker failures are classified and persisted by Lumenva. A worker restart must not erase Scenario Lab state.

## 12. Multi-run evaluation

A scenario result is never based on one run.

The evaluator compares strategy distributions across independent seeds.

Initial metrics should include where meaningful:

- KPI mean/median;
- variance and percentile bands;
- direction consistency;
- strategy ranking stability;
- segment-level effects;
- failure/timeout rate;
- sensitivity to assumptions;
- Council agreement/disagreement;
- evidence coverage;
- historical calibration score when backtest data exists.

Results use language such as:

- baseline;
- central simulated outcome;
- range;
- stable/unstable across seeds;
- sensitive/insensitive to assumption X.

The UI must not label an outcome "probable" unless calibration justifies that wording.

## 13. Confidence Engine

Confidence is a structured bundle, not a single model opinion.

Components:

- `run_stability`;
- `evidence_coverage`;
- `model_agreement`;
- `sensitivity_stability`;
- `historical_calibration`;
- `engine_reliability`;
- `data_freshness`.

A composite score may be displayed only when its formula and component values are inspectable. The Decision Brief must expose why confidence is high or low.

## 14. Historical backtesting

Backtesting is required before the product claims meaningful predictive value.

Procedure:

1. select a past decision with a known outcome;
2. establish a cutoff timestamp;
3. build evidence only from information available before the cutoff;
4. hide the true outcome from Council/simulator;
5. run all configured seeds/strategies;
6. compare simulated output with observed outcome;
7. record calibration metrics.

Initial metrics:

- direction accuracy;
- magnitude error when a numeric target exists;
- strategy/ranking accuracy;
- interval coverage where ranges exist;
- variance across seeds;
- calibration by scenario type.

Backtest results live in `scenario_backtests`/`scenario_calibration` and may influence future confidence components only through deterministic evaluation logic.

## 15. Council feedback loop

The system may iterate:

```text
Council proposes strategies
-> simulations run
-> evaluator summarizes evidence
-> Council critiques weak points
-> revised strategy/hypothesis is generated
-> targeted simulations run
-> stop when termination condition fires
```

Hard limits are deterministic:

- maximum Council rounds;
- maximum simulation runs;
- maximum wall-clock runtime;
- maximum token/cost budget;
- maximum failed runs;
- minimum measured improvement required to continue;
- no-progress/repeated-hypothesis stop.

The model cannot override these limits.

## 16. Decision Brief

The final report is a structured artifact with:

- decision question;
- baseline;
- compared strategies;
- strongest observed simulated effects;
- uncertainty/ranges;
- segment impacts;
- critical assumptions;
- sensitivity findings;
- Council disagreements;
- evidence coverage;
- confidence components;
- backtest/calibration context if available;
- recommended next real-world validation step;
- full provenance links to runs/evidence.

A recommendation is advisory. Any real side effect remains subject to the existing Agent OS policy/approval path.

## 17. Hermes bridge

Scenario findings never become active memory or policy automatically.

Allowed flow:

```text
Scenario finding
-> learning_candidate
-> eval
-> historical validation where relevant
-> approval/promotion
-> ACTIVE knowledge/skill/policy only through existing Hermes gates
```

The bridge records scenario/report/run references so promoted knowledge remains traceable.

## 18. UI

Primary route: `/command/scenarios`.

### 18.1 Create view

Minimal first interaction:

```text
What do you want to test?
[ E.g. What happens if we raise EUR 49 to EUR 79? ]
[ Create scenario ]
```

### 18.2 Setup view

Sections:

- Evidence;
- Actors;
- Assumptions;
- Strategies;
- Budgets;
- Run.

Council-proposed strategies appear as editable candidates before simulation unless the configured autonomy mode explicitly permits automatic execution of synthetic-only runs.

### 18.3 Results view

Show strategy comparison first, not raw agent chatter.

Core panels:

- strategy ranking/comparison;
- KPI ranges;
- stability across seeds;
- segment effects;
- assumption sensitivity;
- Council critique;
- confidence components;
- evidence/provenance;
- run drill-down.

## 19. Security, privacy and tenancy

Required controls:

- RLS on all tenant-facing scenario tables;
- organization derived from trusted server context;
- no tenant identity accepted from model output;
- sanitized simulator payloads;
- minimum necessary personal data;
- audit event for every lifecycle transition;
- feature-flagged external engine use;
- no secrets in prompts, artifacts or logs;
- side effects continue through the existing Tool Gateway/policy system;
- synthetic outputs cannot update authoritative customer/contact/company facts;
- external workers cannot hold broad database credentials.

## 20. Licensing boundary

MiroFish is treated as an architectural/research reference, not a code dependency for the proprietary core.

Rules:

- do not copy MiroFish AGPL source files, prompt text or implementation into Lumenva proprietary modules;
- reimplement concepts independently behind Lumenva contracts;
- use OASIS or other third-party engines only after verifying their own license and dependency obligations;
- keep external simulation behind `SimulationEnginePort` so legal/technical replacement is possible;
- document third-party notices for any dependency actually shipped.

## 21. Failure handling

Failure classes:

- Council member unavailable;
- Council budget exceeded;
- evidence retrieval failure;
- scenario compile validation failure;
- simulator preparation failure;
- simulator timeout/crash;
- partial seed failure;
- artifact validation failure;
- evaluator failure;
- report generation failure.

Partial runs remain inspectable. The system distinguishes retryable, non-retryable and policy-blocked failures.

A scenario is `COMPLETED` only when required evidence, comparison and report gates succeed. It is not marked successful because a model says it succeeded.

## 22. Observability

Emit structured metrics/events for:

- scenario counts by status;
- Council latency/member availability;
- simulation latency by engine;
- token/cost usage;
- seed success/failure;
- evaluator stability;
- backtest accuracy/calibration;
- report generation latency;
- feature-flag/autonomy mode;
- external worker failures.

No raw sensitive prompt/content is required for normal operational metrics.

## 23. Rollout

Rollout order:

1. contracts and schema source;
2. deterministic MockSimulationEngine;
3. read-only Scenario Lab API/service;
4. basic UI;
5. CouncilPort integration;
6. multi-run evaluator;
7. Evidence/Confidence Engine;
8. OASIS adapter/worker behind feature flag;
9. sensitivity analysis;
10. historical backtesting;
11. Decision Brief + interactive critique;
12. Hermes learning-candidate bridge.

Feature modes:

```text
OFF
SHADOW
ASSISTED
```

Scenario execution starts OFF/SHADOW. No autonomous real-world action is introduced by this feature.

## 24. Testing strategy

Implementation follows TDD and existing repository conventions.

Required tests include:

- contract/unit tests for scenario types and state transitions;
- deterministic MockSimulationEngine tests;
- Council fallback/degradation tests;
- run-budget/termination tests;
- evaluator aggregation and variance tests;
- synthetic-boundary tests proving outputs do not become CRM truth;
- provenance tests;
- organization/RLS isolation tests;
- worker payload redaction tests;
- partial-run/failure tests;
- Hermes bridge creates candidate only, never ACTIVE knowledge directly;
- route/API authorization tests;
- historical-backtest cutoff tests preventing future information leakage.

Branch-only authoring can add source and tests, but compilation, Vitest, lint, disposable Supabase reset, RLS org A/org B proof, generated database types and production build require an executable environment before PASS is claimed.

## 25. Acceptance criteria

The first end-to-end feature is accepted when a tenant can:

1. create a decision question;
2. build an evidence pack with provenance;
3. receive Council-generated candidate strategies;
4. compile a valid business scenario;
5. generate a synthetic population;
6. run at least three strategies across multiple deterministic/mock seeds;
7. compare distributions and stability;
8. receive a Decision Brief with uncertainty and evidence references;
9. verify that no synthetic output mutated authoritative CRM state;
10. persist all lifecycle events and tenant-scoped records;
11. switch the external simulation engine off without breaking the Scenario Lab core.

OASIS support is accepted separately when the same port contract runs through the isolated worker and survives worker failure/restart without loss of authoritative Scenario Lab state.

## 26. Implementation decomposition

The design is implemented as reviewable vertical slices rather than one giant change:

1. **Foundation** — domain contracts, statuses, feature flags, persistence interfaces.
2. **Schema/RLS source** — additive migrations and isolation tests.
3. **Mock vertical slice** — create scenario -> compile -> mock multi-run -> evaluate -> report.
4. **Council integration** — proposal/challenge/review via `CouncilPort`.
5. **UI** — `/command/scenarios` create/setup/results.
6. **Evidence Engine** — provenance, confidence components, sensitivity.
7. **OASIS worker** — isolated adapter plus typed events/artifacts.
8. **Backtesting** — cutoff-safe historical evaluation and calibration.
9. **Hermes bridge** — learning candidates with promotion gates.
10. **Operational hardening** — observability, budgets, failure recovery and rollout evidence.

Each slice must preserve the existing Agent OS invariants and remain reversible without touching `main` until separately reviewed and approved.
