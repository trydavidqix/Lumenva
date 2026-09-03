# Audit Rules — DeskcommCRM

> Protocolo para auditorias profundas por agentes. Objetivo: achar bugs reais, lixo, risco e oportunidades sem transformar grep em verdade nem quebrar invariantes.

## 1. Modo de operação

A auditoria começa **read-only**.

Não editar código antes de entregar:

1. mapa do escopo;
2. verificações executadas;
3. achados com evidência;
4. causas raiz prováveis/confirmadas;
5. dependências entre achados;
6. plano de implementação por fases;
7. riscos de cada mudança.

Exceção: somente quando o dono pedir explicitamente implementação imediata.

## 2. Ordem obrigatória de leitura

1. `CLAUDE.md`.
2. rule do domínio em `.claude/rules/`.
3. `AGENTS.md`.
4. `docs/ai/PROJECT_CONTEXT.md`.
5. `docs/ai/ARCHITECTURE.md`.
6. `docs/ai/AI_PROJECT_STATE.md`.
7. `docs/ai/KNOWN_ISSUES.md`.
8. `docs/index.md`.
9. spec/PRD/business-rule aplicável.
10. código real.

Documentação velha não vence código + fonte canônica atual.

## 3. Classificação obrigatória dos achados

Cada achado deve ser exatamente uma destas classes:

### A — Bug reproduzido

Existe comportamento incorreto demonstrado por teste, execução, trace, log confiável ou caminho determinístico provado.

### B — Vulnerabilidade / risco de segurança

Há caminho plausível com impacto de auth, tenant, PII, secret, SSRF, privilege escalation, injection, replay, descontrole de side effect ou indisponibilidade.

Distinguir:

- explorabilidade confirmada;
- vulnerabilidade estática plausível;
- hardening recomendado.

### C — Invariante quebrado

Código viola regra canônica mesmo que nenhum bug visível tenha ocorrido ainda.

Exemplos:

- service role sem filtro tenant;
- schema sem baseline;
- trigger fazendo HTTP;
- bearer em query string;
- input externo sem validação quando contrato exige.

### D — Dívida técnica

Código funciona, mas manutenção/confiabilidade estão degradadas.

### E — Código morto/lixo

Só marcar depois de provar ausência de uso estático **e** dinâmico/configuracional.

### F — Duplicação

Só marcar quando duas implementações representam o mesmo conceito/fonte de verdade e a duplicação cria risco/custo real.

### G — Performance

Precisa de evidência ou caminho claramente custoso. Não chamar código de lento apenas por estética.

### H — Test gap

Comportamento crítico sem prova adequada.

### I — Documentação/config drift

Docs/configuração declarada divergem do código/runtime atual.

### J — Melhoria opcional

Funciona hoje; mudança é recomendação, não correção.

### K — Nova oportunidade

Feature/arquitetura adicional que não resolve bug atual. Nunca misturar com correções obrigatórias.

## 4. Severidade

### P0 / Crítico

- vazamento cross-tenant;
- bypass de auth/RBAC;
- secret exposto;
- corrupção/perda de dados;
- deploy que derruba produção;
- side effect duplicado de alto impacto;
- falha de privacy/compliance material.

### P1 / Alto

- fluxo principal quebrado;
- race/idempotência relevante;
- integração produzindo ação errada;
- agent tool executando sem política correta;
- fresh install quebrado;
- regressão silenciosa importante.

### P2 / Médio

- performance relevante;
- test gap em fluxo secundário;
- dívida que aumenta risco de regressão;
- observabilidade insuficiente.

### P3 / Baixo

- limpeza segura;
- naming/local refactor;
- melhoria pequena sem impacto funcional.

## 5. Formato obrigatório de um achado

```text
ID:
Classe:
Severidade:
Status: confirmado | reproduzido | provável | precisa teste
Localização:
Sintoma:
Evidência:
Causa raiz:
Impacto:
Raio de dano:
Dependências:
Solução recomendada:
Alternativas consideradas:
Risco da correção:
Teste que prova o fix:
```

Se não há evidência suficiente, dizer "hipótese".

## 6. Fase 0 — fotografia do repo

Antes de buscar bugs:

- confirmar repo e branch;
- confirmar HEAD;
- listar branches relevantes;
- verificar divergência da branch de trabalho contra `main`;
- identificar escopo: root CRM, website, voice, infra ou docs;
- ler commits recentes do domínio;
- localizar arquivos de autoridade;
- verificar se `current-state` está fresco.

