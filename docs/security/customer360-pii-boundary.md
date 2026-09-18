# Customer 360: security and PII boundary

Static provider-free review for EPIC-05/09/10. Contact handlers must scope every query by organization_id; CPF decryption requires manager+; MCP output excludes plaintext CPF; MergeDialog remains mutation-disabled until the authorized transactional endpoint exists.

This note does not claim database RLS, SQL atomicity, Storage, email, MFA, or provider proof. Those require an authorized fixture environment.
