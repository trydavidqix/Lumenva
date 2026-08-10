# Security — DeskcommCRM

> Regra modular compartilhada. Em caso de conflito, `CLAUDE.md` da raiz vence.

## Segredos e dados privados

Nunca exponha, registre, commite ou copie para documentação:

- passwords;
- API keys;
- bearer tokens;
- cookies;
- conteúdo de `.env*`;
- credenciais de integrações;
- PII de clientes;
- dumps ou screenshots com dados reais.

Ao documentar configuração, mostre somente o nome da variável com valor ocultado, por exemplo `SUPABASE_SERVICE_ROLE_KEY=<REDACTED>`.

## Auth e autorização

- Backend usa `getUser()`, nunca `getSession()` como prova de identidade.
- Enforcement de RBAC é server-side; UI não é boundary de segurança.
- API key/token nunca vai em query string.
- Plaintext de bearer token não deve ser persistido; o contrato do projeto usa hash quando aplicável.
- HMAC de webhook usa comparação timing-safe e deve falhar fechado quando o secret necessário não existe.

## Service role

Service role bypassa RLS. Todo código que usa admin client em superfície tenant-aware deve:

1. resolver `organization_id` de fonte confiável;
2. nunca aceitar a organização do request body como autoridade;
3. filtrar `organization_id` manualmente em toda query relevante;
4. registrar audit quando a operação for mutação relevante.

## Produção e ações externas

Exigem autorização explícita antes de executar:

- modificar produção;
- alterar dados reais;
- alterar credenciais;
- trocar limites de auth/permissions;
- criar custo recorrente ou recurso pago;
- substituir infraestrutura;
- realizar operação destrutiva.

## Logging e observabilidade

- Use o logger estruturado do projeto; `console.log` não é aceito em código merged.
- Não confie apenas em sanitização posterior do Sentry; minimize dados na origem.
- Mensagens de erro e testes também não devem conter PII/secrets.

## Dependências e integrações

Antes de adicionar integração externa, determine:

- quais dados saem do sistema;
- quais credenciais são necessárias;
- se existe custo;
- como a integração falha;
- como desativá-la sem quebrar o CRM.

Não amplie o escopo de uma tarefa para criar integração ou infraestrutura sem autorização.
