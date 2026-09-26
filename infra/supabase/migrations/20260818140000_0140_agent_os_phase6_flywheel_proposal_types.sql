-- Agent OS Phase 6 — Learning Flywheel persistence compatibility.
--
-- The legacy table predates Agent OS and restricts `type` to historical
-- distiller values. Phase 6 deliberately reuses this table, so its closed
-- proposal allowlist must be representable without creating a parallel store.
--
-- IMPORTANT: this migration is prepared only. It must not be applied remotely
-- as part of the Phase 6 implementation without separate migration approval.

alter table flywheel_distiller_proposals
  drop constraint if exists flywheel_distiller_proposals_type_check;

alter table flywheel_distiller_proposals
  add constraint flywheel_distiller_proposals_type_check
  check (
    type in (
      -- Legacy values retained for backwards compatibility, including the
      -- org-memory extension introduced by migration 0067.
      'playbook_bullet',
      'golden_case',
      'reentry_trigger',
      'org_memory_entry',
      -- Agent OS Phase 6 closed allowlist.
      'skill_change',
      'routing_change',
      'eval_case',
      'operational_threshold'
    )
  );

comment on constraint flywheel_distiller_proposals_type_check on flywheel_distiller_proposals is
  'Legacy distiller/org-memory types plus the closed Agent OS Phase 6 Learning Flywheel proposal allowlist.';
