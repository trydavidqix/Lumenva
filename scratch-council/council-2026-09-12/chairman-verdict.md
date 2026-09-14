# Council Verdict — 2026-09-12

## Decision
Where do the "Lumenva AI Influencer Engine" (talking-avatar video) and "Lumenva Multi-Model Runtime + Voice OS"
blueprints fit in the 16-Wave plan, and in what order should they be implemented?

## Where the Council Agrees
- **HIGH confidence:** Neither blueprint should enter active build today. All five advisors and all five
  reviewers converge on this independently, from five different angles (risk, fundamentals, upside, outsider
  clarity, execution path).
- **HIGH confidence:** There is an existing, unfinished, unproven voice architecture (two competing half-builds,
  known intermittent loop bug never root-caused). Starting a *third* voice system (the new Voice Router with
  OpenAI Live/Gemini Live) before that is fixed is inventory-stacking, not iteration. Four of five advisors
  named this explicitly (Contrarian, First Principles, Executor, Expansionist implicitly via "not instead of").
- **HIGH confidence:** The video/influencer engine's core dependency — a 24GB+ VRAM GPU VPS — does not exist,
  costs real recurring money, and requires the owner's explicit approval. It fails the Executor's "first action
  available now" test outright.
- **MEDIUM confidence:** Both blueprints DO map cleanly onto the existing plan without needing a new Wave 17:
  voice → Wave 11 (Unified Integrations, which already names "voice"); video → Wave 12 (Marketing + Video,
  which already names "Teacher/Video"). The Expansionist's case for a standalone Wave 17 was reviewed and
  rejected 5/5 by peer review — the Executor's "map into existing waves" framing won unanimously.
- **HIGH confidence:** Every vendor-specific technical claim in both blueprints — GPU VRAM requirements for
  HunyuanVideo-Avatar/SkyReels V3/Wan 2.2/MuseTalk/LatentSync, OpenAI Live's SIP acceptance (`gpt-live-1`),
  Gemini Live's exact interface — is `UNVERIFIED`. No advisor treated these as fact; three reviewers flagged
  that even the advisors partially let unverified numbers slide into their reasoning as if settled.

