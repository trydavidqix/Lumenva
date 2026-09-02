"use client";

import * as React from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useEvolution,
  useReviewPhase6Proposal,
  type Phase6EvolutionQueueItem,
  type Phase6ProposalDecision,
} from "@/hooks/ai/useEvolution";

const REVIEWABLE = new Set(["ready_for_human_review"]);

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    ready_for_human_review: "Pronta para revisão humana",
    approved: "Aprovada",
    rejected: "Rejeitada",
    revision_requested: "Revisão pedida",
    rolling_out_shadow: "Em SHADOW",
    rolling_out_draft: "Em DRAFT",
    monitoring: "Em monitoramento",
    rollback_recommended: "Rollback recomendado",
    rolled_back: "Rollback concluído",
    rejected_by_validation: "Bloqueada pela validação",
  };
  return labels[status] ?? status;
}

function proposalTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    skill_change: "Skill / prompt",
    routing_change: "Roteamento",
    eval_case: "Caso de avaliação",
    operational_threshold: "Parâmetro operacional",
  };
  return labels[type] ?? type;
}

function signed(value: number, digits = 2): string {
  const rounded = Number(value.toFixed(digits));
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function QueueItem({ item }: { item: Phase6EvolutionQueueItem }) {
  const review = useReviewPhase6Proposal();
  const [reason, setReason] = React.useState("");
  const reviewable = REVIEWABLE.has(item.status);
  const validation = item.validation_summary;

  function decide(decision: Phase6ProposalDecision) {
    const fallback = decision === "approve" ? "validado_e_aprovado" : "revisao_humana";
    review.mutate({
      agentId: item.scope.agent_id,
      proposalId: item.id,
      decision,
      reason: reason.trim() || fallback,
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-4" data-testid={`phase6-proposal-${item.id}`}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-sm font-semibold">{proposalTypeLabel(item.proposal_type)}</p>
          <p className="text-xs text-text-muted">{item.target}</p>
        </div>
        <span className="text-xs font-medium text-text-muted">{statusLabel(item.status)}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-medium text-text-muted">Estado atual</p>
          <p className="mt-1 text-sm">A configuração ativa continua intacta enquanto esta proposta passa pela revisão.</p>
          <p className="mt-2 text-xs text-text-muted">Rollback conhecido: {item.rollback_target_ref ?? "não aplicável"}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-medium text-text-muted">Mudança candidata</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{item.content}</p>
          <p className="mt-2 text-xs text-text-muted">Candidate: {item.candidate_ref ?? "ainda não criada"}</p>
        </div>
      </div>

      <div className="grid gap-2 text-xs text-text-muted sm:grid-cols-2 lg:grid-cols-4">
        <p>Cluster: {item.cluster_id || "—"}</p>
        <p>Evidências: {item.signal_refs.length}</p>
        <p>Validação: {item.validation_ref ?? "pendente"}</p>
        <p>Rollout: {item.rollout_level ?? "não iniciado"}</p>
      </div>

      {validation ? (
        <div className="grid gap-2 rounded-lg border border-border p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <p>Accuracy Δ: {signed(validation.candidate.accuracy - validation.baseline.accuracy)}</p>
          <p>Falhas Δ: {signed(validation.candidate.failureRate - validation.baseline.failureRate)}</p>
          <p>Custo Δ: {signed(validation.candidate.costCents - validation.baseline.costCents)}¢</p>
          <p>Latência Δ: {signed(validation.candidate.latencyMs - validation.baseline.latencyMs, 0)}ms</p>
          <p>Golden: {validation.goldenCasesPassed ? "PASS" : "FAIL"}</p>
          <p>Safety: {validation.safetyPassed ? "PASS" : "FAIL"}</p>
          <p>Regressões: {validation.regressionCasesPassed ? "PASS" : "FAIL"}</p>
          <p>SHADOW: {validation.shadowPassed === null ? "N/A" : validation.shadowPassed ? "PASS" : "FAIL"}</p>
        </div>
      ) : (
        <p className="text-xs text-text-muted">Métricas de custo/latência só aparecem quando o relatório de validação persistido estiver disponível.</p>
      )}

      {item.rejection_reason && (
        <p className="rounded-md border border-border p-2 text-xs text-text-muted">Motivo registrado: {item.rejection_reason}</p>
      )}

      {reviewable && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motivo da decisão (obrigatório para rejeitar ou pedir revisão)"
            aria-label={`Motivo da decisão para ${item.id}`}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={review.isPending} onClick={() => decide("approve")}>
              Aprovar para rollout governado
            </button>
            <button type="button" className="rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50" disabled={review.isPending || reason.trim().length === 0} onClick={() => decide("request_revision")}>
              Pedir revisão
            </button>
            <button type="button" className="rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50" disabled={review.isPending || reason.trim().length === 0} onClick={() => decide("reject")}>
              Rejeitar
            </button>
          </div>
          {review.isError && <p className="text-xs text-text-muted">Não foi possível registrar a decisão. A proposta continua sem alteração.</p>}
        </div>
      )}
    </Card>
  );
}

export function Phase6LearningQueue() {
  const query = useEvolution();
  const items = query.data?.phase6_queue ?? [];

  return (
    <section className="flex flex-col gap-3" data-testid="phase6-learning-queue">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Fila de melhorias do Learning Flywheel</h2>
        <p className="text-sm text-text-muted">O sistema pode detectar e validar melhorias, mas não se autopromove. A decisão humana continua obrigatória.</p>
      </div>

      {query.isLoading ? (
        <Card className="p-4 text-sm text-text-muted">Carregando propostas de aprendizado…</Card>
      ) : query.isError ? (
        <Card className="p-4 text-sm text-text-muted">A fila de aprendizado não pôde ser carregada agora.</Card>
      ) : items.length === 0 ? (
        <Card className="p-4 text-sm text-text-muted">Nenhuma proposta governada está aberta. Falhas isoladas não viram mudança automaticamente.</Card>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => <QueueItem key={item.id} item={item} />)}
        </div>
      )}
    </section>
  );
}
