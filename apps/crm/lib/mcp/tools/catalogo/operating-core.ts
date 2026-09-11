/**
 * Capacidades read-only da fundação Operating Core (Wave 1).
 */
import { declararTools } from "./tipos";

export const TOOLS_OPERATING_CORE = declararTools([
  {
    name: "crm_list_agents",
    category: "read",
    description: "Lista agentes configurados na organização do token.",
    rotulo: "Listar agentes",
    explicacao:
      "Mostra os agentes configurados na organização, sem expor credenciais ou conteúdo sensível.",
    oQueToca: "Agentes",
    risco: "seguro",
    pacotes: ["organizar"],
  },
  {
    name: "crm_list_jobs",
    category: "read",
    description: "Lista jobs do Agent OS sem payload sensível.",
    rotulo: "Listar jobs",
    explicacao:
      "Mostra o estado e a execução dos jobs da organização, sem revelar o payload de trabalho.",
    oQueToca: "Operação dos agentes",
    risco: "seguro",
    pacotes: ["organizar"],
  },
  {
    name: "crm_list_approvals",
    category: "read",
    description: "Lista pedidos de aprovação sem argumentos ou resultados de execução.",
    rotulo: "Listar aprovações",
    explicacao:
      "Mostra pedidos de aprovação e as suas decisões para acompanhar ações que exigem confirmação humana.",
    oQueToca: "Aprovações",
    risco: "seguro",
    pacotes: ["organizar"],
  },
]);