Não usar branch histórica citada em doc como base sem confirmar que ainda existe e contém trabalho exclusivo.

## 7. Fase 1 — mapa estrutural

Construir lista de:

- entrypoints;
- route handlers;
- auth boundaries;
- service-role clients;
- consumers/workers;
- channel adapters;
- model/provider adapters;
- tool gateway/MCP;
- schema/migrations;
- cron/internal endpoints;
- storage/media;
- observability;
- deploy/runtime.

Depois seguir dependências reais. Evitar varredura cega de todos os arquivos.

## 8. Fase 2 — gates baseline

Quando ambiente permitir, medir baseline antes de editar:

```bash
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm lint:tenant-filter
pnpm test:unit
```

Conforme escopo:

```bash
pnpm test:db
pnpm test:e2e
pnpm test:journeys
pnpm test:harness
pnpm harness:check
pnpm build
```

Registrar:

- comando;
- exit code;
- testes pass/fail/skip;
- falha de ambiente separada de falha do produto.

Não enfraquecer teste para "deixar verde" sem provar que o teste estava errado.

## 9. Auditoria de auth

Procurar:

- `getSession()` usado como autoridade server-side;
- rota pública adicionada acidentalmente;
- guard só na UI;
- role check ausente;
- platform admin misturado com tenant admin;
- bearer/token em URL/query;
- secret com fallback previsível;
- comparação insegura de secret;
- cookie sem contrato correto;
- fluxo OAuth sem PKCE/state/expiry/replay defense quando aplicável;
- endpoint interno sem fail-closed.

Testar negativo, não só happy path.

## 10. Auditoria cross-tenant

Prioridade máxima.

Pesquisar usos de:

- `createAdminClient`;
- service role;
- queries sem `organization_id`;
- joins entre entidades tenant-aware;
- tools/MCP que recebem IDs arbitrários;
- workers que processam evento de várias organizações;
- caches/memória com chave sem tenant;
- rate limit/budget sem namespace de org;
- storage path sem tenant quando contrato exige.

Para cada caminho:

```text
actor -> source of org -> authorization -> query -> returned/mutated rows
```

Criar prova com Org A e Org B quando possível.

## 11. Auditoria de schema

Para cada migration recente:

- existe no MANIFEST?
- baseline acompanha?
- instalação fresca funciona?
- update de instalação existente funciona?
- backfill precede constraint quando necessário?
- RLS/policies existem?
- FK tenant-safe?
- índice acompanha query crítica?
- `SECURITY DEFINER` tem search_path/permissões adequados?
- types gerados estão coerentes?

Nunca editar migration aplicada.

## 12. Auditoria de eventos/workers

Procurar:

- evento sem consumer;
- consumer sem ownership claro;
- dois consumers para o mesmo evento sem coordenação;
- retry que duplica side effect;
- ausência de idempotency key;
- `23505` ignorado incorretamente;
- stuck state sem recovery;
- DLQ/retry invisível;
- side effect dentro de transação DB;
- cron que pode executar concorrente;
- claim sem lock/lease correto;
- timeout deixando estado intermediário.

## 13. Auditoria de race conditions

Focar em:

- read-then-write sem lock/constraint;
- estados `queued/sending/sent/failed`;
- aprovação humana vs worker;
- handoff IA->humano;
- privacy/anonymization vs memory/indexing;
- webhook retries;
- OAuth code/token exchange;
- dedupe de mensagens;
- criação de lead/contact por dois eventos simultâneos;
- budget/counter concorrente.

Preferir constraint/transaction/idempotência a mutex improvisado no processo.

## 14. Auditoria de API

Para cada endpoint relevante:

- input externo usa Zod ou validação canônica?
- retorno usa wrapper/código correto?
- tenant vem de fonte confiável?
- RBAC correto?
- rate limit adequado ao custo/abuso?
- idempotência necessária?
- audit necessário?
- erro expõe detalhe interno?
- PII excessiva na response?
- paginação/limits existem?
- query aceita enum/string não validado?

## 15. Auditoria de WhatsApp/canais

Procurar:

- bypass da abstração de canal;
- provider hardcoded em feature;
- assinatura webhook opcional/obrigatória divergente de ambiente;
- dedupe sem tenant;
- `fromMe`/multi-device regressão;
- grupo tratado como lead;
- mídia sem policy/storage adequado;
- opt-out ignorado;
- pacing/anti-ban contornado;
- retry duplicando mensagem;
- estado de entrega inconsistente;
- telefone/identidade mal normalizados.

## 16. Auditoria de Agent OS

