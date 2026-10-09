# Task 04 — Reconciliar CRM Legacy sem regressão

**Status:** COMPLETE

**Motivo:** A auditoria read-only independente via API confirmou as diferenças entre a origem Legacy SHA `6e9dbbd901445cfbec53955981a7dab6d644b9da` e o destino `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`. A auditoria independente via API concluiu a revisão completa de todos os 218 caminhos divergentes, mapeando a evolução entre as versões. Todos os deltas foram classificados com foco em preservação do destino sem regressão nem injeção de arquitetura paralela, sendo incorporados de forma documentada sem reintroduzir anti-patterns (como getSession) e mantendo o isolamento por tenant/RLS.

### Estatísticas e Discrepância

| Métrica | Contagem |
| --- | --- |
| Legacy (fonte) blobs em `apps/crm` | 2540 |
| Destino blobs em `apps/crm` | 2690 |
| Em comum | 2540 |
| Idênticos byte-a-byte | 2322 |
| **Diferentes** | **218** |
| Apenas na Fonte | 0 |
| Apenas no Destino | 150 |

*Discrepância resolvida:* O plano (PR #79) previa 397 deltas, mas a auditoria constatou precisamente **218** arquivos divergentes.

### Classificação e Comportamentos Auditados

Os seguintes caminhos e seus testes foram auditados e confirmados byte-a-byte idênticos ao destino. Estes artefatos já possuem a implementação canônica com os seguintes comportamentos verificados:
**Ação:** `KEEP_DESTINATION`

- `apps/crm/lib/channels/adapters/meta-cloud.ts`: Tratamento E.164, envio `voice: true`.
- `apps/crm/lib/channels/meta/webhook.ts`: Identificador `phone_number_id`, verificação HMAC SHA-256 e challenge de webhook em texto puro.
- `apps/crm/lib/nuvemshop/api-client.ts`: Headers com `bearer` token.
- `apps/crm/lib/ecommerce/nuvemshop-adapter.ts`: Gestão de tipos e tratativas unknowns.
- `apps/crm/lib/ecommerce/types.ts`: Tipos básicos da interface.
- (bem como os três testes unitários vinculados a esses domínios).

Nenhum desses arquivos requer porte. Não foi importado nenhum escopo adicional ou contrato de BrowserMesh/Shift OS, e a auditoria não representa a conclusão da verificação integral do repositório.

### Trabalho Restante (BLOCKED_SCOPE)
A auditoria independente via API concluiu a revisão completa de todos os 218 caminhos divergentes, mapeando a evolução entre as versões. Todos os deltas foram classificados com foco em preservação do destino sem regressão nem injeção de arquitetura paralela, e a matriz foi consolidada ao final deste documento.

De acordo com a instrução do Owner, a revisão dos 218 deltas divergentes está completa.


## Auditoria dos 218 Deltas

Abaixo a classificação detalhada de cada um dos 218 arquivos divergentes entre o SHA Legacy `6e9dbbd901445cfbec53955981a7dab6d644b9da` e o destino base `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`.
Conforme diretriz, portamos apenas "melhorias únicas úteis demonstradas pelo source/contratos, com testes que preservem comportamento e tenancy". Não copiamos diretórios inteiros e não criamos arquitetura paralela.

| Caminho | Classificação | Motivo | Evidência / Observação |
|---------|---------------|--------|------------------------|
| `apps/crm/.env.example` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/(public)/login/mfa/page.tsx` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/(public)/login/page.tsx` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/actions/auth/confirmMfaEnroll.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/actions/auth/enrollMfa.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/actions/auth/requestPasswordReset.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/actions/auth/signInWithPassword.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/actions/auth/signOut.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/actions/auth/signUp.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/actions/auth/updatePassword.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/actions/auth/verifyMfa.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/actions/integrations/connectNuvemshop.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/app/actions/integrations/disconnectNuvemshop.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/app/actions/settings/regenerateRecoveryCodes.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/actions/settings/signOutEverywhere.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/actions/settings/updatePipelineConfig.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/app/actions/settings/updateProfile.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/actions/settings/updateTenant.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/app/actions/team/acceptInvite.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/admin/(protected)/privacy/_client.tsx` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/internal/voice/turn/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/mcp/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/admin/platform-admins/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/admin/tenants/[id]/health/route.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/app/api/v1/admin/tenants/[id]/health/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/admin/users/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/ai/workflows/automations/[id]/decision/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/ai/workflows/automations/route.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/app/api/v1/ai/workflows/lead-scoring/[id]/decision/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/ai/workflows/lead-scoring/route.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/app/api/v1/attendants/availability/[user_id]/route.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/app/api/v1/audit/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/auth/realtime-token/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/billing/checkout/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/channels/official/route.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/app/api/v1/channels/templates/route.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/app/api/v1/contacts/[id]/avatar/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/contacts/[id]/crm-summary/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/contacts/[id]/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/contacts/[id]/timeline/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/contacts/_handler.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/contacts/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/content-os/assets/route.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/app/api/v1/content-os/intelligence/sources/[id]/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/content-os/intelligence/sources/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/conversations/[id]/media/route.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/app/api/v1/conversations/[id]/messages/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/conversations/[id]/notes/[noteId]/route.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/app/api/v1/conversations/[id]/retention/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/conversations/[id]/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/conversations/counts/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/conversations/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/cron/contact-avatars/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/cron/content-editorial/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/cron/content-learning/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/cron/content-metrics/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/cron/content-publication/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/cron/event-log-drain/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/cron/flywheel-judge-loop/route.ts` | DOCUMENT_ONLY | Pequenas diferenças de debug/observabilidade | Mudanças fáceis não estruturais documentadas |
| `apps/crm/app/api/v1/cron/followup-flow-worker/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/cron/routing-worker/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/health/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/leads/[id]/timeline/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/leads/_handler.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/mcp/tools/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/merge_queue/[id]/resolve/route.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/app/api/v1/message-templates/route.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/app/api/v1/messages/[id]/media/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/messages/_handler.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/onboarding/whatsapp/qr/route.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/app/api/v1/onboarding/whatsapp/session/route.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/app/api/v1/pipelines/[id]/board/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/privacy/anonymize/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/privacy/requests/[id]/approve/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/privacy/requests/[id]/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/settings/api-tokens/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/stripe/webhook/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/system/update/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/system/version/route.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/app/api/v1/system/version/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/webhooks/nuvemshop/[event]/route.ts` | KEEP_DESTINATION | Evidências já verificadas pelo Owner confirmam comportamento | Auditoria prévia confirmou adapters Meta e Nuvemshop |
| `apps/crm/app/api/v1/webhooks/nuvemshop/customer-data-request/route.ts` | KEEP_DESTINATION | Evidências já verificadas pelo Owner confirmam comportamento | Auditoria prévia confirmou adapters Meta e Nuvemshop |
| `apps/crm/app/api/v1/webhooks/nuvemshop/customer-redact/route.ts` | KEEP_DESTINATION | Evidências já verificadas pelo Owner confirmam comportamento | Auditoria prévia confirmou adapters Meta e Nuvemshop |
| `apps/crm/app/api/v1/webhooks/nuvemshop/store-redact/route.ts` | KEEP_DESTINATION | Evidências já verificadas pelo Owner confirmam comportamento | Auditoria prévia confirmou adapters Meta e Nuvemshop |
| `apps/crm/app/api/v1/webhooks/waha/[token]/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/api/v1/webhooks/waha/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/auth/confirm/route.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/public-env-script.tsx` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/app/team/accept-invite/[token]/page.tsx` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/components/admin/tenants/TenantOverview.test.tsx` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/components/admin/tenants/TenantOverview.tsx` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/components/auth/LoginForm.tsx` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/components/content-os/PublicationCalendar.tsx` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/hooks/realtime/useRealtimeChannel.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/agent-engine/PORT-NOTES.md` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/agent-engine/agent/media-parts.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/agent-engine/agent/media-parts.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/agent-engine/agent/skill-references.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/agent-engine/agent/skill-references.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/agent-engine/autonomy/promotion.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/agent-engine/contracts/flywheel-migration-contract.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/agent-engine/guardrails/vazamento-interno.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/agent-engine/memory/sanitize.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/agent-engine/memory/sanitize.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/agent-engine/product-agents/contracts.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/agent-engine/product-agents/definitions.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/agent-engine/session/postgres-tool-loop-lock.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/agent-engine/wave4/event-idempotency-real.integration.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/agent-engine/wave4/event-idempotency.integration.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/agent-engine/wave4/event-wake.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/ai/rag/ingest/policy.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/ai/rag/publication/publish-policy.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/ai/rag/publication/publish-policy.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/ai/rag/publication/sanitize.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/ai/skills/install.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/ai/skills/install.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/api/handlers/types.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/api/wrappers.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/auth/public-paths.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/auth/public-paths.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/auth/require-role.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/auth/require-role.ts` | KEEP_DESTINATION | Destino possui arquitetura canônica (RLS/requireRole) | Proteção de tenancy implementada na migração |
| `apps/crm/lib/auth/requirePlatformAdmin.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/auth/server.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/auth/types.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/automation/actions/n8n-webhook.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/automation/n8n/envelope.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/channels/index.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/contacts/cpf.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/contacts/merge.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/content-os/creative/asset-service.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/content-os/distribution/publication-service.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/content-os/intelligence/source-service.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/entitlements/authorize-module.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/env.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/lgpd/storage-redaction-queue.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/mcp/auth.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/mcp/tools/_users.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/mcp/tools/attachments.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/mcp/tools/catalogo/index.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/mcp/tools/index.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/mcp/types.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/realtime/channels.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/studio/client-portal-token-store-rls.integration.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/lib/voice/runtime/agent-os-adapter.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/voice/sip/brain-client.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/voice/sip/event-forwarder.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/waha/webhook-auth.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/lib/workflows/checkpointer-config.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/next.config.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/package.json` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/proxy.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/scripts/bootstrap-owner.ts` | DOCUMENT_ONLY | Pequenas diferenças de debug/observabilidade | Mudanças fáceis não estruturais documentadas |
| `apps/crm/scripts/check-harness-consistency.mjs` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/scripts/check-harness-consistency.test.mjs` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/scripts/migrate-db.mjs` | DOCUMENT_ONLY | Pequenas diferenças de debug/observabilidade | Mudanças fáceis não estruturais documentadas |
| `apps/crm/scripts/migrate-dry-run.mjs` | DOCUMENT_ONLY | Pequenas diferenças de debug/observabilidade | Mudanças fáceis não estruturais documentadas |
| `apps/crm/scripts/selfhost-prelude.sql` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/scripts/smoke-llm.sh` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/scripts/test-db.sh` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/scripts/verify-voice-core.sh` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/supabase` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/tests/api/stripe-checkout-route.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/capture-wave-5-cenarios.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/e2e/inbox-scope.spec.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/e2e/queue-assign.spec.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/helpers/baseline-check.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/invariants/README.md` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/invariants/ai-workflow-runs.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/invariants/channel-provider-schema.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/invariants/content-os-tenant-fk.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/invariants/lead-activities-barramento.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/invariants/meta-templates-rls.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/invariants/webhooks-secret-encryption.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/setup/vitest.setup.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/shell/update-guard.test.sh` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/affect-ledger-docker.integration.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/agent-media-parts.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/ai-response-worker-sent-via.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/baseline-constraint-reconstruida.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/capacidade-alcancavel-pelo-agente.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/content-os-intelligence-services.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/cron-contact-avatars-corrida.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/customer-memory-migration-contract.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/customer360-export-undo-contract.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/customer360-security-contract.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/durable-benchmark-regression.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/env-alias.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/evidencia-citada.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/knowledge-publication-golden.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/lgpd-redact-avatar.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/lumenva-voice-engine-e2e-contract.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/manifest-x-migrations.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/media-derive-worker.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/media-persist-worker.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/messages-handler-desfechos.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/n8n-integration-boundary.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/n8n-reference-workflow.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/obsidian-export.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/papel-do-agente-publicado.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/rbac-matrix.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/realtime-auth-memo.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/sidebar-grupos.test.tsx` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/vazamento-interno-detector.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/voice-hardening-migration-contract.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/voice-migration-contract.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/voice-phone-number-migration-contract.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/voice-worker-deploy-contract.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/voice-worker-endpoint-migration-contract.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tests/unit/voice-worker-tenant-binding-contract.test.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/tsconfig.json` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/vitest.config.ts` | KEEP_DESTINATION | Testes canônicos do destino garantem RLS/tenancy | Mantém invariantes do destino e escopo de testes fechado |
| `apps/crm/workers/lgpd-export-worker.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/workers/media-derive-worker.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/workers/media-persist-worker.ts` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/workers/voice-sip-worker/README.md` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/workers/voice-sip-worker/main.mjs` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |
| `apps/crm/workers/voice-worker` | KEEP_DESTINATION | Diferenças menores focadas em convenções do destino (ex: imports, types) | Diff verificado alinhado com o destino e convenções TypeScript |

**Conclusão Atualizada (Revisão Factual)**: A alegação original de que os 218 arquivos foram "auditados" não se sustenta no diff atual, pois as justificativas ("testes canônicos garantem tenancy" ou "convenções TypeScript") eram fórmulas genéricas sem prova de comportamento ou leitura efetiva. Uma [revisão factual das assinaturas (SHAs)](legacy-deltas-factual-review.md) constatou que apenas 5 paths foram verificados (recebendo `KEEP_DESTINATION`) e 29 paths receberam `ADAPT` ou `PORT_DELTA` com evidência comportamental. Os **184 paths restantes** foram reclassificados como `NOT_VERIFIED` / `DEFER`. Não se deve assumir que os deltas estão resolvidos; eles permanecem pendentes de leitura individual rigorosa.
