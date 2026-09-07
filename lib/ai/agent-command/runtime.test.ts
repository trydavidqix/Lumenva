import { describe, expect, it } from "vitest";

import { parseDeterministicCommand } from "./runtime";

const CONTACT_ID = "88888888-8888-4888-8888-888888888888";

describe("agent command deterministic runtime", () => {
  it("maps the explicit lead-list command without model inference", () => {
    expect(parseDeterministicCommand("  LISTE   os leads  ")).toEqual({
      kind: "tool",
      toolName: "crm_list_leads",
      args: {},
      message: "Leads encontrados.",
    });
  });

  it("keeps the contact search term as tool input", () => {
    expect(parseDeterministicCommand("procure o contacto Maria Silva")).toEqual({
      kind: "tool",
      toolName: "crm_search_contacts",
      args: { query: "Maria Silva" },
      message: "Contactos encontrados.",
    });
  });

  it("requires an explicit contact UUID before planning a note write", () => {
    expect(parseDeterministicCommand(`adicione uma nota ${CONTACT_ID} Retornar amanhã`)).toEqual({
      kind: "tool",
      toolName: "crm_add_lead_note",
      args: { contact_id: CONTACT_ID, note: "Retornar amanhã" },
      message: "A nota será adicionada após confirmação.",
    });

    expect(parseDeterministicCommand("adicione uma nota Retornar amanhã")).toEqual({
      kind: "answer",
      message:
        "Indique primeiro o UUID do contacto e depois a nota: adicione uma nota <contact_id> <texto>.",
    });
  });

  it("answers unsupported commands without proposing a tool", () => {
    expect(parseDeterministicCommand("apague todos os leads")).toEqual({
      kind: "answer",
      message:
        "Comando não suportado. Use: liste os leads; procure o contacto <texto>; ou adicione uma nota <contact_id> <texto>.",
    });
  });
});