Separar cinco perguntas:

### 16.1 O agente escolhe corretamente?

Prompt/policy/routing.

### 16.2 O agente pode executar apenas o permitido?

Tool authorization/autonomia.

### 16.3 A execução é tenant-safe?

Tools e memória.

### 16.4 O resultado é verificável?

Tool response/audit/observabilidade.

### 16.5 O sistema falha de modo seguro?

Handoff, timeout, provider failure, confidence baixa.

Não avaliar agente apenas por resposta textual bonita.

## 17. Auditoria de model router

Por modelo/provider:

- suporta tool calling exigido?
- suporta imagem/áudio/documento se rota exige?
- contexto é suficiente?
- timeout/retry/fallback existe?
- circuito evita loop entre providers?
- custo está visível?
- rate limit do provider é tratado?
- provider failure duplica tool call?
- fallback muda semântica/capability?
- free model é usado só onde seguro?

Criar eval funcional, não apenas benchmark acadêmico.

## 18. Auditoria de memória/RAG

Procurar:

- namespace sem tenant;
- embedding/index stale sem invalidation;
- dado de cliente em base institucional;
- memória auxiliar tratada como source of truth;
- resumo antigo vencendo dado atual;
- histórico completo enviado sempre ao modelo;
- PII desnecessária em provider externo;
- delete/anonymization sem limpar projeções;
- race entre indexação e privacy;
- ausência de provenance/timestamp em fatos mutáveis.

## 19. Auditoria de MCP/tools

Cada tool deve ter:

- escopo claro;
- schema de input;
- auth;
- tenant;
- autorização;
- audit quando muta;
- retorno mínimo necessário;
- proteção contra repeated call;
- timeout/erro previsível;
- sem acesso genérico demais quando operação semântica existe.

Tools externas via Composio/MCP não ganham confiança automática.

## 20. Auditoria de OAuth/Redis

Regression traps atuais:

- não `JSON.parse` valor Upstash sem checar tipo;
- não substituir parsing urlencoded atual por `formData()` sem prova de runtime;
- codes precisam expirar/ser single-use conforme contrato;
- state/PKCE/client/redirect URI precisam ser validados;
- secrets nunca em logs;
- storage Redis precisa namespace/TTL adequado.

## 21. Auditoria de rate limit

Para cada limite:

- chave é IP, account, tenant, token ou combinação?
- endpoint caro merece limite diferente?
- Redis está realmente configurado em produção?
- fallback em memória é aceitável?
- fail-open/fail-closed é deliberado?
- attacker com IP rotativo contorna?
- NAT legítimo é penalizado?
- 429/Retry-After coerentes?

## 22. Auditoria de SSRF/webhooks

Preservar e testar:

- protocolo permitido;
- hostname/IP local/private/link-local;
- DNS resolution/rebinding quando aplicável;
- redirects;
- credentials em URL;
- timeout;
- tamanho de resposta;
- egress inesperado;
- logs sem secret.

## 23. Auditoria de privacy/RGPD

Verificar:

- export cobre grafo correto;
- anonymization é irreversível onde definido;
- projeções/memórias são limpas/atualizadas;
- audit existe;
- prazo/comportamento segue fonte canônica;
- logs/Sentry não guardam PII;
- arquivos/evidências não expõem cliente;
- retention não é inventada pelo agente.

## 24. Auditoria de dependências

Antes de chamar pacote de morto:

1. buscar imports estáticos;
2. buscar dynamic import/require;
3. buscar scripts/config/plugin registration;
4. buscar Next/runtime auto-discovery;
5. buscar uso em `website/` separado;
6. buscar workers/scripts/tests;
7. verificar peer/transitive need;
8. executar build/test sem ele em branch isolada.

Use `knip` ou equivalente quando já configurado, mas valide falsos positivos.

## 25. Auditoria de código morto

Um arquivo é candidato quando:

- não é entrypoint/route/config;
- não é importado;
- não é referenciado por string/registry;
- não é carregado por framework;
- não é script/documento operacional;
- testes/build continuam verdes sem ele.

Só depois classificar como morto.

## 26. Auditoria de duplicação

Distinguir:

- duplicação intencional por boundary;
- adapter parecido mas provider diferente;
- cópia acidental de regra de negócio;
- duas fontes de verdade divergentes.

Priorizar duplicação de política/regra, não repetição estética pequena.

## 27. Auditoria de performance

Medir por superfície:

### Backend

