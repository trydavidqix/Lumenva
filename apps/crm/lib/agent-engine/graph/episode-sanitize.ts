import { sanitizeMemoryCandidate } from "../memory/sanitize";
import type { GraphEpisode } from "./types";

export type EpisodeSanitizationResult =
  | { allowed: true; episode: GraphEpisode }
  | { allowed: false; reason: string };

/**
 * Every `GraphEpisode` field that actually leaves the process. Mirrors
 * `addEpisode()` in `graphiti-client.ts`, which sends `body` as `content`,
 * `name` as `name`, and `sourceDescription` as `source_description` — a
 * secret smuggled into any of the three reaches Graphiti the same way, so
 * all three are scanned, not just `body`.
 */
const SCANNED_FIELDS = ["body", "name", "sourceDescription"] as const;

/**
 * Blocks a graph episode from being projected into Graphiti (an external
 * service, Task 3/4) when any wire-bound text field looks like a
 * secret/credential. This is the outbound enforcement point required by
 * `GraphContextPort`'s doctrine comment ("adapters ingest curated/sanitized
 * event text, never secrets/raw credentials") and by CLAUDE.md invariant #8
 * / `.claude/rules/security.md` (never let secrets leave the system).
 *
 * Detection is reused, not reinvented: `sanitizeMemoryCandidate` from
 * `lib/agent-engine/memory/sanitize.ts` is the sanitizer Phase 2/3 already
 * built for the same class of problem — blocking secret-like text before it
 * leaves the system to an external memory service (Mem0). Its regex rules
 * (API keys, bearer/JWT tokens, session/cookie assignments, passwords,
 * recovery codes, card numbers, CVVs, CPF, internal secret env-var names)
 * are exactly the risk surface episode text carries too, since episode
 * `body` is free-form conversational/JSON content just like a
 * semantic-memory candidate. Re-deriving a second copy of the same regex
 * set here would only create a second place for the two lists to drift.
 *
 * `sanitizeMemoryCandidate`'s `type` parameter is a `SemanticMemoryRecord`
 * classification its implementation never reads (confirmed by inspection —
 * only `text` is used); a fixed placeholder is passed here since episodes
 * have no equivalent concept, and it cannot change which fields get
 * flagged.
 *
 * Fails closed like the reused function: any single match blocks the WHOLE
 * episode rather than trying to redact/mask a field in place.
 */
export function sanitizeGraphEpisode(episode: GraphEpisode): EpisodeSanitizationResult {
  for (const field of SCANNED_FIELDS) {
    const result = sanitizeMemoryCandidate({ text: episode[field], type: "behavior" });
    if (!result.allowed) {
      return { allowed: false, reason: `${field}:${result.reason}` };
    }
  }

  return { allowed: true, episode };
}
