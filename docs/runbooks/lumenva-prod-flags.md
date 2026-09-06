# Feature flags de produção — Lumenva

Lista canónica do estado aprovado da instalação Lumenva em produção. Estas
variáveis não são secrets e não são sincronizadas pelo Infisical. Uma
regeneração de `.env` pode removê-las; reaplicar o bloco abaixo depois de cada
setup/update.

Estado operacional de referência: `main @ ed70187c`. Os seis agentes publicados
usam provider OpenAI direto (`gpt-5.6-terra`) via credencial BYOK; Gateway e
OpenRouter não estão ativos na produção, e Anthropic é fallback. Este runbook
documenta flags, não credenciais.

| Flag | Produção | Função | Dependência | Rollback |
|---|---|---|---|---|
| `RGPD_STATE_MACHINE_V1` | `true` | Estados RGPD, extensão e recusa com prazo de um mês corrido. | migration `0150`, `lgpd_requests` | `false` |
| `LEGAL_BASIS_V1` | `true` | Base legal por finalidade e revogação granular. | migration `0152`, `contact_legal_bases` | `false` |
| `DPO_ASSESSMENT_V1` | `true` | Avaliação documentada de obrigação de EPD/DPO por tenant. | migration `0151`, colunas DPO em `organizations` | `false` |
| `ERASURE_DECISION_V1` | `true` | Regista apagamento versus anonimização irreversível. | migration `0153`, `erasure_decisions` | `false` |
| `BREACH_WORKFLOW_V1` | `true` | Registo de incidentes e deadline RGPD de 72 horas. | migration `0154`, `rgpd_breach_incidents` | `false` |
| `TRANSFER_GATE_V1` | `block` | Bloqueia providers com transferência internacional sem SCC. | migration `0155`, `transfer_inventories` | `off` |
| `ECOMMERCE_PROVIDER_V1` | `true` | Usa a camada `EcommerceProvider` no fluxo Nuvemshop. | adapter Nuvemshop; sem migration | `false` |

`TRANSFER_GATE_V1=block` desde 2026-09-05 (decisão do dono). Sem clientes/dados
reais no momento da mudança, portanto risco zero — o gate já fica correto quando
os primeiros dados de UE entrarem. Rollback: `observe` (só observa) ou `off`.

## Bloco para reaplicar na produção

```dotenv
RGPD_STATE_MACHINE_V1=true
LEGAL_BASIS_V1=true
DPO_ASSESSMENT_V1=true
ERASURE_DECISION_V1=true
BREACH_WORKFLOW_V1=true
TRANSFER_GATE_V1=block
ECOMMERCE_PROVIDER_V1=true
```

Rollback é feito alterando a linha correspondente para `false` (ou `off` para
`TRANSFER_GATE_V1`), reiniciando a aplicação conforme a janela aprovada e
validando o caminho legado. Não remover migrations nem apagar dados novos.
