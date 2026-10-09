# Social Inbox Unification

This document details the adaptation of the Social Inbox for the Lumenva CRM.

## Scope

- Mapear interface de inbox/contato da Task 02.
- Regras de keywords e DM da origem (adaptadas sem copiar SQLite ou pipeline de envio da Task 08).
- Write to CRM via porta injetada Contact/Identity (tenant, account, provider, externalId).
- Deduplicação (não usar nome/email para dedup).
