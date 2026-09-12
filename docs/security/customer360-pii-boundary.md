# Customer 360: fronteira de segurança e PII

Auditoria estática provider-free da superfície Customer 360 (EPIC-05/09/10).
Não altera schema canónico nem migrations.

- Contacts filtrado por organization_id do contexto confiável.
- decrypt_cpf condicionado a role manager ou superior.
- Ferramentas MCP não retornam CPF em plaintext.
- MergeDialog permanece read-only até endpoint manager+ com transação, auditoria e evento.

A auditoria estática não prova RLS real, transação de merge, Storage, email,
MFA ou providers; esses gates ficam para fixtures/ambientes autorizados.
