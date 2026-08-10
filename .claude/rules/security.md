# Security — DeskcommCRM

> Regra modular compartilhada. Em caso de conflito, `CLAUDE.md` da raiz vence. Para auth/RBAC exatos, consulte PRD/Spec 01.

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

## Auth e identidade

- Backend usa `getUser()`, nunca `getSession()` como prova de identidade.
- API key/token nunca vai em query string.
- Plaintext de bearer é mostrado uma vez na criação e não deve ser persistido; o contrato base usa hash SHA256/prefixo conforme Spec 01.
- Cookie/session segue o contrato seguro da plataforma (SameSite/HttpOnly/Secure em produção conforme auth canônica).
- HMAC de webhook usa comparação timing-safe e deve falhar fechado quando o secret necessário não existe.

## RBAC

Roles tenant canônicas:

```text
viewer < agent < manager < admin
```

- Enforcement é server-side; esconder/desabilitar botão não é boundary de segurança.
- Um usuário pode ter roles diferentes em organizações diferentes conforme `user_organizations`.
- Mudança de role é auditada.
- Permissão por pipeline (`user_pipeline_access`) continua **fora do MVP** enquanto PRD 01 mantiver essa decisão; não crie esse eixo por antecipação.

## MFA e platform admin

- MFA TOTP é **obrigatório para `admin` e platform admin** conforme PRD 01.
- O papel cross-tenant de plataforma é modelado pela tabela canônica `platform_admins` resolvida na Spec 01 — não por uma coluna normativa `is_platform_admin` em `auth.users`.
- Platform admin é o único papel de usuário que atravessa tenants pelo contrato base.
- Inclusão/remoção de platform admin não é self-service/API comum; é operação administrativa controlada e auditada.
- Ação cross-tenant de platform admin precisa deixar evidência adequada de acting-as/bypass.

## Service role

Service role bypassa RLS. Todo código que usa admin client em superfície tenant-aware deve:

1. resolver `organization_id` de fonte confiável;
2. nunca aceitar a organização do request body como autoridade;
3. filtrar `organization_id` manualmente em toda query relevante;
4. preservar RBAC/ownership da operação;
5. registrar audit quando a operação for mutação relevante.

Detalhe de isolamento: `.claude/rules/multi-tenancy.md`.

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
- Regras detalhadas de audit/retenção: `.claude/rules/audit-observability.md`.
- Regras de dados pessoais: `.claude/rules/lgpd.md`.

## Dependências e integrações

Antes de adicionar integração externa, determine:

- quais dados saem do sistema;
- quais credenciais são necessárias;
- se existe custo;
- como a integração falha;
- como desativá-la sem quebrar o CRM.

Não amplie o escopo de uma tarefa para criar integração ou infraestrutura sem autorização.

## Fontes

- `docs/prd/01-prd-platform-base.md` §3.1, §3.3, §3.4
- `docs/specs/01-spec-platform-base.md`
