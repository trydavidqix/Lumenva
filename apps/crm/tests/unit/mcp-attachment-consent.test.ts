import { describe, expect, it } from "vitest";

import { crmUploadLeadAttachment } from "@/lib/mcp/tools/attachments";

/**
 * `crm_upload_lead_attachment` ganhou dois campos obrigatórios (redesign de
 * consentimento): `description` e `client_consented`. Antes, a tool subia o
 * anexo mais recente do WhatsApp direto pro Drive sem o agente perguntar nada
 * ao cliente — nem o QUE era o arquivo, nem SE ele autorizava guardar.
 *
 * Estes dois campos são o contrato que FORÇA a sequência (pergunta →
 * autorização → upload): sem eles no schema, nada impede o modelo de chamar a
 * tool no primeiro turno em que um anexo chega.
 */
describe("crm_upload_lead_attachment — schema de consentimento", () => {
  describe("description", () => {
    it("recusa ausente/curta demais — o agente não perguntou o que é o arquivo", () => {
      expect(crmUploadLeadAttachment.inputSchema.description.safeParse(undefined).success).toBe(false);
      expect(crmUploadLeadAttachment.inputSchema.description.safeParse("").success).toBe(false);
      expect(crmUploadLeadAttachment.inputSchema.description.safeParse("oi").success).toBe(false);
    });

    it("recusa string só de espaço (trim reduz abaixo do mínimo)", () => {
      expect(crmUploadLeadAttachment.inputSchema.description.safeParse("   ").success).toBe(false);
    });

    it("aceita descrição real e preserva o texto (trim, sem reescrever)", () => {
      const r = crmUploadLeadAttachment.inputSchema.description.safeParse("foto do comprovante de pagamento");
      expect(r.success).toBe(true);
      expect(r.success && r.data).toBe("foto do comprovante de pagamento");
    });

    it("recusa acima de 200 caracteres", () => {
      expect(crmUploadLeadAttachment.inputSchema.description.safeParse("a".repeat(201)).success).toBe(false);
      expect(crmUploadLeadAttachment.inputSchema.description.safeParse("a".repeat(200)).success).toBe(true);
    });
  });

  describe("client_consented", () => {
    it("recusa ausente — silêncio não é autorização", () => {
      expect(crmUploadLeadAttachment.inputSchema.client_consented.safeParse(undefined).success).toBe(false);
    });

    it("recusa `false` explícito — não é opcional silencioso, é bloqueio ativo", () => {
      expect(crmUploadLeadAttachment.inputSchema.client_consented.safeParse(false).success).toBe(false);
    });

    it("recusa qualquer valor que não seja o literal `true` (string 'true', 1, etc.)", () => {
      expect(crmUploadLeadAttachment.inputSchema.client_consented.safeParse("true").success).toBe(false);
      expect(crmUploadLeadAttachment.inputSchema.client_consented.safeParse(1).success).toBe(false);
    });

    it("só aceita o literal `true`", () => {
      expect(crmUploadLeadAttachment.inputSchema.client_consented.safeParse(true).success).toBe(true);
    });
  });

  it("a description da tool para o modelo documenta a sequência obrigatória (pergunta antes de autorização)", () => {
    // Não é enfeite: é a única instrução que o modelo lê antes de decidir chamar
    // a tool. Se a ordem sumir do texto, o schema ainda bloqueia — mas o
    // modelo tentaria e erraria a esmo em vez de perguntar direito de cara.
    const desc = crmUploadLeadAttachment.description;
    const idxPergunta = desc.indexOf("pergunte ao cliente");
    const idxAutorizacao = desc.indexOf("autorização");
    expect(idxPergunta).toBeGreaterThan(-1);
    expect(idxAutorizacao).toBeGreaterThan(-1);
    expect(idxPergunta).toBeLessThan(idxAutorizacao);
  });
});
