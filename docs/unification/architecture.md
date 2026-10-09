# Arquitetura de domínio da Lumenva

## Estado existente

- **CRM:** `apps/crm` é a entrada central do produto e continua dono dos contactos/leads, identidade autenticada, organização, RBAC e fluxos CRM existentes. O tenant é derivado de sessão validada no servidor; um `organizationId` vindo do browser não é autoridade.
- **Jobs e eventos:** reutilizar os contratos existentes em `packages/core/operating-core` e os workers consumidores. Não criar outro scheduler ou engine durante a unificação.
- **Social:** o Social Brain já está incorporado no destino. Reconciliar suas capacidades e deltas com os módulos atuais em `packages/core/social-brain`, `apps/social-web`, `apps/social-worker` e `apps/social-mcp`; igualdade de arquivos ou nomes de diretório não prova equivalência funcional.
- **Drop:** `trydavidqix/Drop` é fonte de contratos e decisões para o domínio de dropshipping. Sua documentação/contratos não significam que runtime, loja, sourcing ou operação comercial já existam no Lumenva.
- **Infraestrutura:** preservar autenticação, banco, storage e providers atualmente ativos. A consolidação não autoriza migração geral nem cópia de tokens entre apps.

## Fronteiras de domínio

- Adaptar contratos existentes na fronteira de cada módulo. Não criar envelope, registry, pacote genérico ou segundo núcleo quando os contratos atuais atendem.
- CRM continua o cadastro canônico de contacto/lead. Social identities e conversas devem ligar-se ao CRM por adapters e regras verificáveis; não fazer merge por nome ou email sem identidade confirmada.
- Conteúdo, aprovação, publicação, analytics e mídia reutilizam os donos já existentes do Social Brain. Uma capacidade só é declarada pronta quando código e evidência no destino a comprovarem.
- A plataforma de loja conectada continua autoridade de catálogo e do pedido comercial. A Lumenva pode guardar snapshots, vínculo, aprovação, estado de workflow e receipts necessários ao seu processo; não substituir o banco da loja.
- Dropshipping permanece read-only/simulado neste plano. Escrita externa só pode entrar em etapa futura com capability autorizada, aprovação humana no momento da ação, idempotência, reconciliação e ambiente/credenciais aprovados.

## Invariantes compartilhadas

- Approval está ligado ao snapshot do conteúdo, destinatário ou pedido. Mudança relevante invalida a aprovação.
- `unknown`, timeout ou resposta atrasada não significa sucesso e não autoriza retry cego, troca de provider ou novo efeito externo; reconciliar antes.
- Eventos/webhooks repetidos precisam de idempotência por domínio e tenant.
- A Task 01 mantém o mapa exato de allowlists e writers. Paths compartilhados, migrations, manifests, exports e workflows têm um único escritor por vez; paths conceituais ou propostos não são ownership confirmado.

## Fora do desenho

Não adicionar autenticação paralela, migração geral de banco/storage, executor arbitrário, scheduler duplicado, loja pronta, checkout ou escrita real em provider. Pacotes e caminhos novos só entram quando uma task demonstrar a lacuna e respeitar a allowlist aprovada.