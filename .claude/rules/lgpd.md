---
paths:
  - "apps/crm/**"
  - "infra/supabase/**"
  - "knowledge/00-Canon/PRIVACY.md"
---

# Privacidade / RGPD do CRM

> Regra operacional resumida. O contrato do produto pertence à fonte canônica do domínio em `docs/index.md`. PRD/Spec e catálogo L-xx definem o contrato exato.
>
> **Nome do arquivo mantido por motivo técnico**: `scripts/check-harness-consistency.mjs` valida a lista de rules do
> harness por nome de arquivo (`lgpd.md`). Renomear o arquivo exige atualizar esse gate + `CLAUDE.md` + `AGENTS.md` +
> `.agents/skills/DeskcommCRM/SKILL.md` + `.claude/rules/security.md` na mesma mudança — não fizemos isso ainda porque
> o ganho é cosmético. O **conteúdo** deste arquivo trata do regime legal que rege o negócio hoje: **RGPD/GDPR**
> (Regulamento (UE) 2016/679), não mais a LGPD brasileira — migração feita em 2026-08-20 (clientela europeia,
> operação sediada em Portugal).

## Princípio

Privacidade é caminho normal de produto, não exceção administrativa. Dados pessoais precisam de consentimento, export, anonimização/redact e audit desde a origem.

## Anonimização e delete

- **Anonimização é preferida sobre delete físico** quando existem referências históricas (`crm_leads`, pedidos, activities, messages etc.).
- Delete físico é raro e só cabe quando o contrato/worker comprova ausência de dependências ou quando um processo manual explicitamente autorizado exigir.
- Nome/identidade visível passa para a forma anonimizada definida pelo fluxo vigente (historicamente `Cliente Anonimizado #N`), e os identificadores pessoais são removidos/transformados conforme a implementação canônica.
- Anonimização é **irreversível**. Tentativa de restaurar PII em contato anonimizado deve falhar com `403 privacy_anonymization_irreversible` conforme contrato vigente (rota: `POST /api/v1/privacy/anonymize`).

## Cascade de redact

O redact deve cobrir o grafo de dados do titular, não apenas a row `contacts`.

No contrato base isso inclui:

- contact/identificadores pessoais;
- conversations preservando o histórico operacional necessário sem reidentificar o titular;
- messages, removendo/redigindo conteúdo pessoal conforme o fluxo;
- mídia pessoal removida do Storage quando a regra exigir;
- activities preservando timestamps/tipos quando necessários ao histórico;
- pedidos/integrações quando a spec do domínio incluir esses dados no cascade.

Use a spec/worker atual para a lista exata; não invente cascade parcial.

## SLAs (RGPD Art. 12(3))

Diferente da LGPD (que usava dias úteis com calendário brasileiro), o RGPD usa **prazo corrido em meses**, igual pra acesso e pra apagamento — não há dois números diferentes por tipo de pedido:

- **prazo padrão:** resposta em até **1 mês corrido** a partir do recebimento (`received_at`), tanto para `data_request` (Art. 15, direito de acesso) quanto para `redact`/`store_redact` (Art. 17, direito ao apagamento);
- **extensão:** até **mais 2 meses** em casos complexos ou de volume elevado — exige notificar o titular por escrito **dentro do 1º mês**, explicando o motivo; o pedido de extensão também é auditado;
- **cálculo canônico:** `computeDueAtGdpr()` em `lib/lgpd/sla.ts` (meses corridos, sem pular fim de semana/feriado — diferente do antigo `computeDueAt()` de dias úteis brasileiros, que continua existindo no módulo mas não é mais usado na criação de solicitações);
- **alarme de acompanhamento:** D+20 (não mais D+5/D+10) — ~10 dias de folga antes do vencimento real, mesmo threshold pros dois tipos de pedido.

Não altere esses valores por conveniência de implementação. Business rules L-02/L-03 (`docs/business-rules/00-business-rules-catalog.md`) documentam a origem exata.

## Notificação de violação de dados (RGPD Art. 33)

Prazo é **fixo em 72 horas** pra notificar a autoridade de controlo competente a partir do momento em que a organização toma conhecimento de uma violação com risco aos titulares — diferente do "prazo razoável" mais vago da LGPD. Se o risco for alto, os titulares afetados também precisam ser notificados sem atraso indevido.

Hoje **não existe mecanismo automatizado** no código pra isso (é processo manual/humano) — ver business rule L-11. Antes de automatizar qualquer parte disso, valide o desenho com um advogado especializado em RGPD; não implemente por suposição.

## Consentimento

Consentimento é granular por finalidade, com as categorias canônicas documentadas:

- `marketing`;
- `transactional`;
- `profiling`.

Comunicação automatizada verifica consentimento e bloqueio/opt-out conforme as rules do canal. Exceções transacionais devem vir da business rule vigente, não de suposição do agente.

## Audit obrigatório

Operações de privacidade e mutações de dados sensíveis deixam audit adequado. Actions canônicas históricas/vigentes incluem (nomes internos mantidos como `lgpd.*` no código — não renomeados, é rótulo interno, não texto visível ao usuário):

- `lgpd.data_request_received`;
- `lgpd.export_generated`;
- `lgpd.redact_executed`;
- `lgpd.consent_changed`.

O audit do redact precisa indicar actor, titular/recurso, modo e alcance do cascade sem reintroduzir PII indevida no próprio log.

## Dados sensíveis

- CPF não vai para logs, Sentry, screenshots ou dumps — regra mantida por segurança, mas é um caso Brasil-específico: nenhum cliente europeu tem CPF, então essa coluna tende a ficar sempre vazia na prática atual do negócio.
- CPF persiste criptografado at-rest conforme L-07 quando coletado.
- Chaves de criptografia ficam fora do repo e separadas por finalidade conforme a spec.
- Tokens OAuth/credenciais de integração seguem criptografia/segredo do domínio e não entram em evidência de teste.

## Integração com WhatsApp

STOP/opt-out é parte da proteção de consentimento. Um contato bloqueado não recebe outbound automatizado; veja `.claude/rules/whatsapp-waha.md`.

## Nuvemshop — dormente pro negócio atual

Os 3 webhooks (`app/api/v1/webhooks/nuvemshop/{store-redact,customer-redact,customer-data-request}`) são os
**únicos** pontos do código que criam uma `lgpd_requests` row (`createLgpdRequest()`). Nuvemshop é uma
plataforma de e-commerce só usada no Brasil/América Latina — sem conectá-la, nenhuma solicitação de
privacidade é criada, e o pipeline inteiro (e-mail ao titular, alarme de SLA) fica inerte. Não é bug: é
esperado enquanto o negócio for 100% europeu. Se um canal de e-commerce europeu equivalente for integrado no
futuro, ele deve chamar `createLgpdRequest()` com `slaMonths: 1` do mesmo jeito.

## Fontes

- `docs/prd/01-prd-platform-base.md` §3.6
- `docs/specs/01-spec-platform-base.md`
- `docs/specs/02-spec-customer-360.md`
- `docs/specs/06-spec-nuvemshop-lgpd.md`
- `docs/business-rules/00-business-rules-catalog.md` L-01…L-11
