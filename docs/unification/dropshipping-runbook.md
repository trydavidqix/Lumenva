# Dropshipping Unification Runbook

## Status: BLOCKED

### Missing Persistence Requirements for Dropshipping Approval Workflow
The `public.orders` table exists in CRM (`infra/supabase/baseline.sql`) and contains standard e-commerce fields (`external_id`, `status`, `total_cents`, `currency`, `fulfillment_status`, etc.).
However, to fully support the "dropshipping approval/submission workflow" required by Task 14 without modifying the schema (which is forbidden), the following persistence capabilities are missing and unsupported by the current table:
1. **Approval Status:** There is no dedicated field for dropshipping-specific approval status (e.g., `dropshipping_status` or a distinct `approval_state`). Using the generic `status` field might conflict with the provider's standard lifecycle statuses.
2. **Supplier Data:** There are no fields to track the dropshipping supplier (e.g., `supplier_id`, `supplier_name`) or the cost of goods sold from the supplier (e.g., `supplier_cost_cents`).
3. **Approval Metadata:** There are no fields to track who approved the order, when it was approved, or any associated notes (e.g., `approved_by`, `approved_at`, `approval_notes`).

Due to the strict instruction "Não invente aprovação durável se a tabela atual não a suporta: entregue a gestão suportada pelos campos existentes e liste exatamente o mínimo de persistência que falta para o workflow de aprovação/submissão" and the restriction against modifying the schema, a complete, durable approval workflow is not possible. The implemented workflow provides read-only visibility into orders using the existing CRM table structure.
