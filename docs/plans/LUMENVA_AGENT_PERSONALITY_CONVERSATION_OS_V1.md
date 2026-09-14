# Lumenva Agent Personality & Conversation OS V1

> Status: **PLAN ONLY**. This branch contains architecture and implementation planning only. No production behavior, database schema, runtime policy, agent registry, prompt compiler, voice runtime, memory runtime, or main branch is changed by this document.

## 1. Objective

Give the Lumenva AI-first company workforce a coherent behavioral operating system for identity, positioning, conversation, customer adaptation, voice, memory boundaries, risk, handoff, and learning.

The target is the company roster of **177 enterprise agents**, while avoiding 177 independent monolithic prompts.

The design principle is inheritance + composition:

```text
LUMENVA BRAND CORE
        ↓
DEPARTMENT PACK
        ↓
ROLE PACK
        ↓
AGENT PROFILE
        ↓
CHANNEL PACK
        ↓
CUSTOMER STATE
        ↓
RUNTIME AFFECT
        ↓
INSTRUCTION COMPILER
        ↓
SESSION RUNTIME
        ↓
AGENT KERNEL
        ↓
RESPONSE / ACTION
        ↓
EVIDENCE
        ↓
HERMES LEARNING
```

Core rule:

```text
177 agents ≠ 177 full prompts
```

Each agent inherits stable shared context and only adds role-specific deltas.

---

## 2. Architectural principles

1. **Agent ≠ process.** An agent identity may exist without a permanently running LLM process.
2. **Persona ≠ memory.** Personality is not customer memory or business truth.
3. **Persona ≠ runtime emotion.** Stable traits are separate from temporary conversation state.
4. **Voice ≠ text style.** Voice delivery has separate controls for pace, pauses, emphasis, turn-taking and interruption.
5. **Role ≠ skill.** Role defines responsibility; skill defines how to perform a procedure.
6. **Memory ≠ knowledge.** Customer facts and relationship memory are separate from published company knowledge.
7. **Truth stays authoritative.** CRM/Postgres remains source of truth; Graphiti, Mem0, RAG and runtime states are derived layers.
8. **AI transparency.** Agents may have names, voices and personalities, but must not deceptively present themselves as human employees.
9. **Minimal context.** Only context relevant to the current task, channel, customer and risk state should be compiled.
10. **Evidence before promotion.** Hermes may observe and propose; it may not directly self-promote behavioral changes into production.

---

## 3. Canonical repository structure

Target logical structure:

```text
ops/agents/
│
├── _core/
│   ├── identity.md
│   ├── communication-principles.md
│   ├── customer-principles.md
│   ├── ai-transparency.md
│   ├── safety.md
│   ├── uncertainty.md
│   ├── escalation.md
│   └── conversation-protocol.md
│
├── _channels/
│   ├── whatsapp.yaml
│   ├── voice.yaml
│   ├── email.yaml
│   ├── instagram.yaml
│   ├── facebook.yaml
│   └── web.yaml
│
├── _states/
│   ├── neutral.yaml
│   ├── confused.yaml
│   ├── uncertain.yaml
│   ├── frustrated.yaml
│   ├── angry.yaml
│   ├── urgent.yaml
│   └── high-risk.yaml
│
├── departments/
│   ├── executive/
│   ├── governance/
│   ├── digital-workforce/
│   ├── customer-experience/
│   ├── revenue/
│   ├── marketing/
│   ├── product-design/
│   ├── service-delivery/
│   ├── engineering-ai/
│   ├── security-it-reliability/
│   ├── legal-compliance/
│   ├── finance-accounting/
│   ├── people-hr/
│   ├── procurement-vendors/
│   ├── operations-facilities/
│   ├── data-memory-knowledge/
│   ├── reputation-research/
│   ├── commerce-investment/
│   └── transversal-support/
│
├── roster/
│   ├── sales/
│   │   └── agent.yaml
│   ├── support/
│   │   └── agent.yaml
│   ├── booking/
│   ├── billing/
│   └── ...
│
└── schemas/
    ├── agent-profile.schema.json
    ├── persona.schema.json
    ├── voice.schema.json
    ├── affect.schema.json
    ├── conversation.schema.json
    └── evaluation.schema.json
```

Do not physically move existing runtime files until Gate 0 audit identifies import/test/harness dependencies.

---

## 4. Agent Profile contract

Each agent should have a compact profile describing differences from inherited defaults.

Example:

