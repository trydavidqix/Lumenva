import { sanitizeMemoryCandidate } from "../../memory/sanitize";
import type { ExternalGuardrailRequest } from "./port";

export type ExternalGuardrailSanitizationResult =
  | { allowed: true; request: ExternalGuardrailRequest }
  | { allowed: false; reason: string };

/**
 * Everything a caller might have on hand when it is about to ask an
 * external validator (Task 2's `ExternalGuardrailPort`, currently backed
 * only by the noop adapter) to check a piece of input/output content.
 * `metadata` is deliberately typed loosely: it is whatever context object
 * the caller happened to be carrying alongside the text (lead name,
 * contact id, conversation id, phone, template variables, debug
 * annotations, ...). None of it is needed by a content-safety validator,
 * and none of it is forwarded — see `sanitizeExternalGuardrailCandidate`.
 */
export interface ExternalGuardrailCandidate {
  organizationId: string;
  direction: "input" | "output";
  text: string;
  policy: string;
  metadata?: Record<string, unknown>;
}

/**
 * Data-minimization gate for whatever text/metadata might someday be sent
 * to an external guardrail validator (Guardrails AI or equivalent — see
 * `ExternalGuardrailPort` in `./port.ts`). Nothing calls this yet: Task 2
 * shipped the port + noop adapter as forward-compatible scaffolding, and
 * this task adds the sanitizer the same way, ahead of an actual external
 * client (Tasks 4-8 were deliberately not built — Task 1 found no risk
 * category lacking a native detector, and the project owner decided to
 * stop after scaffolding). When/if a real adapter is ever wired up, this
 * is the function that must sit between "content ready to validate" and
 * "request sent over the wire": CLAUDE.md invariant #8 /
 * `.claude/rules/security.md` forbid secrets leaving the system, and no
 * doctrine document authorizes an external service to see raw tenant
 * identity folded into free text.
 *
 * Three responsibilities, in order:
 *
 * 1. Secret/credential detection is reused, not reinvented. This is
 *    exactly the class of problem `sanitizeMemoryCandidate` already solves
 *    for Mem0 (Phase 2) and that `sanitizeGraphEpisode` reused for
 *    Graphiti (Phase 4) — bearer tokens, cookies/session assignments, API
 *    keys, passwords/recovery codes, card numbers, CVVs, CPF and internal
 *    secret env-var names. A third parallel regex set here would only
 *    create a second place for the lists to drift, so this sanitizer
 *    imports and calls the same function instead, following the precedent
 *    `episode-sanitize.ts` set for Phase 4. Fails closed like the reused
 *    function: any match blocks the whole candidate rather than trying to
 *    redact/mask a substring in place.
 * 2. The tenant id is structural metadata on `ExternalGuardrailRequest`
 *    (`organizationId`), never part of the `text` an external validator
 *    reads. If a caller accidentally interpolated the org id into the
 *    text it built (e.g. "org 3f2a...: ..."), that is rejected rather than
 *    silently stripped — the same fail-closed posture `sanitizeMemoryCandidate`
 *    already uses for secrets, applied to tenant identity instead.
 * 3. `metadata` — whatever extra context the caller happened to be
 *    carrying alongside the text — is never copied into the returned
 *    request. Only the four fields `ExternalGuardrailRequest` actually
 *    declares travel outward. This is what "for output-content
 *    validation, strip metadata not needed by the validator" (Task 3
 *    brief) means in practice: an AI response is commonly bundled with
 *    exactly this kind of context (lead/contact/conversation ids, contact
 *    details, template variables), and a content-safety validator only
 *    ever needs the content itself.
 */
export function sanitizeExternalGuardrailCandidate(
  candidate: ExternalGuardrailCandidate,
): ExternalGuardrailSanitizationResult {
  const { organizationId, direction, text, policy } = candidate;

  const secretScan = sanitizeMemoryCandidate({ text, type: "behavior" });
  if (!secretScan.allowed) {
    return { allowed: false, reason: secretScan.reason };
  }

  if (organizationId.length > 0 && text.includes(organizationId)) {
    return { allowed: false, reason: "organization_id_in_text" };
  }

  return {
    allowed: true,
    request: {
      organizationId,
      direction,
      text: secretScan.text,
      policy,
    },
  };
}