- N+1;
- query sem índice;
- payload grande;
- serialização repetida;
- contexto LLM excessivo;
- embedding/RAG desnecessário;
- chamadas externas sequenciais que podem ser paralelas com segurança.

### Frontend

- hidratação excessiva;
- bundle pesado;
- client component desnecessário;
- imagens grandes;
- layout shift;
- fetch duplicado;
- virtualização em listas grandes.

### Agentes

- histórico completo em todo turno;
- tools redundantes;
- modelo premium em tarefa simples;
- retries sem backoff;
- subagentes sem necessidade;
- resposta/token budget sem limite.

Não otimizar benchmark local irrelevante para runtime real.

## 28. Auditoria do website

Tratar `website/` como projeto próprio.

Verificar:

- package/build/test próprios;
- SEO/GEO/metadata;
- a11y;
- CSP/anti-CSRF/headers;
- formulário/honeypot;
- performance/LCP/TBT/CLS;
- imagens/fontes;
- dead code/deps;
- Preview vs produção.

Não misturar resultados do website com saúde do CRM core.

## 29. Auditoria de self-host

Simular duas jornadas:

### Fresh install

Clone limpo -> env -> baseline -> app -> health -> onboarding.

### Upgrade

Instalação existente -> pull/update -> migrations -> rebuild -> health -> dados preservados.

Verificar:

- dependências fixas;
- Node/pnpm corretos;
- env novas;
- baseline;
- migration order;
- proxy/reverse proxy;
- cron;
- WAHA;
- Redis;
- storage;
- hosted config externa;
- rollback/backup.

## 30. Auditoria de deploy

Nunca operar por memória.

Antes de produção:

- ler runbook;
- confirmar autorização;
- confirmar backup/rollback quando aplicável;
- confirmar recursos da VPS;
- não exibir secrets;
- verificar runtime após deploy, não só Git checkout;
- separar build failure de app failure;
- validar domínio/health.

## 31. Auditoria de docs

Procurar divergência entre:

- `CLAUDE.md`;
- `.claude/rules`;
- specs;
- `ARCHITECTURE.md`;
- `README`;
- `current-state`;
- handoffs;
- `.env.example`;
- `lib/env.ts`;
- package scripts.

Quando doc histórico estiver stale, preferir marcar/reconciliar em vez de apagar contexto útil.

## 32. Plano de implementação

Depois da auditoria, agrupar por dependência, não por ordem em que bugs foram encontrados.

Exemplo:

```text
FASE 0 — reproduções e safety net
FASE 1 — P0 security/tenant/data
FASE 2 — causa raiz de eventos/idempotência
FASE 3 — bugs funcionais
FASE 4 — harness/test gaps
FASE 5 — performance
FASE 6 — limpeza/refactor
FASE 7 — melhorias opcionais aprovadas
FASE 8 — documentação/estado final
```

Cada fase precisa de:

- objetivo;
- arquivos prováveis;
- dependências;
- risco;
- testes;
- rollback quando relevante;
- condição de saída.

## 33. Aprovação do dono

Separar claramente:

### Correção obrigatória

Bug, segurança, invariante quebrado.

### Mudança de comportamento

Precisa aprovação quando altera regra de negócio/UX/API.

### Melhoria opcional

Não implementar sem aprovação quando não faz parte do pedido.

### Nova feature

Sempre fora da auditoria de correções, salvo pedido explícito.

## 34. Implementação

Quando aprovada:

- branch atualizada a partir de main;
- commits pequenos/coerentes;
- menor mudança correta;
- testes do bug antes/depois quando viável;
- não misturar refactor grande com fix crítico;
- não remover fallback sem entender ambiente;
- preservar backward compatibility quando contrato exige.

## 35. Revisão independente

Para mudança crítica, idealmente um segundo modelo/agente revisa:

- diff;
- threat model;
- tenant boundaries;
- testes;
- possibilidade de falso positivo da auditoria;
- regressões não cobertas.

O revisor não deve receber apenas o relatório; precisa poder olhar o código/diff.

## 36. Relatório final

Estrutura:

```text
Resumo executivo
Baseline executado
Achados P0/P1/P2/P3
Falsos positivos descartados
Plano aprovado
Implementações realizadas
Arquivos alterados
Testes executados
Testes não executados + motivo
Riscos residuais
Docs atualizados
Próximos passos opcionais
```

Nunca escrever "100% seguro", "sem bugs" ou "totalmente limpo". Dizer o que foi medido.

## 37. Regra final

**Evidence > confidence. Root cause > symptom. Invariants > convenience. Small correct change > broad rewrite.**