```yaml
id: sales
name: Sales
department: revenue
reports_to: revenue-manager

mission:
  primary: convert qualified opportunity into an appropriate next commercial step
  secondary:
    - understand need
    - qualify fit
    - advance the opportunity

persona:
  archetype: consultative-advisor
  traits:
    warmth: 0.70
    assertiveness: 0.75
    patience: 0.70
    directness: 0.80
    energy: 0.65
    humor: 0.20

conversation:
  discovery_first: true
  question_limit: 1
  default_answer_length: short

voice_profile:
  profile: sales-consultative

memory_policy:
  org: true
  customer: true
  agent: true
  session: true

knowledge:
  packs:
    - pricing
    - products
    - sales-playbooks

tools:
  - crm
  - calendar
  - messaging

risk:
  max_autonomy: R2

learning:
  hermes: true
```

The profile should not duplicate department or brand-wide rules.

---

## 5. Persona OS

Persona answers: **Who is this agent?**

Examples:

```text
Sales      → consultative, confident, objective, non-aggressive
Support    → patient, warm, didactic
Governance → impartial, conservative, precise
Creative   → curious, bold, experimental
```

Persona is relatively stable and versioned.

It must not contain customer facts, incident state, current mood, runtime urgency or session-specific information.

---

## 6. Conversation OS

Conversation behavior controls:

- openings;
- questioning;
- explaining;
- disagreeing;
- admitting uncertainty;
- suggesting;
- confirming;
- closing;
- handoff behavior.

Default protocol:

```text
UNDERSTAND
   ↓
ACKNOWLEDGE
   ↓
RESOLVE / ACT
   ↓
ASK ONE NECESSARY QUESTION
   ↓
CONFIRM
   ↓
NEXT STEP
```

Avoid by default:

- multiple questions in one turn when not necessary;
- large walls of text;
- unnecessary jargon;
- fake enthusiasm;
- pretending certainty;
- pressure tactics;
- blaming the customer;
- repeated re-collection of context already known.

---

## 7. Customer State Engine

Initial states:

```text
neutral
confused
uncertain
frustrated
angry
urgent
high-risk
```

Example state pack:

```yaml
frustrated:
  modifiers:
    warmth: +0.15
    humor: -1.00
    verbosity: -0.20
    formality: +0.10
  rules:
    - acknowledge_problem_first
    - do_not_argue
    - avoid_marketing_language
    - prioritize_resolution
```

Keep the initial ontology small. Do not create dozens of pseudo-emotions before evidence justifies them.

Customer state is runtime context, not durable personality.

---

## 8. Runtime Affect

Runtime Affect is temporary behavior modulation derived from stable persona plus current conditions.

Example:

```json
{
  "confidence": 0.84,
  "warmth": 0.72,
  "urgency": 0.32,
  "formality": 0.41,
  "empathy": 0.78
}
```

Conceptual derivation:

```text
Persona baseline
+ Department defaults
+ Channel
+ Customer State
+ Risk
+ Recent conversation context
= Runtime Affect
```

Runtime affect must not automatically become long-term memory.

---

## 9. Channel Packs

The same agent should communicate differently by channel without becoming a different agent.

### WhatsApp

- concise;
- natural;
- one subject per block where possible;
- low formatting overhead;
- one necessary question at a time.

### Voice

- shorter sentences than text;
- small turns;
- one question per turn;
- pause after questions;
- user interruption allowed;
- confirm important names, dates and numbers;
- avoid reading long lists aloud.

### Email

- more structured;
- enough context to stand alone;
- clear summary;
- clear action;
- clear next step.

### Instagram / social messaging

- fast;
- lighter tone within brand limits;
- minimal context;
- simple CTA;
- no deceptive urgency.

### Web

- adaptive to task complexity;
- structured when detail is useful;
- preserve accessibility and clarity.

---

## 10. Voice OS

Voice is split into:

```text
Voice Identity
      ↓
Voice Delivery
      ↓
Voice Output Policy
```

Canonical attributes may include:

```yaml
voice:
  pace: medium
  warmth: 0.75
  energy: 0.60
  emphasis: controlled
  pauses: natural
  interruption: user_can_interrupt
  sentence_length: short
```

Reuse existing work from voice/personality branches where valid. Do not create a second competing voice engine.

---

## 11. Positioning OS

Each role needs explicit positioning boundaries:

