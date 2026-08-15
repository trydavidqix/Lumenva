import { contextItemSchema, type AuthorityDomain, type ContextItem, type MemoryRisk } from "../platform/contracts";
import { getAuthorityLevel } from "../context/mem0-context-provider";
import type { GraphFact } from "./types";

// Keyword coverage is deliberately generous (PT+EN synonyms, verb forms
// beyond the noun form) because this is the ENTIRE positive-evidence
// mechanism for reclassifying a fact into a protected domain today — see
// `classifyDomain`'s doc comment for why `fact.authorityDomain` cannot be
// trusted as a substitute signal. A demonstrated bypass (real review
// finding): "Cliente possui saldo devedor pendente de regularização." and
// "Cliente permitiu o uso do número para futuras campanhas." both read as
// protected-domain content in Portuguese but matched none of the original,
// narrower patterns — both are covered by the patterns below and by
// `fact-map.test.ts`'s explicit regression cases for them.
const CONSENT_PATTERN =
  /\b(consent(imento)?|opt[- ]?(in|out)|autoriza(?:ç|c)[aã]o (?:de|para) (?:contato|dados|marketing)|autorizou (?:o uso|uso|contato|dados)|consentiu|permitiu (?:o uso|uso|o contato|contato)|concord(?:ou|a|aram) (?:com (?:o uso|os termos|receber)|em receber)|deu permiss[aã]o (?:para|de)|concedeu autoriza(?:ç|c)[aã]o|aceit(?:ou|e|ei)\s+(?:o|os)?\s*termos?|granted permission|agreed to (?:receive|share|use))\b/iu;
const CONTRACT_PATTERN =
  /\b(contrato|contract|cl[aá]usula|clause|termos? de (?:uso|servi[cç]o)|terms? of service|acordo (?:legal|comercial)|\bnda\b|assinatura (?:do|de) contrato|assinou (?:o )?contrato|rescis[aã]o (?:do|de) contrato|renova[cç][aã]o (?:autom[aá]tica|do contrato)|vig[eê]ncia (?:do|de) contrato)\b/iu;
const PAYMENT_PATTERN =
  /\b(pagamento|payment|fatura|invoice|cobran[cç]a|billing|boleto|\bpix\b|cart[aã]o de cr[eé]dito|credit card|inadimplent\w*|inadimpl[eê]ncia|past[- ]due|chargeback|reembolso|refund|saldo devedor|em atraso|atraso no pagamento|d[eé]bito(?:s)? (?:em aberto|pendente)|pend[eê]ncia(?:s)? financeira|regulariza(?:[cç][aã]o|r)\s+(?:o\s+)?(?:pagamento|d[eé]bito|fatura))\b/iu;

/**
 * Deterministic risk floor per authority domain. `commercial_status`
 * (payment), `consent`, and `legal` (contract) are the three protected
 * domains named by the Phase 4 plan's global constraint: they always map to
 * `"high"` here, independent of anything Graphiti reports. `relationship`
 * and `customer_preference` are explicitly allowed a lower tier per the same
 * constraint ("customer preference/relationship facts may map lower risk") —
 * but that tier is only reachable through an explicit, non-"behavior"
 * `fact.authorityDomain`, never through the keyword classifier, which only
 * ever escalates toward a protected domain.
 *
 * `behavior` is intentionally set to `"high"`, not a lenient default: it is
 * the EXACT value `graphiti-client.ts`'s `toGraphFact()` hardcodes onto
 * every real fact today, regardless of content, because Graphiti's wire
 * contract has no domain concept at all. It therefore carries no genuine
 * "this is low-stakes" signal — it means "the adapter told us nothing." A
 * review finding demonstrated that treating it as a mid-tier default let
 * unmatched protected-domain content (content the keyword patterns hadn't
 * anticipated) silently resolve to `"medium"`. Since content classification
 * is inherently incomplete (natural language has more synonyms than any
 * fixed pattern list), the untriaged/uninformative bucket gets the paranoid
 * ceiling instead: only a genuinely-known domain (`operational_state`,
 * `product_policy`, or the explicitly-lower `relationship`/
 * `customer_preference`) is treated as ordinary risk. This is the single
 * source of truth for risk-by-domain in this mapper — `mapGraphFact` never
 * reads `fact.risk` from the input, see its doc comment for why.
 */
