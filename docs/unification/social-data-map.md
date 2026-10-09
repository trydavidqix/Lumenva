# Social Identity Data Map

## Arquitetura de Unificação: Identidade Social e CRM

Esta documentação descreve a estratégia de unificação de identidades externas (Social) com o modelo canônico de Contatos (CRM), conforme Task 06 do plano de unificação Lumenva.

### Objetivos

1. **Deduplicação Isolada:** Garantir que uma mesma pessoa física interaja em contas de redes sociais diferentes ou em tenants (organizações) diferentes sem colidir os contatos.
2. **Replay Idempotente:** Eventos de ingestão repetidos (como webhooks em retry) não devem duplicar o contato ou o vínculo social.
3. **Consolidação Segura:** Não permitir o merge de contatos apenas com base em nome não verificado.
4. **Isolamento de Domínio:** O CRM continua dono do contato/lead canônico; o Social Brain armazena apenas o adapter, identidade externa e metadados.

### Modelo: `SocialIdentity`

O modelo no `Social Brain` (injetável/não depende de esquema Drizzle neste escopo para evitar bloqueio) representa a identidade na rede externa e seu vínculo com o CRM.

Campos essenciais (interface TypeScript):
- `id`: UUID da identidade social (gerado).
- `organizationId`: ID do tenant atual (derivado do contexto seguro).
- `contactId`: ID do contato no CRM (se vinculado).
- `provider`: Provedor (ex: `instagram`, `facebook`, `whatsapp`).
- `providerAccountId`: O ID da conta oficial da organização na rede social.
- `externalId`: ID único do usuário na rede externa.
- `profileData`: Metadados recebidos (nome, handle, foto).

### Regras do Adapter de Ingestão (`SocialIdentityAdapter`)

A integração da identidade com o CRM segue o fluxo:

1. **Recepção:** Recebe o `provider`, `providerAccountId`, `externalId` e `organizationId`.
2. **Resolução de Chave (Deduplicação):** A identidade é unicamente identificada pela combinação:
   `[organizationId, provider, providerAccountId, externalId]`
3. **Colisão:** Se a chave já existir, o sistema faz um **upsert** idempotent, sem criar novo contato.
4. **Criação Segura de Contato:** Se não existe vínculo, um novo Contato CRM deve ser criado usando uma interface/injetor abstrato. Nomes sociais não verificados (ex: "Maria Silva") não disparam merge automático com um contato existente "Maria Silva" no CRM para evitar falsos positivos; o conflito ou mesclagem é uma operação explícita.
5. **Cross-Tenant:** Um webhook de outra conta ou tenant falhará na busca de contato cruzado, pois o escopo é estrito por `organizationId`.

### Limites e Restrições

- **Sem cópia de Banco:** Não importaremos dados ou instâncias SQLite locais de origens pessoais para o esquema. Todo adaptador foca na tipagem, regras e persistência simulada/abstrata até que uma migration oficial seja definida.
- **Isolamento de Contratos:** Os adapters injetam a dependência `ContactRegistry` abstrata, preservando o modelo canônico de `Contact` do CRM sem dependência cíclica direta no pacote social.
