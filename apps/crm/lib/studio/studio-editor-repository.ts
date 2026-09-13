import type { QueryResultRow } from "pg";
import type { Queryable } from "../agent-engine/queue/queue";
import type { AIEditProposal, CanvasDocument, EditorEvalRun, VariantMix } from "./studio-editor";

type StudioRow = QueryResultRow & Record<string, unknown>;

export async function upsertEditProposal(db: Queryable, proposal: AIEditProposal): Promise<StudioRow> {
  const { rows } = await db.query<StudioRow>(
    `insert into public.studio_edit_proposals
       (organization_id, session_id, edit_id, project_id, canvas_id, base_version,
        context_pack_id, instruction, target_layer_ids, patch, permission_level,
        risk_level, idempotency_key, status, eval_refs)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15::jsonb)
     on conflict (organization_id, session_id, idempotency_key)
     do update set edit_id = public.studio_edit_proposals.edit_id
     returning *`,
    [
      proposal.organization_id,
      proposal.session_id,
      proposal.edit_id,
      proposal.project_id,
      proposal.canvas_id,
      proposal.base_version,
      proposal.context_pack_id,
      proposal.instruction,
      JSON.stringify(proposal.target_layer_ids),
      JSON.stringify(proposal.patch),
      proposal.permission_level,
      proposal.risk_level,
      proposal.idempotency_key,
      proposal.status,
      JSON.stringify(proposal.eval_refs),
    ],
  );
  if (!rows[0]) throw new Error("edit_persistence_failed");
  return rows[0];
}

export async function applyEditWithLock(
  db: Queryable,
  proposal: AIEditProposal,
  next: CanvasDocument,
): Promise<void> {
  await db.query("begin");
  try {
    const { rows } = await db.query<StudioRow>(
      `select * from public.studio_canvas_documents
       where organization_id = $1 and session_id = $2 and canvas_id = $3
       order by version desc limit 1 for update`,
      [proposal.organization_id, proposal.session_id, proposal.canvas_id],
    );
    const current = rows[0];
    if (!current || Number(current.version) !== proposal.base_version) throw new Error("stale_version");
    await db.query(
      `insert into public.studio_canvas_documents
         (organization_id, session_id, canvas_id, project_id, version, parent_version,
          viewport, layers, selected_variant_id, editor_state, source_refs, evidence_refs, created_by, created_at)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11::jsonb,$12::jsonb,$13,$14)`,
      [
        next.organization_id,
        next.session_id,
        next.canvas_id,
        next.project_id,
        next.version,
        next.parent_version,
        JSON.stringify(next.viewport),
        JSON.stringify(next.layers),
        next.selected_variant_id ?? null,
        next.editor_state,
        JSON.stringify(next.source_refs),
        JSON.stringify(next.evidence_refs),
        next.created_by,
        next.created_at,
      ],
    );
    await db.query(
      `update public.studio_edit_proposals
       set status = 'APPLIED', approved_by = $4, approved_at = $5
       where organization_id = $1 and session_id = $2 and edit_id = $3`,
      [proposal.organization_id, proposal.session_id, proposal.edit_id, next.created_by, next.created_at],
    );
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

export async function recordEditorEval(db: Queryable, evaluation: EditorEvalRun): Promise<void> {
  await db.query(
    `insert into public.studio_editor_evals
       (organization_id, session_id, eval_id, canvas_id, input_version, eval_version, checks, metrics, status, evidence_refs)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10::jsonb)
     on conflict (organization_id, session_id, eval_id)
     do update set status = excluded.status, metrics = excluded.metrics, evidence_refs = excluded.evidence_refs`,
    [
      evaluation.organization_id,
      evaluation.session_id,
      evaluation.eval_id,
      evaluation.canvas_id,
      evaluation.input_version,
      evaluation.eval_version,
      JSON.stringify(evaluation.checks),
      JSON.stringify(evaluation.metrics),
      evaluation.status,
      JSON.stringify(evaluation.evidence_refs),
    ],
  );
}

export async function recordVariantMix(db: Queryable, mix: VariantMix): Promise<void> {
  await db.query(
    `insert into public.studio_variant_mixes
       (organization_id, session_id, mix_id, project_id, input_variant_ids, output_canvas_id,
        mix_rules, context_pack_id, status, source_refs, evidence_refs)
     values ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8,$9,$10::jsonb,$11::jsonb)
     on conflict (organization_id, session_id, mix_id)
     do update set status = excluded.status, evidence_refs = excluded.evidence_refs`,
    [
      mix.organization_id,
      mix.session_id,
      mix.mix_id,
      mix.project_id,
      JSON.stringify(mix.input_variant_ids),
      mix.output_canvas_id,
      JSON.stringify(mix.mix_rules),
      mix.context_pack_id,
      mix.status,
      JSON.stringify(mix.source_refs),
      JSON.stringify(mix.evidence_refs),
    ],
  );
}
