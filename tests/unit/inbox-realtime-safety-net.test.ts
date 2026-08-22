import { describe, expect, it } from "vitest";

import { assinaturaMensagens } from "@/hooks/inbox/useMessagesRealtime";
import { assinaturaConversas } from "@/hooks/inbox/useConversationsRealtime";

/**
 * `useMessagesRealtime`/`useConversationsRealtime` chamavam `useRealtimeChannel`
 * mas descartavam o retorno inteiro — nem `ultimaEntrega`, nem
 * `useRefetchDeSeguranca` plugado. Kanban (`useBoard.ts`) e timeline de lead
 * (`useLeadTimeline.ts`) já tinham essa rede de segurança; o inbox (lista de
 * conversas + mensagens dentro da conversa) não tinha NENHUMA — se o canal
 * morresse calado (auth 401 transitório deixando o socket anônimo, RLS
 * filtrando tudo), a tela ficava congelada pra sempre, sem F5.
 *
 * Este arquivo testa as funções de ASSINATURA — o comparador que decide se
 * "algo mudou" entre o antes e o depois do refetch de segurança. A lógica de
 * quando refetch dispara e como o detector distingue "canal entregou" de
 * "canal morreu" já é coberta indiretamente pelo uso idêntico em
 * `useBoard.ts`; aqui a prova é que a assinatura é sensível ao que o canal
 * DEVERIA trazer — mensagem nova, conversa atualizada — sem falso positivo em
 * paginação/reordenação irrelevante.
 */
describe("assinaturaMensagens — detector de perda do canal `messages`", () => {
  const msg = (id: string, created_at: string) => ({ id, created_at }) as never;

  it("undefined (ainda sem dado) tem assinatura estável, não lança", () => {
    expect(assinaturaMensagens(undefined)).toBe("0:");
  });

  it("mesma lista, mesma assinatura — refetch sem novidade não acusa perda", () => {
    const dado = { pages: [{ data: [msg("m1", "2026-08-22T10:00:00Z")] }], pageParams: [undefined] };
    expect(assinaturaMensagens(dado)).toBe(assinaturaMensagens(dado));
  });

  it("mensagem nova muda a assinatura — é o sinal que o detector precisa", () => {
    const antes = { pages: [{ data: [msg("m1", "2026-08-22T10:00:00Z")] }], pageParams: [undefined] };
    const depois = {
      pages: [{ data: [msg("m1", "2026-08-22T10:00:00Z"), msg("m2", "2026-08-22T10:05:00Z")] }],
      pageParams: [undefined],
    };
    expect(assinaturaMensagens(antes)).not.toBe(assinaturaMensagens(depois));
  });

  it("junta todas as páginas (infinite query) — não só a primeira", () => {
    const dado = {
      pages: [
        { data: [msg("m2", "2026-08-22T10:05:00Z")] },
        { data: [msg("m1", "2026-08-22T10:00:00Z")] },
      ],
      pageParams: [undefined, "cursor-1"],
    };
    expect(assinaturaMensagens(dado)).toBe("2:2026-08-22T10:05:00Z");
  });
});

describe("assinaturaConversas — detector de perda do canal `conversations`", () => {
  const conv = (id: string, updated_at: string) => ({ id, updated_at }) as never;

  it("undefined tem assinatura estável, não lança", () => {
    expect(assinaturaConversas(undefined)).toBe("0:");
  });

  it("conversa que sobe pro topo (updated_at mais recente) muda a assinatura", () => {
    const antes = { pages: [{ data: [conv("c1", "2026-08-22T10:00:00Z")] }], pageParams: [undefined] };
    const depois = { pages: [{ data: [conv("c1", "2026-08-22T10:05:00Z")] }], pageParams: [undefined] };
    expect(assinaturaConversas(antes)).not.toBe(assinaturaConversas(depois));
  });

  it("conversa nova na lista muda a assinatura (contagem)", () => {
    const antes = { pages: [{ data: [conv("c1", "2026-08-22T10:00:00Z")] }], pageParams: [undefined] };
    const depois = {
      pages: [{ data: [conv("c1", "2026-08-22T10:00:00Z"), conv("c2", "2026-08-22T09:00:00Z")] }],
      pageParams: [undefined],
    };
    expect(assinaturaConversas(antes)).not.toBe(assinaturaConversas(depois));
  });
});