- who the agent is;
- what authority it has;
- what it can promise;
- what it cannot promise;
- when it should disagree;
- when it should refuse;
- when another agent should take over.

Example Sales positioning:

```text
You are a Lumenva commercial advisor.
Your job is not to sell at any cost.
Your job is to determine fit and move appropriate opportunities forward.
If the product is not a fit, say so.
Never invent discounts.
Never invent availability.
Never create fake urgency.
```

---

## 12. AI transparency

Agents may have:

- names;
- avatars;
- voices;
- personalities;
- role histories/function descriptions.

They must not deceptively claim to be human.

A natural disclosure pattern is sufficient, for example:

```text
“Sou a Luna, assistente de atendimento da Lumenva.”
```

Disclosure policy must be channel-aware and not unnecessarily repeated every turn.

---

## 13. Department inheritance

The 19 macro-areas receive behavioral defaults.

| Department | Dominant behavior |
|---|---|
| Executive & Strategy | calm, firm, strategic, consequence-aware |
| Governance / Risk / Audit | neutral, rigorous, policy-first |
| Digital Workforce | operational, concise, state-oriented |
| Customer Experience | warm, patient, resolution-oriented |
| Revenue / Sales | confident, consultative, fit-first |
| Marketing / Growth | energetic, curious, creative without hype |
| Product / Design | investigative, user-problem-first |
| Service Delivery | accountable, reassuring, predictable |
| Engineering / AI | technical, precise, evidence-first |
| Security / IT / Reliability | calm, conservative, security-first |
| Legal / Compliance | serious, clear, precise without needless legalese |
| Finance / Accounting | exact, neutral, reconciled |
| People / HR | respectful, discreet, privacy-aware |
| Procurement / Vendors | objective, negotiating, cost/quality/risk-aware |
| Operations / Facilities | pragmatic, SLA/blocker oriented |
| Data / Memory / Knowledge | skeptical, structured, provenance-first |
| Reputation / Research | analytical, source-aware, contradiction-aware |
| Commerce / Investment | commercial but risk-aware |
| Transversal Support | adaptive to requesting department |

These are defaults, not complete agent definitions.

---

## 14. Role Packs

Role Pack answers: **How does an excellent professional in this role operate?**

Example Sales Role:

```text
Sales Role
├── discovery
├── qualification
├── objection handling
├── proposal
├── next step
└── follow-up
```

Role behavior is separate from personality and from skills.

---

## 15. Skills remain on-demand

Example:

```text
Persona = be consultative
Role    = qualify the opportunity
Skill   = how to perform sales discovery
```

Skills should load only when needed, instead of being permanently injected into every prompt.

---

## 16. Memory remains separate

Personality OS must not become Memory OS.

Relevant memory layers remain:

```text
org_memory
customer_memory
agent_memory
session memory
Graphiti
Mem0
```

Conceptual composition order:

```text
Identity
↓
Persona
↓
Role
↓
Channel
↓
Relevant Memory Retrieval
↓
Customer State
↓
Runtime Affect
```

CRM/Postgres remains authoritative business truth.

---

## 17. Instruction Compiler integration

The compiler should compose only the required layers:

```text
Brand Core
Department
Role
Agent Profile
Channel
Customer State
Risk
Relevant Memory
Relevant Knowledge
Current Task
```

Output:

```text
COMPILED AGENT CONTEXT
```

The compiler should detect duplicate directives and preserve instruction precedence.

Target precedence remains compatible with the wider Agent OS hierarchy:

```text
SYSTEM / SECURITY
        ↓
OWNER / ORGANIZATION
        ↓
BUSINESS POLICY
        ↓
AGENT ROLE
        ↓
AGENT PERSONA
        ↓
CHANNEL POLICY
        ↓
CUSTOMER CONTEXT
        ↓
CURRENT TASK
        ↓
SESSION CONTEXT
```

---

## 18. Context budget

Do not define fixed numbers as truth before measurement, but establish explicit budgets per layer.

Illustrative budget only:

```text
Brand Core          ~500 tokens
Department          ~200
Role                ~300
Agent Profile       ~200
Channel             ~150
Customer State      ~100
Relevant Memory     ~500
Knowledge           ~800
-------------------------
Illustrative total ~2,750
```

The objective is to avoid monolithic 20k+ token behavioral prompts.

Measure real token usage before and after implementation.

---

## 19. Cache strategy

Stable layers are candidates for deterministic compilation/cache:

```text
Brand
Department
Role
Agent Profile
```

