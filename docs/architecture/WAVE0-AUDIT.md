# Wave 0: Mapeamento e Auditoria (Matrix)

Este documento atende ao passo "Wave 0 — Audit" do **Lumenva Autonomous Growth OS - Master Blueprint V1**. O objetivo é mapear o estado atual dos três repositórios envolvidos (`Lumenva`, `lumenva-social`, `lumenva-social-brain`) e definir o destino de cada módulo.

## Legenda de Ações
- **[REUSE]**: Código estável e aderente ao blueprint. Permanece no local atual.
- **[MOVE]**: Código que será extraído de um repositório e movido para o canônico.
- **[EXTEND]**: Código que precisa ser adaptado (ex: envelopar com MCP ou adicionar idempotência).
- **[DEPRECATE]**: Código que será mantido temporariamente por retrocompatibilidade, mas substituído por um Agent ou MCP.
- **[DELETE]**: Código morto, concorrente ou substituído pelo novo design.

---

## 1. Repositório: `Lumenva` (Core OS)
*Papel definitivo: Cérebro, Maestri, Agent OS, CRM, Content OS, policies.*

| Caminho / Módulo | Estado Atual | Ação | Destino / Notas |
| :--- | :--- | :--- | :--- |
| `apps/crm/` | Core CRM existente | **[REUSE]** | Será integrado com a *Lead Engine* (Wave 9) |
| `apps/site/` | Site público e blog | **[REUSE]** | Ponto de publicação para o *Blog Engine* (Wave 16) |
| `packages/operating-core/` | Base de runtime/agents | **[EXTEND]** | Evoluir para suportar Model Router e Quota Router (Wave 3) |
| `workers/voice-worker/` | Infra de voz | **[REUSE]** | Integra na *Creative Factory* (Wave 5) |
| `docs/MAESTRI_NOTE_*` | Artefatos residuais | **[DELETE]** | (Já limpos via Git na sessão anterior) |

---

## 2. Repositório: `lumenva-social-brain`
*Papel definitivo: Runtime social, jobs, publicação, approvals e analytics. (Superfície Canônica de Social)*

| Caminho / Módulo | Estado Atual | Ação | Destino / Notas |
| :--- | :--- | :--- | :--- |
| `supabase/` | Schemas de jobs/approval | **[REUSE]** | Base para o *Social Engine* (Wave 17) |
| `packages/` | Regras de negócio | **[EXTEND]** | Precisa expor portas para o `growth-data-mcp` |
| `apps/` | Painel de controle social | **[EXTEND]** | Adaptar para refletir o *Event Model* e Jobs (Wave 24/25) |

---

## 3. Repositório: `lumenva-social`
*Papel definitivo: Repositório legado para extração. Será descontinuado gradualmente.*

| Caminho / Módulo | Estado Atual | Ação | Destino / Notas |
| :--- | :--- | :--- | :--- |
| `lib/meta-adapters/` (exemplo) | Adapters testados (Insta/FB) | **[MOVE]** | Migrar para `lumenva-social-brain/packages/integrations/meta` |
| `drizzle/` | Schemas legados locais | **[DEPRECATE]**| Substituir pelo schema canônico do `lumenva-social-brain` |
| `app/` | UI local legada | **[DELETE]** | A UI oficial será o Maestri/CRM + Social Brain unificado |
| `AGENTS.md` | Doutrina isolada | **[DELETE]** | A doutrina oficial será o `CLAUDE.md` do repo principal |

---

## Próximos Passos (Wave 1 Preparatory)
1. Iniciar a migração física dos módulos marcados como **[MOVE]** do `lumenva-social` para o `lumenva-social-brain`.
2. Após o esvaziamento, arquivar o `lumenva-social`.
3. Criar os pacotes base de `Campaign`, `Content`, `Asset` e `Approval` no core do `Lumenva` (Início da Wave 1).
