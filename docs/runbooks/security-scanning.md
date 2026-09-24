# Varredura de seguranca

Este runbook separa revisao humana/assistida de scanners deterministicos. O primeiro ciclo e
**report-only**: achados geram logs e SARIF, mas nao bloqueiam o baseline do CI. A promocao de um
scanner para gate exige triagem do baseline e decisao explicita do Owner.

## Estado do combo

| Item | Estado | Motivo curto |
| --- | --- | --- |
| Claude Code + Claude Security Plugin | **FALTA** | Claude Code 2.1.281 esta instalado; o plugin oficial existe no marketplace local, mas nao esta instalado nem ativo. |
| `security-guidance` | **FALTA** | Existe no marketplace oficial local, mas nao esta instalado nem ativo. |
| Claude `/security-review` | **FALTA** | Nao ha comando instalado; a unica ocorrencia local e um exemplo de criacao de comando. O `security-guidance` ja oferece revisao de diff e de commit com escopo semelhante. |
| Codex | **JA TEMOS** | Codex CLI 0.155.1 esta disponivel para segunda analise e correcao em branch isolada. |
| CodeQL | **JA TEMOS** | Default setup do GitHub esta configurado para Actions, JavaScript/TypeScript e Python. |
| Semgrep | **FALTA** | Nao existe no `main`; este PR adiciona scan CE em PR, semanal e manual. |
| OSV-Scanner | **FALTA** | Nao existe no `main`; este PR adiciona scan recursivo de lockfiles e SARIF. |
| Gitleaks | **FALTA** | Secret scanning e push protection do GitHub estao ativos, mas nao substituem a varredura completa do historico; este PR adiciona Gitleaks. |
| OWASP ZAP | **DECISAO DO OWNER** | Precisa de URL de teste estavel, autenticacao de teste e regras de escopo. Sem esse ambiente, automatizar DAST criaria ruido ou atingiria o alvo errado. |
| Dependabot | **JA TEMOS** | `.github/dependabot.yml` cobre npm e GitHub Actions semanalmente. Alertas existem; updates de seguranca automaticos estao desativados na configuracao do repositorio. |
| OSS-Fuzz / ClusterFuzzLite | **NAO SE APLICA** | O produto e majoritariamente TypeScript; a documentacao publicada do ClusterFuzzLite nao lista JavaScript/TypeScript entre as linguagens suportadas. OSS-Fuzz tambem exige integracao e elegibilidade proprias. |

## Ordem do pipeline

1. **Durante a implementacao:** `security-guidance`, se o Owner decidir instalar, alerta padroes
   perigosos e revisa o diff/commit dentro do Claude Code.
2. **Antes do PR:** Claude Security faz auditoria profunda quando o risco justificar; Codex faz a
   segunda leitura e prepara correcoes em worktree separado.
3. **No PR:** CodeQL e os jobs Semgrep, OSV-Scanner e Gitleaks rodam em paralelo. Todos comecam em
   report-only; achados sao triados, nao tratados automaticamente como bloqueio.
4. **Revisao final:** `/security-review` so entra se o Owner instalar/criar esse comando. Depois,
   Claude compara achados, diff e checks antes do PR seguir para decisao humana.
5. **Depois da decisao do Owner:** ZAP entra somente contra ambiente de teste autorizado; fuzzing
   entra somente depois de existir um harness reproduzivel e corpus inicial.

## Cadencia

| Momento | O que roda |
| --- | --- |
| A cada PR | CodeQL existente; Semgrep; OSV-Scanner; Gitleaks. |
| Semanal | Semgrep; OSV-Scanner; Gitleaks. O CodeQL continua sob o default setup gerenciado pelo GitHub. |
| Manual | O mesmo workflow via `workflow_dispatch`; Claude Security e Codex conforme o risco da mudanca. |
| Futuro, com ambiente de teste | ZAP baseline autenticado, limitado ao host autorizado e inicialmente report-only. |
| Futuro, com harness | Fuzzing curto em PR e campanha mais longa semanal. |

## Fuzzing: avaliacao pratica

ClusterFuzzLite roda no proprio GitHub Actions, sem exigir inscricao no servico OSS-Fuzz. Mesmo
assim, a integracao oficial publicada nao cobre TypeScript/JavaScript. Para este repositorio, um
piloto realista seria usar um fuzzer de Node, como Jazzer.js, em uma tarefa separada aprovada pelo
Owner. Isso exige dependencia de desenvolvimento, targets executaveis, corpus e limites de tempo;
por isso nao foi adicionado neste PR de tooling.

Alvos plausiveis, por receberem entrada nao confiavel e terem contrato relativamente puro:

- `apps/crm/lib/waha/webhook-auth.ts`: assinatura e formatos de webhook WAHA;
- `apps/crm/lib/voice/telnyx/webhook.ts`: validacao de eventos Telnyx;
- `apps/crm/lib/billing/stripe-webhook.ts`: parsing e assinatura Stripe;
- `apps/crm/lib/schemas/nuvemshop-webhook.ts`: schemas de payload Nuvemshop;
- `apps/crm/lib/messaging/media/upload-validation.ts`: nomes, tipos e limites de upload.

## Triagem e promocao para gate

1. Abra o job e confirme arquivo, regra e versao afetada; nunca copie um segredo encontrado para
   comentario, issue ou log adicional.
2. Marque falso positivo apenas com justificativa revisavel e supressao estreita.
3. Corrija primeiro achados exploraveis ou credenciais reais. Credencial exposta deve ser
   revogada/rotacionada; remover somente o texto nao e suficiente.
4. Promova um scanner de report-only para bloqueante apenas quando o baseline conhecido estiver
   tratado e o Owner aprovar a politica.

## Limites atuais

- Nao ha ZAP sem ambiente de teste autorizado.
- Nao ha fuzzing sem harness e targets mantidos pelo time de produto.
- O workflow nao instala nem configura plugins do Claude Code e nao altera configuracoes globais.
- O token automatico do GitHub usa apenas as permissoes declaradas por job; nao ha segredo de
  repositorio exigido.