Dynamic layers should remain session/task specific:

```text
Customer
Customer State
Relevant Memory
Relevant Knowledge
Task
Risk state
```

Caching must not break tenant isolation or cause stale policy use.

---

## 20. Agent Birth integration

At agent materialization:

```text
AgentDefinition
      ↓
validate schema
      ↓
resolve department
      ↓
resolve role
      ↓
resolve persona
      ↓
resolve tools
      ↓
resolve memory policy
      ↓
resolve voice
      ↓
resolve risk
      ↓
BIRTH
```

If required invariants conflict, birth should fail rather than create an inconsistent agent.

---

## 21. Session Runtime integration

When an agent wakes:

```text
Wake Agent
   ↓
Load immutable profile
   ↓
Load tenant
   ↓
Load customer if relevant
   ↓
Load channel
   ↓
Retrieve allowed memory
   ↓
Retrieve allowed knowledge
   ↓
Detect customer state
   ↓
Build runtime affect
   ↓
Compile instructions
   ↓
Start Agent Kernel
```

Only authorized customer/business data should be included.

---

## 22. Response pipeline

```text
User / Event Input
      ↓
Intent
      ↓
Customer State
      ↓
Agent Decision
      ↓
Tool / Knowledge / Memory
      ↓
Draft
      ↓
Conversation Policy
      ↓
Voice / Channel Policy
      ↓
Safety / Governance
      ↓
Output / Action
      ↓
Evidence
```

---

## 23. Evaluation OS

Behavioral quality must be evaluated beyond factual correctness.

Evaluate:

- task correctness;
- tone;
- persona consistency;
- customer-state adaptation;
- verbosity;
- questioning behavior;
- hallucination;
- policy compliance;
- handoff quality;
- channel fit;
- voice fit;
- tool behavior;
- memory contamination;
- tenant isolation.

Example:

```text
Correct answer?                 PASS
Asked six questions at once?   FAIL
Invented urgency?              FAIL
Wrong channel tone?            FAIL
```

A technically correct answer may still fail the behavior gate.

---

## 24. Golden Conversations

Each production agent should eventually have representative conversations for:

```text
neutral customer
confused customer
frustrated customer
angry customer
urgent customer
high-value customer
no-fit customer
uncertain agent
missing knowledge
tool failure
handoff
high-risk request
```

Do not require a massive set for all 177 agents in the first implementation wave. Start with the priority 22.

---

## 25. Anti-pattern tests

Explicitly test against:

- fake scarcity / fake urgency;
- blaming customers;
- unnecessary jargon;
- overlong answers;
- too many questions at once;
- invented price/availability;
- claiming actions that did not happen;
- pretending to be human;
- resisting requested human handoff;
- disallowed memory access;
- cross-tenant leakage;
- policy bypass;
- tone inappropriate to serious situations.

---

## 26. Hermes integration

Hermes observes outcomes and may generate governed candidates.

Example:

```text
Observation:
Support CSAT drops when replies exceed an empirically observed threshold.

Candidate:
support.default_answer_length
long → short
```

Promotion path:

```text
Observation
↓
Hermes Candidate
↓
Scenario Lab
↓
Golden / Safety / Regression Evals
↓
Governance
↓
Approval
↓
Shadow / Controlled Rollout
↓
Monitor
↓
Keep or Rollback
```

Hermes must never directly mutate live personality, policy or runtime authority.

---

# Implementation Plan — 12 Gates

## Gate 0 — Read-only audit

Audit existing implementation across relevant branches before changing code.

At minimum inspect and reconcile:

```text
conversation-style.ts
delivery-style.ts
voice-output-policy.ts
sentiment.ts
PsycheOS or equivalent behavioral runtime
AgentDefinition
Agent Birth
Instruction Compiler
Session Runtime
personality branches
voice branches
agent registry
existing evals
existing memory policies
existing provider/runtime contracts
```

Classify each artifact:

```text
KEEP
MERGE
REFACTOR
DELETE-LATER
UNKNOWN
```

No destructive changes in Gate 0.

### Gate 0 acceptance

- current architecture mapped;
- branch lineage identified;
- duplicate behavior systems identified;
- import/harness dependencies identified;
- no files moved yet.

---

## Gate 1 — Contracts and schemas

Create or consolidate canonical contracts for:

```text
AgentProfile
PersonaProfile
ConversationProfile
VoiceProfile
RuntimeAffect
ChannelProfile
CustomerState
EvaluationProfile
```

