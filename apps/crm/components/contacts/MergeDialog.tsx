"use client";
/**
 * MergeDialog — read-only scaffolding.
 *
 * Combo-A only delivered the contacts CRUD + LGPD anonymize endpoint. The
 * merge_queue resolve endpoint (`POST /api/v1/merge_queue/[id]/resolve`) is
 * deferred to a follow-up combo. For the MVP this dialog renders the
 * candidates side-by-side but submits no mutation — the action button is a
 * placeholder informing the operator that resolution is not yet wired.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/browser";

interface CandidateSummary {
  id?: string;
  name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  [key: string]: unknown;
}

interface MergeQueueRow {
  id: string;
  candidates: CandidateSummary[] | null;
  status: string;
}

interface Props {
  queueItemId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onResolved?: () => void;
}

export function MergeDialog({ queueItemId, open, onOpenChange, onResolved }: Props) {
  const [item, setItem] = useState<MergeQueueRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !queueItemId) return;
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("merge_queue")
      .select("id, candidates, status")
      .eq("id", queueItemId)
      .maybeSingle()
      .then(({ data }: { data: unknown }) => {
        if (!cancelled) {
          setItem(data as MergeQueueRow | null);
          setPrimaryId((data as MergeQueueRow | null)?.candidates?.[0]?.id ?? null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, queueItemId]);

  const candidates = item?.candidates ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Resolver merge de contatos</DialogTitle>
          <DialogDescription>
            Comparação dos candidatos detectados. A resolução automática via API
            ainda não está disponível neste MVP — entre em contato com o admin para
            mesclar via a API após duas confirmações.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum candidato disponível.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {candidates.map((c, idx) => (
              <div
                key={c.id ?? idx}
                className="rounded-md border border-border bg-card p-3 text-sm"
              >
                <div className="font-medium">{c.name ?? "—"}</div>
                <div className="text-muted-foreground">{c.email ?? "—"}</div>
                <div className="text-muted-foreground">{c.phone_number ?? "—"}</div>
                <Button type="button" variant={primaryId === c.id ? "default" : "outline"} onClick={() => setPrimaryId(c.id ?? null)}>
                  {primaryId === c.id ? "Primary selecionado" : "Escolher primary"}
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button disabled={!primaryId || submitting} onClick={async () => {
            if (!primaryId || !window.confirm("Confirma a mesclagem? Esta ação é irreversível.")) return;
            if (!window.confirm("Confirma novamente: os contactos perdedores serão tombstoned?")) return;
            setSubmitting(true);
            const losers = candidates.flatMap((c) => c.id && c.id !== primaryId ? [c.id] : []);
            const response = await fetch(`/api/v1/merge_queue/${queueItemId}/resolve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "merge", primary_id: primaryId, loser_ids: losers }) });
            setSubmitting(false);
            if (response.ok) { onResolved?.(); onOpenChange(false); }
          }}>
            {submitting ? "A resolver…" : "Confirmar mesclagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