## Where the Council Clashes
- **Expansionist vs. the rest, on whether to start Voice Router shadow-mode now.** The Expansionist argued
  shadow-mode is purely diagnostic and can run in parallel with fixing the existing bug, at near-zero cost
  (Gemini CLI/Antigravity ride the owner's existing subscription). Every other advisor and 3 of 5 reviewers
  (reviewer1, reviewer3, reviewer4) rejected this: the real cost isn't infrastructure dollars, it's the owner's
  attention — the actual scarce resource — being split across a third unproven voice path instead of finishing
  one. **Deciding factor:** the Contrarian's and Executor's framing — "planning/parallel work is not free when
  the owner himself is the bottleneck" — is the more load-bearing argument, because it's grounded in an
  observed fact (MVP already blocked purely on owner decisions), not a subscription-cost assumption.
- **Expansionist vs. Contrarian/First Principles, on a new Wave 17 for video.** Resolved against the
  Expansionist by unanimous peer review (5/5 picked Response D, which explicitly rejects a new Wave and maps
  into Wave 12 instead).

## Blind Spots the Council Caught
- **Every advisor** treated "Gemini CLI/Antigravity as new agent runtimes" as low-risk because it rides an
  existing subscription, but **two reviewers (reviewer1, reviewer2) independently caught** that none of the
  five checked (a) whether the Google AI Pro subscription's terms even cover CLI/agent-level programmatic use
  versus consumer-app use, or (b) whether adding a second agent runtime family is compatible with — or adds
  real maintenance burden to — the project's current Codex-only agent architecture. Both are `UNVERIFIED`.
- **The single most consequential omission, raised independently by reviewer4 and reviewer5:** no advisor said
  the obvious thing out loud — the fastest, truly zero-new-dependency path to revenue is the owner making the
  three pending MVP decisions (WhatsApp number, Resend key, legal/jurisdiction) that already block customer #1.
  Every advisor debated *where to file* two speculative new projects; none flagged that this filing exercise
  itself is downstream of a higher-priority action already sitting undone.
- **Reviewer4** flagged a real tension the advisors resolved *for* the owner rather than surfacing *to* him:
  the owner explicitly asked to "approve and plan everything" today, and the council's answer is substantively
  "don't." That tension should be told to the owner plainly, not just quietly overridden.

## The Recommendation
**Do not open build work on either blueprint today.** Map both into the existing plan as documented,
gated backlog items — no new Wave 17. Priority order, in this exact sequence:

1. **First priority (today, if the owner wants a same-day signal):** get the owner to make the three pending
   MVP decisions (WhatsApp number, Resend API key, legal/jurisdiction) — this outranks both blueprints and
   was never named as competing priority by the external documents, but is confirmed HIGH-confidence by the
   council's own omission-check.
2. **Second priority:** assign one agent to reproduce and root-cause the existing intermittent voice loop bug
   on the current SIP+Asterisk+Pipecat path (referenced fix commit `b09243a5`, never proven live). This is the
   Executor's first step, unanimously rated strongest by peer review, and it's the only item in this entire
   council session with zero new dependencies and a same-day test.
3. **Third priority, only after #2 is proven live once:** extend Wave 11 with the Voice Router concept
   (OpenAI Live primary / Gemini Live shadow-mode) — but only after independently verifying OpenAI Live's SIP
   acceptance and Gemini Live's actual interface, which are UNVERIFIED today.
4. **Wave 12 (video/influencer engine): log as backlog, explicitly NOT started.** Requires (a) a paying
   customer to exist (there is no audience for content yet), (b) independent verification of the GPU/VRAM
   requirements for the named models, and (c) the owner's explicit approval to spend real money on a GPU VPS.
5. **Cheap, no-regret action available today regardless:** write one plain-language, non-jargon customer-value
   sentence for each blueprint (the Outsider's proposed gate, preserved by 2 of 5 reviewers) — this costs
   nothing and forces the "why" question the vendor jargon currently hides.

**Confidence: HIGH** that this ordering is correct, given the supplied context. **Explicit assumption this
recommendation depends on:** that the owner's own stated top priority ("first paying customer") still holds —
if the owner explicitly overrides that priority today, the ordering changes but the "don't build on unverified
specs" and "don't stack a third unproven voice system" conclusions still hold independently.

## The One Thing to Do First
**Action:** Dispatch one Codex agent (via Maestri) to reproduce the existing voice loop bug end-to-end on the
current SIP+Asterisk+Pipecat path, starting from commit `b09243a5`, with the explicit goal of a live, proven
call — not another code-only "fix."
**Owner:** Claude (orchestrator), dispatched to a Maestri Codex agent (not Claude subagent, per this project's
standing rule).
**Deliverable:** A pass/fail report with real evidence (call log, transcript, or recording) — not a claim of
"should work now."
**Success signal:** One real phone call completes without the known loop, end-to-end, with evidence attached.

## Verification Notes
**Checked / grounded in supplied context (FACT):** MVP code-complete status; existing two-competing-voice-
architecture situation; no GPU exists today; home worker has frozen twice under load this session; Wave 11 and
Wave 12 already exist in the master plan with matching scope.

**Still UNVERIFIED — shortest verification path named below:**
- GPU VRAM requirements for HunyuanVideo-Avatar / SkyReels V3 / Wan 2.2 / MuseTalk / LatentSync →
  verify against each project's own README/docs before citing a number in any future plan.
- OpenAI Live's SIP/telephony acceptance (`gpt-live-1`) and Gemini Live's actual interface/limits →
  verify against OpenAI's and Google's own current API documentation.
- Whether the owner's Google AI Pro subscription terms cover CLI/agent-level programmatic use →
  verify against Google's subscription terms of service, not marketing pages.
- Whether adding Gemini CLI/Antigravity as a second agent-runtime family is compatible with the project's
  current Codex-only Maestri architecture without real added maintenance burden → not analyzed by this
  council at all; flag as a follow-up question before any Wave 11 extension work begins.

SELF-CHECK: PASS
