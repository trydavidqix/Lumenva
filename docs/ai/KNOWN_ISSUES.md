# Known Issues / Risks / Pending Work — Lumenva

> Lista de triagem para agentes. **Não tratar item como bug reproduzido sem validar no HEAD atual.**  
> Snapshot inicial: 2026-09-03, base `main @ 589872303ed11108c0e74db77aa356cfca921b6f`.

## Legenda

- 🔴 crítico / risco de perda, vazamento, auth ou produção
- 🟠 alto / comportamento incorreto ou regressão relevante
- 🟡 médio / dívida, harness, confiabilidade ou operação
- 🟢 baixo / melhoria
- ✅ resolvido no HEAD/snapshot conhecido
- ⚠️ precisa revalidação porque a fonte histórica está stale
- 🧪 requer reprodução/teste, não apenas leitura

## 1. Documento `docs/current-state.md` não representa sozinho o HEAD atual 🟡

**Status:** CONFIRMADO como problema de frescor documental.

O cabeçalho do documento foi auditado contra um SHA de 2026-09-01, mas `main` avançou significativamente em 2026-09-02/03. O próprio corpo recebeu conteúdo posterior, criando uma mistura de snapshot antigo com adições novas.

Mudanças posteriores observadas no Git incluem relay e-mail->WhatsApp, MCP/OAuth relay, fixes de OAuth/Redis e alterações grandes do website.

**Ação recomendada:** qualquer auditoria de estado deve reconciliar `docs/current-state.md` com `git log`/HEAD antes de produzir plano.

## 2. GitHub Actions está desabilitado por decisão do dono 🟡

**Status:** CONFIRMADO / decisão intencional, mas cria lacuna operacional.

Workflows versionados não significam CI rodando. O gate real é local + Preview/runbooks.

**Risco:** agente declarar "CI verde" porque encontrou `.github/workflows/*`.

**Ação:** nunca usar presença de workflow como evidência. Relatar exatamente os comandos executados.

## 3. `pnpm gov:verify` não é verificação completa 🟡

**Status:** CONFIRMADO pela configuração do projeto.

O comando rápido não substitui automaticamente:

- `test:db` para schema/RLS;
- `test:e2e` para jornadas;
- prova visual/UI;
- integrações externas/live;
- deploy real.

**Risco:** falso verde em alteração cross-tenant ou jornada.

## 4. Ausência de scanner automático de secrets no fluxo atual 🟠

**Status:** CONFIRMADO por busca no snapshot: referências a `gitleaks`/`trufflehog` aparecem apenas em docs de auditoria, não como ferramenta integrada.

**Risco:** repo possui evidências visuais e integrações reais; segredo ou PII pode entrar em commit.

**Observação:** como GitHub Actions está desligado, adicionar apenas um workflow não resolve. Uma proteção útil teria de caber no fluxo local/pre-commit/verify ou em outra automação aceita pelo dono.

## 5. Evidência visual pode conter PII 🟠

**Status:** risco histórico documentado; recontagem atual de imagens não foi executada neste snapshot.

O repo usa screenshots/evidence como prova. Algumas evidências históricas vieram de contas/fluxos reais.

**Ação:** antes de commitar imagem, revisar manualmente nomes, telefones, e-mails, tokens em URL, IDs sensíveis e conteúdo de conversa.

## 6. Deploy pode ficar com código atualizado e container/imagem antiga 🟠

**Status:** CONFIRMADO por incidente real em 2026-09-02.

O checkout da VPS tinha recebido código novo, mas o container continuava servindo imagem anterior. Isso fez a rota recém-integrada responder como ausente até rebuild/redeploy correto.

**Risco:** `git log` correto não prova runtime correto.

**Ação:** pós-deploy precisa provar versão/runtime via health/HTTP e, idealmente, expor build SHA de maneira segura.

## 7. Build na VPS pode pressionar memória / derrubar serviços 🟠

**Status:** CONFIRMADO historicamente no runbook/handoff do relay.

Build real em VPS pequena causou OOM/pressão suficiente para afetar Caddy mesmo com swap menor previamente considerada suficiente.

**Ação:** ler runbook atual antes de build/deploy e não improvisar em produção.

## 8. Configuração hospedada do Supabase pode divergir do repo 🟠

**Status:** CONFIRMADO historicamente.

Exemplo real: templates de e-mail Auth/SMTP são configuração do projeto hospedado e podem não refletir arquivos locais. Houve caso em que confirmação de e-mail ocorria mas o fluxo de provisionamento esperado não fechava corretamente por formato diferente de link.

**Risco:** código/testes locais verdes, produção divergente.

**Ação:** mapear "config-as-code" vs configuração externa sempre que mexer em Supabase Auth/provider settings.

## 9. OAuth relay — regressão de desserialização Redis 🟠