Requirements:

- versionable;
- schema validated;
- backward-compatible migration strategy;
- no runtime activation yet.

### Gate 1 acceptance

- schemas compile;
- validation tests pass;
- no parallel competing contract introduced.

---

## Gate 2 — Brand Core

Create minimal universal Lumenva behavioral rules.

Suggested core topics:

```text
identity
communication principles
customer principles
AI transparency
safety
uncertainty
escalation
conversation protocol
```

Do not include department-specific behavior.

### Gate 2 acceptance

- compact;
- non-duplicative;
- testable;
- compatible with existing policy hierarchy.

---

## Gate 3 — 19 Department Packs

Create one inherited behavior pack per macro-area.

Goal:

```text
Company DNA
+ Department DNA
```

without agent-specific duplication.

### Gate 3 acceptance

- all 19 macro-areas represented;
- no department pack duplicates Brand Core;
- inheritance resolution tests pass.

---

## Gate 4 — Priority 22 agents

Implement profiles for the first production wave:

1. Sales
2. Support
3. Booking
4. Billing
5. Manager
6. Escalation
7. CMO
8. Research
9. Content
10. SEO
11. Creative
12. Community
13. Analytics
14. Studio Architect
15. Design
16. Copy
17. Frontend Builder
18. Backend Builder
19. Studio QA
20. Notification Router
21. Ops Watcher
22. Hermes

Each receives, as applicable:

```text
profile
mission
reports_to
role pack
persona
conversation behavior
memory policy
knowledge policy
tools
voice/channel policy
risk/autonomy
learning/eval profile
```

Do not expand to 177 until these prove the architecture.

---

## Gate 5 — Instruction Compiler

Extend the compiler to compose:

```text
Core
Department
Role
Agent
Channel
Customer State
Risk
Relevant Memory
Relevant Knowledge
Task
```

Requirements:

- precedence enforcement;
- directive deduplication;
- token accounting;
- explainable provenance of compiled sections;
- no cross-tenant cache contamination.

### Gate 5 acceptance

- compiled context is smaller than monolithic equivalent;
- no material rule loss;
- duplicate rules eliminated or referenced once;
- provenance/debug view available.

---

## Gate 6 — Session Runtime

Connect profiles to the runtime wake path.

```text
Agent wake
→ resolve inherited profile
→ retrieve allowed context
→ compile
→ run
```

Measure before/after:

- initial prompt tokens;
- retrieval tokens;
- latency;
- correctness;
- policy adherence.

---

## Gate 7 — Customer State Engine

Implement the initial state set only:

```text
neutral
confused
uncertain
frustrated
angry
urgent
high-risk
```

Requirements:

- uncertainty/confidence exposed;
- false certainty avoided;
- state cannot bypass policy;
- state does not automatically become durable memory.

### Gate 7 acceptance

- golden state-transition tests pass;
- angry/frustrated paths remove inappropriate humor/marketing behavior;
- high-risk state escalates correctly.

---

## Gate 8 — Personality + Voice consolidation

Reconcile and consolidate existing work from personality/voice branches.

Target conceptual split:

```text
Persona
Conversation Style
Voice Identity
Voice Delivery
Voice Output Policy
Runtime Affect
```

Do not maintain multiple competing sources for the same attribute.

### Gate 8 acceptance

- text behavior and voice behavior have clear ownership;
- existing working behavior preserved or intentionally superseded with evidence;
- no second voice/personality engine introduced.

---

## Gate 9 — Behavioral Evals

Implement:

```text
Golden Conversations
Tone Tests
Customer-State Tests
Safety Tests
Channel Tests
Voice Tests
Memory contamination tests
Cross-tenant tests
Handoff tests
```

No production agent is considered certified only because unit tests pass.

---

## Gate 10 — Hermes feedback loop

Connect behavioral evidence to Hermes as observation/candidate inputs.

Hermes may:

```text
observe
cluster
compare
propose
```

Hermes may not:

```text
self-promote
change live policy directly
change live persona directly
expand its own permissions
```

All promotions require fresh evidence and governed approval.

---

## Gate 11 — Expand 22 → 177

Scale only after architecture proves stable.

Suggested rollout:

```text
22
↓
~50
↓
~100
↓
177
```

Expand department by department.

For every agent, define:

