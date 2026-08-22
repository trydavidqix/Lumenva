/**
 * Capacidades de ANEXO — arquivos que o cliente manda no WhatsApp indo pro
 * Google Drive do negócio (lead) dele, via Composio.
 *
 * `description` fala com o modelo; `rotulo`/`explicacao`/`oQueToca` falam com o
 * humano que configura o agente. Ver `docs/handoffs/BRIEFING-ia-360.md` §4.
 */
import { declararTools } from "./tipos";

export const TOOLS_ANEXOS = declararTools([
  {
    name: "crm_upload_lead_attachment",
    category: "write",
    description: "Sobe o anexo mais recente do WhatsApp pro Drive do lead do contato",
    rotulo: "Guardar anexo no Drive da oportunidade",
    explicacao:
      "Quando o cliente manda foto, vídeo ou documento no WhatsApp, o agent pergunta o que é e pede autorização antes de guardar — só então salva na pasta do Google Drive dedicada à oportunidade dele, com data/hora no nome, e deixa registrado na timeline. Precisa da conexão Composio com Google Drive.",
    oQueToca: "Funil de vendas",
    risco: "atencao",
    pacotes: ["vender"],
  },
]);
