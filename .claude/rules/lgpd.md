# LGPD — DeskcommCRM

> Regra modular compartilhada. Em caso de conflito, `CLAUDE.md` da raiz vence. PRD/Spec e catálogo L-xx definem o contrato exato.

## Princípio

LGPD é caminho normal de produto, não exceção administrativa. Dados pessoais precisam de consentimento, export, anonimização/redact e audit desde a origem.

## Anonimização e delete

- **Anonimização é preferida sobre delete físico** quando existem referências históricas (`crm_leads`, pedidos, activities, messages etc.).
- Delete físico é raro e só cabe quando o contrato/worker comprova ausência de dependências ou quando um processo manual explicitamente autorizado exigir.
- Nome/identidade visível passa para a forma anonimizada definida pelo fluxo vigente (historicamente `Cliente Anonimizado #N`), e os identificadores pessoais são removidos/transformados conforme a implementação canônica.
- Anonimização é **irreversível**. Tentativa de restaurar PII em contato anonimizado deve falhar com `403 lgpd_anonymization_irreversible` conforme contrato vigente.

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

## SLAs

Business rules vigentes:

- **data request/export:** entrega em até **D+7 dias úteis**;
- **redact:** execução completa em até **D+15 dias úteis** após aprovação.

Alertas prévios e exceções documentadas seguem L-02/L-03. Não altere esses valores por conveniência de implementação.

## Consentimento

Consentimento é granular por finalidade, com as categorias canônicas documentadas:

- `marketing`;
- `transactional`;
- `profiling`.

Comunicação automatizada verifica consentimento e bloqueio/opt-out conforme as rules do canal. Exceções transacionais devem vir da business rule vigente, não de suposição do agente.

## Audit obrigatório

Operações LGPD e mutações de dados sensíveis deixam audit adequado. Actions canônicas históricas/vigentes incluem:

- `lgpd.data_request_received`;
- `lgpd.export_generated`;
- `lgpd.redact_executed`;
- `lgpd.consent_changed`.

O audit do redact precisa indicar actor, titular/recurso, modo e alcance do cascade sem reintroduzir PII indevida no próprio log.

## Dados sensíveis

- CPF não vai para logs, Sentry, screenshots ou dumps.
- CPF persiste criptografado at-rest conforme L-07 quando coletado.
- Chaves de criptografia ficam fora do repo e separadas por finalidade conforme a spec.
- Tokens OAuth/credenciais de integração seguem criptografia/segredo do domínio e não entram em evidência de teste.

## Integração com WhatsApp

STOP/opt-out é parte da proteção de consentimento. Um contato bloqueado não recebe outbound automatizado; veja `.claude/rules/whatsapp-waha.md`.

## Fontes

- `docs/prd/01-prd-platform-base.md` §3.6
- `docs/specs/01-spec-platform-base.md`
- `docs/specs/02-spec-customer-360.md`
- `docs/specs/06-spec-nuvemshop-lgpd.md`
- `docs/business-rules/00-business-rules-catalog.md` L-01…L-10
