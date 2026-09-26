# Revisão de segurança consolidada — Build Preview (Telar) e Canon versionado (Cartógrafa)

Data: 2026-09-13  
Método: inspeção read-only via SSH no worker, por commit e arquivos alterados. Não foram executados testes, build ou efeitos live.

## Commits revisados

- Build Preview / Telar: `a4db300693c835d59ff3df1d142f38e2837cf668` — `feat(wave10): add gated build preview`.
- Canon versionado / Cartógrafa: `9764deeb0c2def1d99f752b93c9103ed0e4b481f` — `feat(knowledge): add versioned canon registry`.

## Build Preview

**Veredito: PASS local no gate; NOT_PROVEN como entrega/preview de produção.**

- `apps/crm/lib/product-factory/preview.ts:12-19` chama `validateDeliveryPlanWithState` antes de gerar preview e lança erro quando o gate não é válido.
- O gate herdado exige estado e aprovação `APPROVED`/`PACKAGED`; o preview não possui caminho alternativo que ignore esse retorno.
- `preview.ts:20-41` gera hash determinístico do build/artifact/refs e devolve cópias das referências; não há secret hardcoded nem logging.

Limites:

- `PreviewArtifact` (`:5-10`) marca `READY`, mas não executa publicação nem produz receipt de entrega. A prova é de preparação de preview, não de entrega efetiva.
- O hash cobre strings de refs, não o conteúdo resolvido dos artefatos/evidências; autenticidade e correspondência real permanecem NOT_PROVEN.
- O teste `product-factory-preview.test.ts:11-19` usa um fake store que sempre retorna linha vazia em `select`; portanto não prova replay/terminalidade contra Postgres real.

## Canon versionado

**Veredito: BLOCKED — falta de tenant isolation e validação runtime de precedence permite resolução fail-open.**

- `apps/crm/lib/knowledge/canon.ts:8-16` define `CanonDocument` sem `organizationId`/tenant. O registry (`:27-29`) é um mapa global por `key`; documentos de tenants diferentes podem ser listados e resolvidos juntos.
- `:30-39` valida apenas IDs/key/version não vazios e aceita qualquer valor runtime em `precedence`, `source` e `updatedAt`, apesar do tipo TypeScript.
- `:45-49` indexa `precedenceRank[b.precedence]`. Precedence desconhecida produz `undefined`/`NaN` no comparador; a ordenação pode preservar inserção e permitir que documento não autorizado seja selecionado em vez de falhar fechado.
- `updatedAt` é comparado como string (`:47`), sem rejeitar timestamp inválido ou exigir formato monotônico; valores malformados podem alterar a precedência efetiva.
- `resolve` retorna uma cópia (`:50`), mas não verifica tenant, validade de fonte/licença ou status de aprovação antes de devolver conteúdo.
- Os testes `canon.test.ts:17-32` cobrem apenas precedência nominal e duplicate `documentId`; não cobrem cross-tenant, precedence desconhecida, timestamps inválidos ou isolamento de conteúdo.

## Secrets e logging

Busca textual read-only nos quatro arquivos por `sk-`, `api[_-]?key`, `secret`, `password`, `Bearer`, `console.` e `logger.` não encontrou secret hardcoded ou logging sensível. O preview herda apenas referências, sem imprimir credenciais.

## Veredito consolidado

- Build Preview: **PASS local / NOT_PROVEN sistêmico** — gate é chamado antes do preview; publicação, receipt e conteúdo real não são demonstrados.
- Canon versionado: **BLOCKED** — ausência de tenant isolation é bloqueador direto; precedence/timestamp sem validação runtime criam risco fail-open.
- Secrets: **nenhum encontrado**.

Não promover o Canon até incluir tenant no registro/chave de resolução, validar precedence/timestamps em runtime e rejeitar qualquer documento desconhecido ou não autorizado. O Preview pode continuar como componente provider-free condicionado à boundary de delivery efetiva.

SELF-CHECK: PASS — SHAs e arquivos confirmados, revisão read-only, sem testes/build/merge/efeito externo e sem exposição de segredos.
