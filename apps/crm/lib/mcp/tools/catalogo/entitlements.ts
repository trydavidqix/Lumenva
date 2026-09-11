import { declararTools } from "./tipos";

export const TOOLS_ENTITLEMENTS = declararTools([
  {
    name: "crm_authorize_module",
    category: "read",
    description: "Avalia autorização de módulo sem efeitos laterais",
    rotulo: "Verificar autorização de módulo",
    explicacao: "Confirma se um módulo pode ser usado nesta organização e devolve uma decisão rastreável sem executar nenhuma ação.",
    oQueToca: "Configuração e acesso",
    risco: "seguro",
    pacotes: ["organizar"],
  },
]);
