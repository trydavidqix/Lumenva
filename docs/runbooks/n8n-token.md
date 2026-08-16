# n8n: provisionamento de token CRM (least-privilege)

## Escopo

Este runbook cobre **só o token `api_tokens` que um workflow n8n usa para chamar
o CRM** (`n8n -> CRM`, via `/api/mcp`). O caminho inverso (`CRM -> n8n`, action
`n8n_webhook`/`call_webhook`) tem HMAC próprio e não depende deste token — veja
`docs/runbooks/n8n.md` (stack standalone, Task 5) quando existir.

Não existe token/scope novo criado por esta doutrina. O mecanismo é o mesmo
`api_tokens` + MCP bearer que já serve qualquer outro consumidor externo
(Spec 11). Isto documenta como usá-lo com o menor privilégio possível para um
workflow n8n.

## Onde gerar o token (UI existente)

1. Como usuário com role `admin` na organização, acesse
   `/app/settings/api-tokens` (`app/app/settings/api-tokens/page.tsx` — a
   página redireciona para `/403` se a role ativa for menor que `admin`).
2. Clique **Criar token**, dê um nome que identifique o workflow n8n (ex.:
   `n8n - notificação de lead ganho`), marque os escopos (próxima seção) e,
   se o workflow tiver prazo de vida conhecido, preencha **Expira em (dias)**
   (1–365; sem preencher, o token não expira).
3. O modal seguinte mostra o **plaintext do token uma única vez**
   (`dsk_<prefix>_<secret>`), com o aviso "Copie e guarde agora — não
   conseguiremos exibir novamente". Copie para o cofre (próxima seção) antes
   de fechar o modal — a tela não guarda o plaintext em lugar nenhum, e a
   listagem subsequente mostra só `prefix…` truncado.

Isso corresponde a `POST /api/v1/settings/api-tokens`
(`app/api/v1/settings/api-tokens/route.ts`): a rota exige `role: "admin"`
(`requireRole("admin", ...)`), gera `prefix = dsk_<8 hex>`, um segredo
aleatório de 32 bytes, guarda `sha256(plaintext)` em `token_hash` (bytea) e
retorna `{ ...token, plaintext, _warning }` uma vez, com `status: 201`. Não há
como recuperar o plaintext depois — nem o banco nem a API guardam a forma
reversível.

Nunca cole um plaintext real neste runbook, em issue, PR, log ou fixture de
teste. Onde for preciso ilustrar formato, use um placeholder como
`dsk_<one-time-token>`.

## Escopos recomendados

O UI de criação (`ApiTokensClient.tsx`) expõe checkboxes de scope; para um
token n8n, marque só o que o workflow realmente precisa:

| Escopo marcado | Efeito |
|---|---|
| `mcp:read` | Habilita as tools `category: "read"` do catálogo MCP (`ensureScope` em `lib/mcp/auth.ts`). Marque sempre que o workflow só consulta o CRM. |
| `mcp:write` | Habilita as tools `category: "write"`/`"handoff"` (mutação real: criar/editar lead, mover stage, enviar WhatsApp, pedir handoff, etc.). Marque **só se o workflow genuinamente muta dado do CRM** — nunca por padrão/conveniência. |
| `role:manager` | Eleva o role efetivo do token de `agent` (default implícito quando nenhum `role:*` é marcado — `lib/mcp/auth.ts` função `scopesRole`) para `manager`. Marque **só se a tool específica que o workflow chama exigir `requiresRole: "manager"`** (ex.: `crm_create_stage`, `crm_update_stage`, `crm_archive_stage`, `crm_set_automation_rule_active`, `crm_close_demand` — veja `tests/unit/n8n-mcp-scope.test.ts` para a lista viva). |

Não marque `role:manager` "por garantia": o teste
`tests/unit/n8n-mcp-scope.test.ts` prova que um token `mcp:write` + role
default (`agent`) já é barrado por `ensureRole` com `403` em toda tool
manager-only do catálogo real, exatamente o comportamento esperado de um
token de menor privilégio.

**Nunca marque um escopo `role:admin` como default de conveniência.** Hoje
nenhuma tool MCP do catálogo real exige `role: "admin"` (mesmo teste garante
isso), então não existe cenário legítimo de pilot n8n que precise dele; se um
dia existir, isso é uma decisão de produto explícita, não um atalho de
provisionamento.

