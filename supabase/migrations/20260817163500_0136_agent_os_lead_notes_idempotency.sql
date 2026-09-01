-- Agent OS Fase 1.3 — idempotência durável de save_lead_note.
--
-- Não aplica migration aqui: este arquivo apenas materializa o contrato para o
-- próximo deploy seguro. Notas antigas ficam com NULL e preservam comportamento.

alter table public.lead_notes
  add column if not exists idempotency_key text;

create unique index if not exists uniq_lead_notes_idempotency
  on public.lead_notes (organization_id, contact_id, idempotency_key)
  where idempotency_key is not null;