```text
NAME
DEPARTMENT
REPORTS_TO
MISSION
FUNCTIONS
TOOLS
SKILLS
MEMORY POLICY
KNOWLEDGE POLICY
AUTONOMY
RISK
KPIs
SHIFT / WAKE POLICY
MODEL POLICY
BUDGET
VOICE
PERSONA
CHANNELS
GOOD EXAMPLES
BAD EXAMPLES
EVALS
```

Reconcile the known roster gap before claiming all 177 are implemented/certified.

---

# Rollout strategy

The safest implementation sequence is:

```text
AUDIT
↓
CONTRACTS
↓
BRAND CORE
↓
19 DEPARTMENT PACKS
↓
22 PRIORITY AGENTS
↓
INSTRUCTION COMPILER
↓
SESSION RUNTIME
↓
CUSTOMER STATE
↓
PERSONALITY
↓
VOICE
↓
EVALS
↓
HERMES
↓
177 AGENTS
```

Do not start by hand-authoring 177 giant personalities.

---

# Token and performance strategy

Track at least:

- compiled behavioral context size;
- retrieval context size;
- stable vs dynamic context ratio;
- average input tokens by agent/channel;
- latency by compiler/session runtime;
- cache hit rate where safe;
- retrieval relevance;
- rules dropped due to conflict;
- duplicate directives removed;
- quality/eval delta before vs after.

A new architecture is not considered better only because it is cleaner. It must preserve or improve correctness while reducing unnecessary context and complexity.

---

# Security / privacy constraints

1. No secrets in agent profile files.
2. No raw customer memory in persona or department packs.
3. No cross-tenant memory retrieval.
4. No tenant-specific data in shared caches unless safely partitioned.
5. Runtime Affect must not leak sensitive inferred attributes into durable memory.
6. Voice/personality behavior must not bypass approvals or risk policy.
7. High-risk actions still follow Business OS risk/approval controls.
8. Agent identity must not imply false human identity.
9. Customer-state detection must not be used as a source of sensitive profiling beyond legitimate operational context.

---

# V1 acceptance criteria

The V1 is acceptable when:

```text
✅ 22 priority agents have complete canonical profiles
✅ all inherit Brand Core
✅ all 19 Department Packs exist
✅ no material behavioral rule is duplicated without a reason
✅ persona ≠ runtime affect
✅ voice ≠ text style
✅ memory ≠ persona
✅ role ≠ skill
✅ Skills are on-demand where possible
✅ Customer State works with bounded initial states
✅ Runtime Affect is ephemeral by default
✅ AI transparency policy exists
✅ handoff behavior is consistent
✅ compiler deduplicates and respects precedence
✅ token budget is measured before/after
✅ golden conversations pass
✅ cross-tenant isolation tests pass
✅ voice/channel tests pass where applicable
✅ Hermes cannot self-promote
✅ rollback exists for behavioral rollouts
```

---

# Final blueprint

```text
                         LUMENVA
                            │
                            ▼
                       BRAND CORE
                            │
                            ▼
                      DEPARTMENT
                            │
                            ▼
                          ROLE
                            │
                            ▼
                     AGENT PROFILE
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
          PERSONA        SKILLS          TOOLS
             │
             ▼
      CONVERSATION STYLE
             │
      ┌──────┴────────┐
      ▼               ▼
   CHANNEL       CUSTOMER STATE
      │               │
      └──────┬────────┘
             ▼
        RUNTIME AFFECT
             │
             ▼
        MEMORY RETRIEVAL
             │
             ▼
       KNOWLEDGE RETRIEVAL
             │
             ▼
     INSTRUCTION COMPILER
             │
             ▼
       SESSION RUNTIME
             │
             ▼
         AGENT KERNEL
             │
             ▼
          ACTION
             │
             ▼
          RESPONSE
             │
             ▼
         EVIDENCE
             │
             ▼
          HERMES
             │
             ▼
         CANDIDATE
             │
             ▼
       SCENARIO LAB
             │
             ▼
        EVALUATION
             │
             ▼
        GOVERNANCE
             │
             ▼
         PROMOTION
```

---

# Non-goals of this plan branch

This branch does **not**:

- merge into `main`;
- implement 177 profiles;
- alter production memory;
- alter Postgres schema;
- replace Agent Kernel;
- replace Hermes;
- replace existing voice runtime blindly;
- change live customer behavior;
- create a second Agent Engine;
- activate any agent automatically.

The implementation phase must begin with Gate 0 read-only audit and compare this blueprint against current code and all relevant branches before any structural migration.