Os demais checkboxes da tela (`contacts:read`, `leads:write`,
`messages:read`, `audit:read`, etc.) são escopos legados/aditivos de outras
superfícies — nenhuma tool MCP atual os exige (`McpToolDefinition.requiresScope`
só aceita `"mcp:read" | "mcp:write"`, `lib/mcp/types.ts`). Não marque-os para
um token cujo único uso é MCP; eles não abrem nem fecham nada nesse caminho e
só ampliam a superfície nominal do token.

### Exemplo de perfil por caso de uso

- **Workflow só lê CRM** (ex.: exportar leads abertos para uma planilha):
  `mcp:read`. Nenhum `role:*` marcado (fica `agent` implícito).
- **Workflow cria/edita lead ou envia WhatsApp a partir de um evento
  externo**: `mcp:read` + `mcp:write`. Nenhum `role:*` marcado — as tools de
  lead/mensagem (`crm_create_lead`, `crm_update_lead`, `crm_move_lead_stage`,
  `crm_send_whatsapp_message`) exigem `requiresRole: "agent"`, coberto pelo
  default.
- **Workflow administra o pipeline** (criar/arquivar etapa, ativar regra de
  automação): `mcp:read` + `mcp:write` + `role:manager`, e só para esse
  workflow específico — não reuse o mesmo token para os casos acima.

## Expiração e revogação

- **Expiração**: campo opcional `expires_in_days` (1–365) na criação vira
  `api_tokens.expires_at`. Passado esse instante, `validateBearerToken`
  (`lib/mcp/auth.ts`) rejeita a chamada com `401` ("Token expired.") antes de
  consultar qualquer tool. Prefira sempre definir uma expiração para um
  token n8n de pilot/teste; só deixe sem expiração um token de produção com
  dono e processo de rotação claros.
- **Revogação**: botão **Revogar** na listagem chama
  `POST /api/v1/settings/api-tokens/{id}/revoke`
  (`app/api/v1/settings/api-tokens/[id]/revoke/route.ts`), também
  `role: "admin"`. É **idempotente**: revogar um token já revogado retorna
  `{ id, already_revoked: true }` em vez de erro. Depois de revogado,
  `validateBearerToken` rejeita com `401` ("Token revoked.") mesmo que o
  token não tenha expirado.
- Revogue imediatamente qualquer token n8n suspeito de vazamento (log de
  workflow exposto, credencial compartilhada indevidamente, instância n8n
  comprometida) — não espere expiração natural.

Toda criação e revogação gera `api_audit_log` (`action: "token.created"` /
`"token.revoked"`, `resourceType: "api_token"`) com o actor humano que
executou a ação — a metadata registra nome/escopos/expiração, nunca o
plaintext.

## Armazenamento no lado n8n

- Salve o plaintext **uma única vez**, no cofre operacional definido em
  `docs/runbooks/ai-platform-secrets.md` (Infisical para runtime
  controlado — nunca em `.env.example`, repositório, log ou fixture de
  teste).
- No n8n, crie uma credencial do tipo *HTTP Header Auth* (ou equivalente)
  com o header `Authorization: Bearer <plaintext>` — nunca em query string
  (doutrina do repo: API key/token nunca vai em query string). Referencie a
  credencial pelo nome/id do workflow que a usa; não reutilize a mesma
  credencial n8n para workflows com necessidades de escopo diferentes — cada
  perfil de uso (seção anterior) merece seu próprio token, para que revogar
  um workflow comprometido não derrube os demais.
- Se a instância n8n também estiver atrás de um cofre (ex.: Infisical
  integrado ao n8n), a fonte de verdade do segredo continua sendo o cofre —
  o token do CRM nunca deve aparecer em texto claro em export de workflow,
  screenshot ou documentação de credencial.

## Como o workflow chama o CRM

Endpoint MCP: `POST /api/mcp` (`app/api/mcp/route.ts`), transporte MCP
Streamable HTTP, JSON-RPC 2.0.

```http
POST /api/mcp
Authorization: Bearer dsk_<one-time-token>
Content-Type: application/json
```

- `organizationId` do request é resolvido **só** da linha `api_tokens`
  batida pelo hash do bearer (`validateBearerToken`) — nunca de um campo do
  corpo da requisição. Um payload que tentasse referenciar outra
  organização não tem efeito algum: cada tool delega para os mesmos
  handlers REST que filtram toda query por `ctx.organizationId`
  (`tests/unit/n8n-mcp-scope.test.ts` prova isso concretamente para
  `crm_get_lead`/`crm_update_lead` com um `lead_id` real de outra org).
