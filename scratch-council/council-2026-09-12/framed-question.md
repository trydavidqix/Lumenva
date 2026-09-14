# Framed Question — Council 2026-09-12 (Influencer Engine + Multi-Model Voice OS)

## Decision
The owner (David, solo founder) received two large external AI-generated blueprints today, unverified,
and wants them turned into an implementation plan AND mapped onto the existing 16-Wave Business OS plan:

1. **Lumenva AI Influencer Engine** — a talking-avatar video pipeline (HunyuanVideo-Avatar, SkyReels V3,
   Wan 2.2, MuseTalk, LatentSync lip-sync, Google Nano Banana/Veo 3.1 premium lane) requiring a dedicated
   GPU VPS (24GB+ VRAM, does not exist today, would cost real recurring money) controlled by the existing
   CX53 server via a new "Media MCP".
2. **Lumenva Multi-Model Runtime + Voice OS** — add Gemini CLI and Antigravity (using the owner's personal
   Google AI Pro subscription) as agent runtimes alongside Codex/Claude, plus a new Voice Router for
   customer phone calls using OpenAI Live (gpt-live-1) and Gemini Live as alternate providers, with a
   shadow-mode comparison phase before switching live traffic.

## Context (verified facts only, no invention beyond this)
- MVP (Lumenva CRM) is 100% code-complete today (entitlements + production stability + Stripe merged to
  `main`); only the owner's own decisions (WhatsApp number, Resend API key, legal/jurisdiction) block the
  first paying customer end-to-end.
- The Business OS master plan defines 16 Waves. Wave 11 = "Unified Integrations" (WhatsApp, Instagram,
  Facebook, email, **voice**, Google). Wave 12 = "Marketing + Video" (CMO, Research, Content, SEO/AEO/GEO,
  Creative, Community, Analytics, **Teacher/Video**). Today (Saturday) the team built real skeleton code
  with tests for Waves 2, 3, 4, 5, and 16 — none are production-ready; all are early foundation.
- Real infrastructure today: one Hetzner production VPS (CRM/WhatsApp/Asterisk), one home Linux worker
  (i5, 8GB RAM, has frozen twice this session under heavy load), a Mac used only for orchestration (never
  executes code directly), a newly-configured Codex Cloud environment, and disposable Hetzner CI boxes
  spun up on demand. **No dedicated GPU exists.** A 24GB+ VRAM GPU VPS would be new infrastructure with a
  real recurring cost requiring the owner's explicit approval.
- There is unfinished prior voice work: two half-built, competing architectures (Telnyx/Patter vs.
  SIP+Asterisk+Pipecat) with a known intermittent loop bug, never proven live end-to-end.
- Standing rule: any new idea gets researched before being decided on (an agent scans what exists; the
  orchestrator decides clone/fork/build fresh — not the owner choosing between options).
- Separately today, Google AI Pro claims were partially fact-checked: Jules and Google Compute Engine's
  free tier are real but limited; Gemini CLI's free-tier login-based access is real. **OpenAI Live's SIP
  acceptance (`gpt-live-1`), Gemini Live's exact interface, and the VRAM/hardware requirements for
  HunyuanVideo-Avatar / SkyReels V3 / Wan 2.2 / MuseTalk / LatentSync have NOT been verified in this
  session — treat every such claim in the blueprints as UNVERIFIED, not fact.**
- The owner's stated priority today: "no client today, it's Saturday — let's approve and plan everything,
  advance as much as possible." But the MVP and the first paying customer remain priority #1 whenever the
  owner makes the decisions that unblock it.

## Stakes
Wrong call risks either (a) burning today's momentum and real money on GPU infrastructure and a voice
rebuild while the actual revenue-blocking first-customer path still sits on the owner's desk, or (b)
under-investing in a real product differentiator (video content, better voice) if the council dismisses it
reflexively. The owner explicitly asked the council to "pressure it for real," not rubber-stamp it.

## What the council must answer
1. Do these two blueprints belong in the 16-Wave plan? If yes, which existing Wave(s) do they belong to —
   Wave 11 (voice fits Unified Integrations) and Wave 12 (video fits Marketing+Video) — or do they need a
   new Wave 17?
2. Given no GPU exists and costs real money, and given there is already a stalled, unfinished voice
   architecture, what is the correct priority order: finish the existing voice work first, or start over
   with the new multi-model/voice-router redesign?
3. Is the video/influencer engine genuinely worth doing now (Saturday, no client), or is it scope
   distraction while the real MVP still depends on the owner's own pending decisions?
4. Produce a phased implementation plan — including "do not build now, resume at Wave X after Y" as a
   valid answer. Do not accept the external proposal as already decided; pressure-test it for real.

## Unknowns explicitly flagged
- Real GPU/VRAM requirements and costs for the proposed video model stack: UNVERIFIED.
- OpenAI Live SIP acceptance and Gemini Live's actual interface/limits: UNVERIFIED.
- Whether the owner is willing to spend real money on GPU infra today: UNKNOWN (not asked yet).
- Root cause of the existing voice loop bug: not diagnosed successfully yet despite one prior code fix.
