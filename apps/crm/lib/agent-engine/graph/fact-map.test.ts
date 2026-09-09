import { describe, expect, it } from "vitest";

import { getAuthorityLevel } from "../context/mem0-context-provider";
import { mapGraphFact } from "./fact-map";
import type { GraphFact } from "./types";

function fact(overrides: Partial<GraphFact> = {}): GraphFact {
  return {
    id: "fact-1",
    text: "Cliente prefere ser contatado à tarde.",
    sourceId: "episode-1",
    validFrom: "2026-08-01T10:00:00.000Z",
    validUntil: null,
    confidence: 0,
    authorityDomain: "behavior",
    risk: "high",
    ...overrides,
  };
}

describe("mapGraphFact", () => {
  describe("protected domains always map risk:high and never actionable", () => {
    it("maps a consent-touching fact to consent/high/non-actionable", () => {
      const item = mapGraphFact(fact({ text: "O cliente deu consentimento para receber marketing por WhatsApp." }));

      expect(item.authorityDomain).toBe("consent");
      expect(item.risk).toBe("high");
      expect(item.actionable).toBe(false);
    });

    it("maps a payment-touching fact to commercial_status/high/non-actionable", () => {
      const item = mapGraphFact(fact({ text: "O cliente está inadimplente na fatura de julho." }));

      expect(item.authorityDomain).toBe("commercial_status");
      expect(item.risk).toBe("high");
      expect(item.actionable).toBe(false);
    });

    it("maps a contract-touching fact to legal/high/non-actionable", () => {
      const item = mapGraphFact(fact({ text: "O contrato foi assinado com a cláusula de renovação automática." }));

      expect(item.authorityDomain).toBe("legal");
      expect(item.risk).toBe("high");
      expect(item.actionable).toBe(false);
    });

    it("does not let a maximal Graphiti confidence downgrade a consent fact", () => {
      const item = mapGraphFact(
        fact({ text: "Cliente revogou o consentimento (opt-out) de marketing.", confidence: 1 }),
      );

      expect(item.risk).toBe("high");
      expect(item.actionable).toBe(false);
      expect(item.confidence).toBe(1);
    });

    it("does not let a maximal Graphiti confidence downgrade a payment fact", () => {
      const item = mapGraphFact(fact({ text: "Reembolso (refund) processado via cartão de crédito.", confidence: 1 }));

      expect(item.risk).toBe("high");
      expect(item.actionable).toBe(false);
    });

    it("does not let a maximal Graphiti confidence downgrade a contract fact", () => {
      const item = mapGraphFact(fact({ text: "Termos de serviço aceitos pelo cliente.", confidence: 1 }));

      expect(item.risk).toBe("high");
      expect(item.actionable).toBe(false);
    });

    it("stays protected even when the adapter already supplies a protected authorityDomain with no keyword match", () => {
      const item = mapGraphFact(
        fact({ text: "Detalhe operacional interno sem palavras-chave.", authorityDomain: "legal" }),
      );

      expect(item.authorityDomain).toBe("legal");
      expect(item.risk).toBe("high");
      expect(item.actionable).toBe(false);
    });
  });

  describe("keyword-recall regression cases (review finding: realistic phrasing bypassed the original narrower patterns)", () => {
    it("maps 'saldo devedor' payment phrasing to commercial_status/high, not the neutral fallback", () => {
      const item = mapGraphFact(fact({ text: "Cliente possui saldo devedor pendente de regularização." }));

      expect(item.authorityDomain).toBe("commercial_status");
      expect(item.risk).toBe("high");
      expect(item.actionable).toBe(false);
    });

    it("maps 'permitiu o uso' consent phrasing to consent/high, not the neutral fallback", () => {
      const item = mapGraphFact(fact({ text: "Cliente permitiu o uso do número para futuras campanhas." }));

      expect(item.authorityDomain).toBe("consent");
      expect(item.risk).toBe("high");
      expect(item.actionable).toBe(false);
    });

    it("maps 'autorizou o uso dos dados' consent phrasing to consent/high", () => {
      const item = mapGraphFact(fact({ text: "Cliente autorizou o uso dos dados para marketing." }));

      expect(item.authorityDomain).toBe("consent");
      expect(item.risk).toBe("high");
    });

    it("maps 'concordou em receber' consent phrasing to consent/high", () => {
      const item = mapGraphFact(fact({ text: "Cliente concordou em receber promoções por WhatsApp." }));

      expect(item.authorityDomain).toBe("consent");
      expect(item.risk).toBe("high");
    });

    it("maps 'pagamento em atraso' payment phrasing to commercial_status/high", () => {
      const item = mapGraphFact(fact({ text: "Pagamento em atraso há dois meses." }));

      expect(item.authorityDomain).toBe("commercial_status");
      expect(item.risk).toBe("high");
    });

    it("maps 'débito em aberto' payment phrasing to commercial_status/high", () => {
      const item = mapGraphFact(fact({ text: "Cliente está com débito em aberto no financeiro." }));

      expect(item.authorityDomain).toBe("commercial_status");
      expect(item.risk).toBe("high");
    });

    it("maps 'assinou o contrato' / renovação automática phrasing to legal/high", () => {
      const item = mapGraphFact(fact({ text: "Cliente assinou o contrato com renovação automática." }));

      expect(item.authorityDomain).toBe("legal");
      expect(item.risk).toBe("high");
    });
  });

  describe("customer preference / relationship facts may map lower risk", () => {
    it("maps an ordinary preference fact to customer_preference/low risk with derived authority", () => {
      const item = mapGraphFact(
        fact({ text: "Cliente prefere ser contatado à tarde.", authorityDomain: "customer_preference" }),
      );

      expect(item.authorityDomain).toBe("customer_preference");
      expect(item.risk).toBe("low");
      expect(item.actionable).toBe(false);
      // Derived authority: the SAME scale Mem0 uses for the identical
      // domain, never an invented "official" number.
      expect(item.authorityLevel).toBe(getAuthorityLevel("customer_preference"));
    });

    it("maps an ordinary relationship fact to relationship/low risk with derived authority", () => {
      const item = mapGraphFact(
        fact({ text: "Cliente é indicado por outro cliente fidelizado.", authorityDomain: "relationship" }),
      );

      expect(item.authorityDomain).toBe("relationship");
      expect(item.risk).toBe("low");
      expect(item.actionable).toBe(false);
      expect(item.authorityLevel).toBe(getAuthorityLevel("relationship"));
    });

    it("does not classify an ordinary preference fact as a protected domain", () => {
      const item = mapGraphFact(
        fact({ text: "Cliente prefere receber novidades por e-mail.", authorityDomain: "customer_preference" }),
      );

      expect(item.authorityDomain).not.toBe("consent");
      expect(item.authorityDomain).not.toBe("legal");
      expect(item.authorityDomain).not.toBe("commercial_status");
      expect(item.risk).not.toBe("high");
    });
  });

  describe("the uninformative 'behavior' adapter default gets the paranoid ceiling, not a lenient default", () => {
    it("maps unmatched text under the 'behavior' fallback to risk:high, since that value is Graphiti's known-uninformative sentinel, not a real classification", () => {
      const item = mapGraphFact(
        fact({ text: "Cliente demonstrou interesse pelo plano avançado.", authorityDomain: "behavior" }),
      );

      expect(item.authorityDomain).toBe("behavior");
      expect(item.risk).toBe("high");
      expect(item.actionable).toBe(false);
    });

    it("still maps a genuinely non-behavior, non-protected explicit domain (e.g. operational_state) to its own medium tier", () => {
      const item = mapGraphFact(
        fact({ text: "Sessão do WhatsApp reconectada às 10h.", authorityDomain: "operational_state" }),
      );

      expect(item.authorityDomain).toBe("operational_state");
      expect(item.risk).toBe("medium");
      expect(item.actionable).toBe(false);
    });
  });

  it("passes confidence through unchanged for downstream ranking", () => {
    const item = mapGraphFact(fact({ confidence: 0.42 }));

    expect(item.confidence).toBe(0.42);
  });

  it("maps id/sourceId/text/occurredAt/expiresAt straight from the fact", () => {
    const source = fact({
      id: "fact-42",
      sourceId: "episode-42",
      text: "Cliente confirmou interesse no produto X.",
      validFrom: "2026-08-05T00:00:00.000Z",
      validUntil: "2026-09-05T00:00:00.000Z",
      authorityDomain: "behavior",
    });

    const item = mapGraphFact(source);

    expect(item.id).toBe("fact-42");
    expect(item.sourceId).toBe("episode-42");
    expect(item.text).toBe("Cliente confirmou interesse no produto X.");
    expect(item.occurredAt).toBe("2026-08-05T00:00:00.000Z");
    expect(item.expiresAt).toBe("2026-09-05T00:00:00.000Z");
    expect(item.provider).toBe("graphiti");
  });
});
