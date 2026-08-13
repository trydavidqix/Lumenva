# Obsidian → Knowledge: publicação controlada

## Limites e estado seguro

O vault do Obsidian é um workspace de autoria **humana**, fora do runtime do
CRM: ele nunca é sincronizado, montado ou lido pela aplicação, e não existe
credencial de banco/serviço configurada para o Obsidian acessar o CRM
diretamente. `DRAFT`/`REVIEW`/`ARCHIVED` nunca chegam ao sistema — apenas
`PUBLISHED` é elegível para exportação, e mesmo assim passa primeiro pelo
scanner de segredos/PII.

O único ponte entre "editei uma nota no Obsidian" e "isso pode entrar no CRM"
é o comando abaixo. Ele não fala com Postgres/Supabase, não escreve na nota
de origem e não sobe nada sozinho — o artefato ainda precisa ser conferido e
enviado por um humano pela UI de conhecimento do CRM.

## Contrato de frontmatter

Toda nota publicável precisa começar com um bloco YAML `---` contendo os sete
campos definidos em `lib/ai/rag/publication/frontmatter.ts` (Task 1):

```yaml
---
status: PUBLISHED
organization_id: 00000000-0000-4000-8000-000000000001
agent_id: 00000000-0000-4000-8000-000000000002
title: Política de Reembolso
source_id: refund-policy
version: 3
published_at: 2026-08-10T12:00:00Z
---
```

`status` precisa ser exatamente `PUBLISHED` (maiúsculo). Qualquer outro valor,
campo ausente, UUID inválido, `version` não positivo ou `published_at` fora
de ISO-8601 faz o comando recusar a exportação sem escrever nada em disco.

## Fluxo do operador

1. Edite a nota no Obsidian normalmente. Enquanto `status` for `DRAFT` ou
   `REVIEW`, a nota é apenas rascunho — não roda o comando ainda.
2. Quando a nota estiver pronta, mude `status: PUBLISHED` no frontmatter e
   salve.
3. Rode o export a partir da raiz do repositório:

   ```bash
   pnpm knowledge:obsidian:export -- --file <caminho-absoluto-ou-relativo-da-nota.md>
   ```

4. **Revise visualmente o conteúdo da nota antes do passo 3** — veja a seção
   "Limite conhecido do scanner" abaixo. O scanner automático é uma camada de
   defesa em profundidade, não o único controle.
5. Se o comando recusar por `status` não-`PUBLISHED`, corrija o frontmatter na
   origem e repita. Se recusar por segredo/PII detectado, o erro mostra
   apenas o `code` e a `line` do achado (nunca o valor) — abra a nota, vá até
   aquela linha, remova o dado sensível e repita. Nada é escrito em
   `.local/knowledge-publish/` quando a exportação é recusada.
6. Em sucesso, o comando escreve dois arquivos em `.local/knowledge-publish/`
   (diretório local, ignorado pelo Git — ver `.gitignore`):
   - `<source_id>-v<version>.md` — o corpo sanitizado da nota, **sem** o
     bloco de frontmatter (que é workflow-only: `status`, `organization_id`,
     `agent_id`, `source_id`, `version`, `published_at` não são conteúdo de
     conhecimento, são metadado editorial);
   - `<source_id>-v<version>.meta.json` — o sidecar de metadado canônico:
     exatamente os campos validados do frontmatter, na forma que
     `assertPublishableDocument()` devolveu.
     Reexportar a mesma nota (mesmo `source_id` + `version`) sobrescreve os
     mesmos dois arquivos — o nome de saída é determinístico, não acumula lixo.
7. Confira os dois arquivos manualmente e envie-os pela UI/rota de upload de
   conhecimento do CRM (`app/api/v1/ai/knowledge/sources/upload/route.ts` e a
   tela correspondente). O export CLI **não** faz esse upload sozinho — ele
   só prepara o artefato.

## Segredos: nunca no vault

KeePassXC e Infisical são os únicos lugares aprovados para credenciais
humanas/operacionais (`docs/runbooks/ai-platform-secrets.md`). O vault do
Obsidian **nunca** é um desses lugares — não cole senha, token, chave de API,
cookie de sessão ou string de conexão numa nota, mesmo temporariamente, mesmo
em rascunho. O scanner deste export existe para pegar o que passar batido,
não para autorizar colar segredo "porque o scanner vai bloquear depois".

## Limite conhecido do scanner (aceito, não é bug)

`lib/ai/rag/publication/sanitize.ts` detecta segredos por **forma** (regex
determinístico), não por significado — é proposital, para o resultado ser
reproduzível em CI e nunca depender de um LLM decidir o que é seguro
publicar. Isso tem um limite estrutural, medido e aceito pelo operador humano
em 2026-08-13 (ver comentários inline em `sanitize.ts` e a suíte
`sanitize.test.ts`):

> **Valores de segredo curtos (menos de 6 caracteres) ou puramente
> alfabéticos sem dígito** — por exemplo `Senha: hunterx` — podem passar pelo
> scanner sem serem detectados. O scanner exige um sinal mínimo de "isso
> parece gerado" (dígito, ou 6+ maiúsculas seguidas, ou troca minúscula→
> maiúscula no meio da palavra) para não sinalizar toda frase comum que
> contém a palavra "senha".

Na prática isso significa: **o scanner é uma camada de defesa em
profundidade, não o único controle.** Antes de rodar o export, revise o
conteúdo da nota visualmente como faria antes de publicar qualquer
documento — especialmente senhas curtas/simples — porque o scanner
automático não tem garantia de pegar toda forma de segredo. Se você sabe que
colou uma credencial na nota, remova-a manualmente mesmo que o comando não
reclame.

## O que o export NÃO faz

- Não escreve, apaga ou toca na nota de origem no vault (só leitura).
- Não faz upload para o CRM sozinho — o artefato fica local até um humano
  enviá-lo pela UI.
- Não fala com Postgres/Supabase, Storage ou qualquer API do CRM.
- Não roda o scanner sobre o bloco de frontmatter em si — `organization_id` e
  `agent_id` são UUID v4 já validados por schema (`assertPublishableDocument`)
  e por isso ficam fora do escopo do scanner de prosa; o corpo da nota
  (`body`) é o que é varrido, porque é o corpo que vira conteúdo pesquisável
  no CRM. Não coloque segredo no campo `title` do frontmatter — ele não é
  varrido pelo scanner de segredos.