const DOMAIN_RISK: Record<AuthorityDomain, MemoryRisk> = {
  commercial_status: "high",
  consent: "high",
  legal: "high",
  behavior: "high",
  operational_state: "medium",
  product_policy: "medium",
  relationship: "low",
  customer_preference: "low",
};

/**
 * Classifies which authority domain a graph-inferred fact actually touches,
 * from the fact TEXT — never from Graphiti's own confidence/relevance score,
 * and never solely from `fact.authorityDomain` as supplied by the adapter.
 *
 * `graphiti-client.ts`'s `toGraphFact()` currently hardcodes every fact's
 * `authorityDomain` to the neutral `"behavior"` value, because Graphiti's
 * wire contract (`FactResult`) has no domain concept at all — that is a
 * placeholder chosen to be maximally conservative on confidence/risk, not a
 * real classification. Trusting it here would let a consent/payment/contract
 * fact slip through this mapper unprotected merely because the upstream
 * adapter had nothing better to say. This function derives its own signal
 * from the fact text instead, and only falls back to `fact.authorityDomain`
 * when none of the protected keyword patterns match (which also correctly
 * preserves an already-protected input domain if a future, smarter adapter
 * ever supplies one).
 */
function classifyDomain(fact: GraphFact): AuthorityDomain {
  if (CONSENT_PATTERN.test(fact.text)) return "consent";
  if (CONTRACT_PATTERN.test(fact.text)) return "legal";
  if (PAYMENT_PATTERN.test(fact.text)) return "commercial_status";
  return fact.authorityDomain;
}

/**
 * Assigns a conservative authority/risk envelope to a fact retrieved from
 * Graphiti (Task 4's `GraphContextPort.search()`), producing a `ContextItem`
 * shaped like the one Mem0's provider already emits
 * (`lib/agent-engine/context/mem0-context-provider.ts`) so downstream
 * ranking/fusion (`lib/agent-engine/context/fusion.ts`) can treat graph facts
 * and semantic memories uniformly.
 *
 * Binding invariants (Phase 4 plan, global constraints):
 * - consent/payment/contract facts always map to `risk: "high"` and
 *   `actionable: false`. This cannot be relaxed by a high `fact.confidence`
 *   or by whatever `fact.authorityDomain` the adapter attached — domain
 *   classification is entirely keyword/content driven (`classifyDomain`),
 *   and `fact.confidence` never participates in the risk decision for any
 *   domain, protected or not;
 * - customer_preference/relationship facts may carry a lower risk tier, but
 *   their `authorityLevel` still comes from the SAME derived-authority scale
 *   Mem0 already uses for the identical domains
 *   (`getAuthorityLevel`, exported by `mem0-context-provider.ts` precisely
 *   for this kind of cross-provider reuse) — never a scale that reads as
 *   "official" system-of-record data;
 * - `actionable` is `false` for every domain in this phase. Graphiti is
 *   OFF/SHADOW-only doctrine-wide (`lib/agent-engine/graph/port.ts`,
 *   `types.ts`: "no GraphFact ... may by itself authorize a HIGH-risk
 *   action while the feature is OFF/SHADOW"), and no task in this plan has
 *   defined a criterion for when a graph fact should be allowed to
 *   authorize an action at all. Widening this is a distinct future decision,
 *   not something this mapper should infer.
 *
 * `fact.confidence` is passed through on the output unchanged, for
 * transparency and downstream tie-breaking (e.g. `fusion.ts`'s ranking), but
 * it is read nowhere in the risk/authority decision above.
 */
export function mapGraphFact(fact: GraphFact): ContextItem {
  const authorityDomain = classifyDomain(fact);

  return contextItemSchema.parse({
    id: fact.id,
    provider: "graphiti",
    authorityDomain,
    authorityLevel: getAuthorityLevel(authorityDomain),
    confidence: fact.confidence,
    occurredAt: fact.validFrom,
    expiresAt: fact.validUntil,
    risk: DOMAIN_RISK[authorityDomain],
    actionable: false,
    sourceId: fact.sourceId,
    text: fact.text,
  });
}
