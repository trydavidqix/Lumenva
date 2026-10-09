# Autoridade dos dados e capacidades

Esta tabela distingue o sistema de registro atual, o papel da Lumenva e o que ainda depende de implementação. Um caminho proposto no plano não é prova de que o módulo exista.

| Dado/capacidade | Autoridade atual | Papel da Lumenva na unificação |
|---|---|---|
| Sessão, identidade e organização | Provider de autenticação e sessão já ativos no Lumenva | Validar server-side e derivar o tenant; preservar o provider e os IDs existentes. |
| Contacto e lead | CRM em `apps/crm` | Cadastro canônico. Social leads só se vinculam por regra de identidade verificada e auditável. |
| Conversa e atendimento | Fluxos atuais do CRM; inbox social é módulo Social | Ligar conversa/canal ao contacto canônico; takeover humano prevalece sobre automação. |
| Identidade social externa | Plataforma social para o ID externo; adapter Social Brain para o vínculo local | Guardar origem/account ID e vínculo com o CRM; não deduplicar entre contas sem evidência. |
| Conta social e credencial | Provider/plataforma e mecanismo de segredo já configurados | Reutilizar integração existente. Não criar OAuth paralelo nem copiar token entre apps. |
| Conteúdo, aprovação, publicação e analytics | Módulos existentes do Social Brain e providers conectados, conforme capacidade comprovada | Reconciliar deltas; aprovação vinculada a snapshot; campo/analytics ausente permanece indisponível. |
| Asset e mídia | Storage/provider atualmente configurado e seus adapters existentes | Preservar backend e proveniência/hash disponíveis. Não presumir storage único nem migrar arquivos. |
| Loja, catálogo e produto | Plataforma de loja aprovada para a conta conectada | Lumenva mantém leitura/snapshot e vínculo; não altera catálogo nem troca a fonte. |
| Pedido comercial | Plataforma de loja aprovada | A loja permanece fonte do pedido; Lumenva controla apenas seu workflow, aprovação e receipts locais. |
| Fornecedor, mercado, disponibilidade e custo de origem | Provider/mercado e contratos efetivamente conectados | Registrar origem e timestamp; valores ausentes não viram defaults nem fatos inventados. |
| Preço, frete, fees, impostos e margem | Fontes explícitas do provider/mercado e entradas aprovadas pelo usuário | Cálculo somente com entradas conhecidas; não codificar tarifas ou margens padrão. |
| Job/evento | Contratos atuais do Operating Core e consumidores existentes | Reutilizar o engine dono, manter tenant, dedupe, estado e evidências. |
| Audit/evidência | Audit do CRM e receipts/evidências dos domínios existentes | Registrar actor, tenant, decisão e referências sem segredo/PII desnecessária; não fundir logs distintos sem adapter. |

## Regras de integridade

- Tenant deriva da sessão validada e é comparado com o registro persistido.
- Retry/webhook repetido não duplica mensagem, publicação, importação ou pedido.
- Snapshot alterado, policy revogada ou aprovação revogada bloqueia a ação.
- Estados `submitted` e `unknown` não autorizam repetir uma escrita externa; reconciliar primeiro.
- `read_only` e `simulated` são os modos deste plano para dropshipping. `approved_write` não está habilitado por esta documentação.