**Status:** ✅ corrigido em `main` em 2026-09-03; manter como regression trap.

Causa raiz observada: `@upstash/redis` já devolvia JSON desserializado; `JSON.parse()` incondicional em objeto gerava `SyntaxError: [object Object] is not valid JSON`.

**Não fazer:** reintroduzir parse duplo por "simplificação".

**Auditoria:** procurar outros wrappers que assumem retorno string do Redis.

## 10. OAuth relay — parsing de form-urlencoded 🟠

**Status:** ✅ workaround/correção integrada; manter como regression trap.

No runtime/versão observado, `req.formData()` produziu comportamento incompatível no caminho OAuth; rotas afetadas passaram a usar `req.text()` + `URLSearchParams`.

**Não fazer:** trocar de volta sem teste compatível com produção/runtime atual.

## 11. Testes do AI SDK já divergiram entre local e Vercel 🟡

**Status:** ✅ testes foram estabilizados em 2026-09-03, mas o comportamento é um alerta.

O SDK `ai` tomou caminho diferente no ambiente Vercel ao resolver model string/AI Gateway. Assert de mensagem/efeito ambiental se tornou frágil.

**Regra:** testes de erro de SDK externo devem afirmar contrato do projeto, não texto interno volátil do provider/SDK.

## 12. Relay e-mail -> WhatsApp depende de contacto/conversa com telefone resolvido 🟠

**Status:** comportamento operacional confirmado em produção.

Mesmo com env de destino corretas, o envio falhou quando o contacto CRM correspondente não tinha `phone_number` resolvido/preenchido.

**Risco:** instalação nova parecer configurada, mas relay falhar fechado.

**Ação:** manter validação operacional explícita no setup/runbook e considerar health/preflight específico sem expor telefone.

## 13. Conector MCP relay: branch antiga ficou para trás ✅/🟢

`feat/mcp-relay-connector` estava 10 commits atrás de `main` e sem commits exclusivos no snapshot comparado; a funcionalidade já foi integrada em `main`.

**Ação:** não usar branch antiga como base de nova implementação. Limpeza de branch deve ser decisão explícita separada.

## 14. Branch `feat/website-form-a11y-phosphor` divergiu de main 🟡

**Status:** CONFIRMADO pelo compare no snapshot.

A branch possuía commits próprios e estava atrás de `main`, com mudanças em formulário, iconografia, website e testes.

**Risco:** merge bruto sobrescrever/duplicar o overhaul de website integrado em 2026-09-03.

**Ação:** comparar por arquivo/intenção; cherry-pick/port seletivo se ainda houver valor.

## 15. Website e CRM compartilham repo, mas são projetos diferentes 🟡

**Status:** design estrutural.

Últimos commits do repo podem ser exclusivamente do `website/`, o que pode induzir um auditor a concluir que o CRM core mudou.

**Ação:** sempre separar métricas, dependências, build e regressões do root vs `website/`.

## 16. Estado das fases Agent OS históricas precisa nova reconciliação ⚠️

`docs/current-state.md` de 2026-09-01 dizia que Fases 3, 6 e 7 permaneciam fora de `main`/em continuação. Depois disso, houve commits adicionais relacionados a evolução/benchmarks e outras integrações.

**Não assumir:** nem "já integrado" nem "ainda fora" apenas pela frase antiga.

**Ação:** para qualquer trabalho no Agent OS, auditar módulos reais do HEAD e os handoffs mais novos antes de planejar.

## 17. Voz: documentos refletem várias gerações de arquitetura ⚠️

Há referências a Asterisk/ARI/Pipecat, Telnyx/LiveKit e Patter em documentos diferentes, além de branches/POCs históricos.

**Risco:** agente escolher uma stack histórica errada porque encontrou um plano antigo.

**Ação:** identificar o documento marcado como status canônico mais recente e verificar o que realmente está em `main` antes de implementação.

## 18. Áudio/voz live ainda exige prova de infraestrutura 🟠

A documentação arquitetural registra que partes de sinalização/bridge foram testadas em linhas específicas, enquanto caminhos de áudio live e deploy definitivo tiveram bloqueios/decisões de infraestrutura.

**Status atual exato:** precisa revalidação antes de trabalho de voz.

**Ação:** separar claramente:

- código integrado em main;
- branch/POC;
- teste provider-free;
- chamada live real;
- infraestrutura de produção.

## 19. Rate limit: auditoria histórica T1 está parcialmente stale ⚠️

O threat model de 2026-08-28 listava login sem lockout/limite de identidade. Entretanto a `.env.example` atual já documenta proteção de login por IP e limite por conta, indicando evolução posterior.

**Regra:** não copiar a lista T1 antiga como fato atual. Reauditar cada superfície no HEAD.

Superfícies que merecem revisão periódica:

- login/signup;
- convite;
- cron/internal;
- MCP/OAuth;
- webhooks;
- endpoints caros de IA.

## 20. Fallback in-memory de rate limit não é equivalente a Redis distribuído 🟠

**Status:** princípio/risco ainda relevante até prova de que a superfície usa Redis em todos os ambientes necessários.

Multi-instância + fallback por processo pode reduzir eficácia. Auditar setup self-host e env antes de confiar no limite.

## 21. Service role continua sendo ponto de maior risco cross-tenant 🔴

**Status:** estrutural, não "bug aberto".

Qualquer handler novo com admin client pode vazar dados entre organizações se esquecer filtro de tenant.

Proteções existentes:

- doutrina explícita;
- `lint:tenant-filter` heurístico;
- invariantes de banco/cross-tenant;
- revisão de código.

**Lacuna inevitável:** lint heurístico não é análise de dataflow completa.

## 22. `baseline.sql` e migrations podem divergir se agente editar só um caminho 🔴

**Status:** risco estrutural protegido por doutrina/testes.

Fresh install depende do baseline. Alteração que só migra banco existente mas não baseline quebra produto self-host.

**Ação:** tripla obrigatória migration + baseline + MANIFEST.

## 23. Não assumir que `supabase db push` cria instalação fresca válida 🔴

O README atual alerta que migrations históricas iniciais incluem stubs e que o schema real para instalação fresca vive no `baseline.sql`.

**Risco:** ambiente de teste vazio passar superficialmente e app falhar depois.

## 24. Provider/model routing pode falhar silenciosamente por falta de tool calling 🟠

Modelo barato/free incapaz de tools pode responder texto plausível sem executar ação de CRM.

**Ação:** capability registry/evals devem provar tool calling, não apenas qualidade textual.

## 25. Env global não equivale a credencial de agente por tenant 🟡

`.env.example` atual explicita que OpenRouter global alcança determinadas superfícies, mas não migra automaticamente o provider configurado do agente da organização.

**Risco:** operador acreditar que "trocou todo o CRM para modelo X" quando alterou apenas classificador/bot/fallback específico.

## 26. Memórias auxiliares não podem virar segunda fonte de verdade 🟠

Mem0/Graphiti/RAG/sumários podem ficar stale ou conflitantes.

**Ação:** operações comerciais devem confirmar no CRM/tool canônico; projeções precisam de source/time/provenance quando o dado puder mudar.

## 27. Automação/flywheel deve manter gate humano onde o contrato exige 🟠

Planos do Agent OS incluem aprendizagem/propostas automáticas. Não converter proposta em promoção automática sem verificar política atual de autonomia.

## 28. Open issues/PRs no GitHub não são o backlog real 🟡

No snapshot de 2026-09-03 não havia issues/PRs abertos retornados para o repo, mas existe trabalho documentado em handoffs, plans e branches.

**Ação:** backlog real = Git + docs vivos + handoffs + branches, não apenas Issues.

## 29. Auditorias antigas de `.env.example` estão resolvidas/stale ✅

O `harness-audit.md` de 2026-08-28 dizia que faltavam variáveis como:

- `IMPERSONATE_COOKIE_SECRET`;
- `INTERNAL_CRON_SECRET`;
- `LGPD_SIGNING_KEY`;
- `LGPD_DPO_EMAIL`;
- `LGPD_EXPORT_EXPIRES_HOURS`;
- `NUVEMSHOP_ENABLED`.

No snapshot atual de `.env.example`, essas variáveis aparecem documentadas.

**Ação:** não abrir tarefa para "adicionar essas 6 envs" com base na auditoria velha. Se for auditar env, comparar `lib/env.ts` vs `.env.example` novamente do zero.

## 30. Graph/document metrics são snapshots históricos 🟢

Números de arquivos, docs, migrations, testes e grafo mudam rapidamente. Use apenas para escala mental, não para decisão técnica atual.

---

# Prioridade para próxima auditoria profunda

Se o objetivo for encontrar bugs escondidos e lixo real, começar nesta ordem:

1. 🔴 service-role + cross-tenant dataflow;
2. 🔴 auth/public paths/OAuth/MCP/internal endpoints;
3. 🔴 migrations/baseline/fresh install;
4. 🟠 event_log/idempotência/retries/race conditions;
5. 🟠 Agent OS tool authorization + model capability routing;
6. 🟠 relay/OAuth regression coverage;
7. 🟠 rate limit distribuído e superfícies caras;
8. 🟠 memory/RAG consistency e tenant isolation;
9. 🟡 deploy drift / runtime SHA / hosted config drift;
10. 🟡 dead code/dependencies/duplication depois dos invariantes críticos;
11. 🟡 website separado, com sua própria auditoria de performance/a11y/SEO.

Para transformar achados em plano, seguir `docs/ai/AUDIT_RULES.md`.