- Erro de auth/scope/role volta como envelope JSON-RPC com o `error.code`
  MCP (`-32001` auth ausente/inválida/expirada/revogada, `-32002` scope ou
  role insuficiente) e o `httpStatus` HTTP correspondente (`401`/`403`).
- Rate limit por organização: `120` chamadas/minuto (`app/api/mcp/route.ts`,
  `checkRateLimit`); excedido retorna `-32000`/`429`. Um workflow de alto
  volume deve tratar `429` com backoff, não retry imediato em loop.
- Toda chamada de tool (sucesso ou erro) gera `api_audit_log` com
  `action: "mcp.tool_called"`, `actorApiTokenId`, `resourceType: "mcp_tool"`
  e metadata com `tool_name`/`duration_ms`/`success` (`lib/mcp/audit.ts`).
  Isso é fire-and-forget: falha de audit nunca bloqueia a resposta da tool,
  mas fica visível operacionalmente.

## Ferramenta MCP faltante para o pilot?

Nenhuma operação concreta do pilot n8n desta fase exigiu uma tool nova: o
catálogo atual (`lib/mcp/tools/index.ts`) já cobre leitura/escrita de
contatos, conversas, mensagens, leads, pipelines/etapas, tags, templates,
webhook sources, regras de automação, followups e handoff — o superconjunto
razoável de operações que um workflow de automação externa precisaria tocar
no MVP. Por isso esta doutrina **não adiciona tool nova**. Se uma integração
futura precisar de uma operação que genuinamente não existe no catálogo,
adicione uma tool específica seguindo o convênio existente (scope + role +
tenant vindo do token + audit, como toda tool atual) — nunca uma tool
genérica de SQL/query livre, que romperia o modelo de least-privilege que
este runbook documenta.

## Checklist de provisionamento

- [ ] Nome do token identifica o workflow n8n específico (não genérico
      "n8n" para múltiplos workflows).
- [ ] Escopos marcados são o mínimo necessário (seção "Escopos
      recomendados"); `mcp:write` só se o workflow muta CRM; `role:manager`
      só se uma tool específica exigir.
- [ ] `role:admin` não foi marcado.
- [ ] Expiração definida, salvo token de produção com dono e rotação
      claros.
- [ ] Plaintext copiado para o cofre operacional uma única vez; não ficou
      em clipboard/log/anotação solta.
- [ ] Credencial n8n criada como header `Authorization: Bearer ...`, nunca
      em query string.
- [ ] Token dedicado a este workflow — não compartilhado com workflows de
      escopo diferente.
- [ ] Processo de revogação conhecido (`/app/settings/api-tokens`) caso o
      workflow seja desativado ou o token vaze.

## Testes que provam este contrato

`tests/unit/n8n-mcp-scope.test.ts` (Task 4) prova, contra o catálogo MCP
real:

- um token `mcp:read` (read-only) é barrado por `ensureScope` em toda tool
  `write`/`handoff` do catálogo;
- um token `mcp:write` + `role:agent` (default) é barrado por `ensureRole`
  em toda tool `manager`-only do catálogo;
- nenhuma tool do catálogo exige `role:admin`;
- um token da org A não lê nem edita, via `crm_get_lead`/`crm_update_lead`,
  um `lead_id` real pertencente à org B.

`tests/unit/n8n-integration-boundary.test.ts` (Task 1) trava, em separado, a
fronteira estrutural: `organizationId` só vem de `api_tokens`, `mcp:write` é
obrigatório em toda tool mutante, e nenhum código n8n-específico importa o
client service-role diretamente.

## Referências

- `docs/specs/` — Spec 11 (MCP server), Spec 01 (`api_tokens`/RBAC).
- `docs/runbooks/ai-platform-secrets.md` — cofre operacional (Infisical),
  break-glass, kill switches.
- `lib/mcp/auth.ts`, `lib/mcp/server.ts`, `lib/mcp/types.ts` — mecanismo de
  auth/scope/role do MCP.
- `app/api/v1/settings/api-tokens/route.ts`,
  `app/api/v1/settings/api-tokens/[id]/revoke/route.ts` — criação/revogação.
- `app/app/settings/api-tokens/_components/ApiTokensClient.tsx` — UI de
  provisionamento.
- `.claude/rules/security.md`, `.claude/rules/api-contract.md` — doutrina de
  segurança/API do repositório (bearer nunca em query string, RBAC
  `viewer < agent < manager < admin`, plaintext não recuperável).
