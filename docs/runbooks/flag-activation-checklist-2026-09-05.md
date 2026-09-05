# Checklist de ativação das flags RGPD/UE

Estado: preparação local. Todas as flags permanecem desligadas. A ativação deve ser feita pelo dono numa janela aprovada, no gestor de configuração da instalação, sem editar o `.env` versionado.

## Ordem recomendada

1. `LEGAL_BASIS_V1` — base para retenção/finalidade.
2. `ERASURE_DECISION_V1` — depende da classificação de retenção.
3. `RGPD_STATE_MACHINE_V1` — depende dos estados e decisões de privacidade.
4. `DPO_ASSESSMENT_V1` — depende de auditoria/comunicação RGPD.
5. `BREACH_WORKFLOW_V1` — depende de contactos DPO e audit trail.
6. `TRANSFER_GATE_V1=observe`; depois `block` só após inventário.
7. `ECOMMERCE_PROVIDER_V1` — por último, depois de J1/J5/J7 e paridade Nuvemshop.

Cada passo deve ser validado isoladamente. Se falhar, desligar a flag, preservar dados novos e investigar.

## Fichas

### `LEGAL_BASIS_V1`

- Leitura: `lib/lgpd/legal-basis.ts:14`, constante `LEGAL_BASIS_V1`.
- Ligar: `LEGAL_BASIS_V1=true` no ambiente da aplicação.
- Validar: `pnpm exec vitest run tests/unit/lgpd-legal-basis.test.ts`; consulta read-only confirma finalidade, base, versão, timestamp e revogação.
- Falha: consentimento inválido, finalidade ausente, STOP sem efeito ou audit 5xx.
- Rollback: `LEGAL_BASIS_V1=false`.

### `ERASURE_DECISION_V1`

- Leitura: `lib/lgpd/redact-cascade.ts` e consumidores encontrados por `rg -n 'ERASURE_DECISION_V1' lib app`.
- Ligar: `ERASURE_DECISION_V1=true`.
- Validar: suíte de redact e consulta read-only confirmam resultado `erasure` ou `irreversible_anonymisation`, campos retidos e irreversibilidade.
- Falha: pseudonimização chamada apagamento, cascade incompleto ou PII reaparece em replay.
- Rollback: `ERASURE_DECISION_V1=false`.

### `RGPD_STATE_MACHINE_V1`

- Leitura: `lib/lgpd/repository.ts:13`; migration `supabase/migrations/20260905120000_0150_rgpd_state_machine.sql`.
- Ligar: `RGPD_STATE_MACHINE_V1=true`.
- Validar: `pnpm exec vitest run tests/unit/lgpd-state-machine.test.ts`; consultar estados `received/in_review/extension_notified/responded/refused` e `notified_at` quando aplicável.
- Falha: prazo em dias úteis, extensão sem notificação, estado perdido ou replay duplicado.
- Rollback: `RGPD_STATE_MACHINE_V1=false`; manter colunas novas e ler legado.

### `DPO_ASSESSMENT_V1`

- Leitura: `lib/lgpd/dpo-assessment.ts:4`, constante `DPO_ASSESSMENT_V1`.
- Ligar: `DPO_ASSESSMENT_V1=true`.
- Validar: `pnpm exec vitest run tests/unit/lgpd-dpo-assessment.test.ts`; consulta confirma avaliação, responsável e `assessed_at`, sem inferência.
- Falha: todo tenant obrigatório, `dpo_email` sobrescrito ou sem histórico.
- Rollback: `DPO_ASSESSMENT_V1=false`.

### `BREACH_WORKFLOW_V1`

- Leitura: `lib/lgpd/breach.ts:3`, constante `BREACH_WORKFLOW_V1`.
- Ligar: `BREACH_WORKFLOW_V1=true`.
- Validar: `pnpm exec vitest run tests/unit/lgpd-breach.test.ts`; consulta confirma `deadline_at = known_at + 72h`, decisão/notificação e audit sem PII.
- Falha: deadline diferente, job duplicado, risco ausente ou cross-tenant.
- Rollback: `BREACH_WORKFLOW_V1=false`; pausar job sem apagar incidentes.

### `TRANSFER_GATE_V1`

- Leitura: `lib/lgpd/transfer-gate.ts:1`, função `transferGateMode`.
- Ligar faseado: `TRANSFER_GATE_V1=observe`; depois `TRANSFER_GATE_V1=block` com inventário, SCC/TIA e revisão aprovados.
- Validar: testes confirmam provider EEE permitido, provider sem salvaguarda bloqueado e audit emitido.
- Falha: provider fora do EEE passa em `block`, ausência de SCC sem alerta ou modo inválido permissivo.
- Rollback: `TRANSFER_GATE_V1=off`.

### `ECOMMERCE_PROVIDER_V1`

- Leitura: `lib/ecommerce/feature-flag.ts` via `env.ECOMMERCE_PROVIDER_V1`; rota `app/api/v1/webhooks/nuvemshop/[event]/route.ts`.
- Ligar: `ECOMMERCE_PROVIDER_V1=true`.
- Validar: `pnpm exec vitest run tests/unit/ecommerce-provider-contract.test.ts`; replay em sandbox confirma assinatura, uma idempotency key e paridade com legado.
- Falha: assinatura rejeitada, duplicação, currency não ISO, parse LGPD incompleto ou tenant vindo do body.
- Rollback: `ECOMMERCE_PROVIDER_V1=false`.

Comandos de inspeção e rollback também estão em `scripts/cutover/flag-activation-check.sh`. Este runbook não liga flags nem altera produção.
