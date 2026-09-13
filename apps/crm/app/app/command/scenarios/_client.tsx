"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, Sparkle } from "@/lib/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ScenarioRow = {
  id: string;
  title: string | null;
  question: string;
  status: string;
  updated_at?: string;
  run_request_event_id?: string;
};

type Envelope<T> = { data?: T; error?: { message?: string } };

const statusLabel: Record<string, string> = {
  DRAFT: "Rascunho",
  EVIDENCE_READY: "Evidência pronta",
  COMPILED: "Compilado",
  READY: "Pronto",
  RUNNING: "Simulando",
  ANALYZING: "Analisando",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  FAILED: "Falhou",
  EXPIRED: "Expirado",
};

export function ScenarioLabClient() {
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/v1/scenarios?limit=50", { credentials: "include", cache: "no-store" });
      const payload = await response.json() as Envelope<{ scenarios: ScenarioRow[] }>;
      if (!response.ok) throw new Error(payload.error?.message ?? "Falha ao carregar cenários.");
      setScenarios(payload.data?.scenarios ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar cenários.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeCount = useMemo(
    () => scenarios.filter((scenario) => ["RUNNING", "ANALYZING"].includes(scenario.status)).length,
    [scenarios],
  );

  async function createScenario() {
    if (question.trim().length < 8) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/scenarios", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(title.trim() ? { title: title.trim() } : {}),
          question: question.trim(),
        }),
      });
      const payload = await response.json() as Envelope<{ scenario: ScenarioRow }>;
      if (!response.ok) throw new Error(payload.error?.message ?? "Falha ao criar cenário.");
      if (payload.data?.scenario) setScenarios((items) => [payload.data!.scenario, ...items]);
      setTitle("");
      setQuestion("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao criar cenário.");
    } finally {
      setSubmitting(false);
    }
  }

  async function requestRun(id: string) {
    setRunningId(id);
    setError(null);
    try {
      const response = await fetch(`/api/v1/scenarios/${id}/run`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json() as Envelope<{ scenario: ScenarioRow }>;
      if (!response.ok) throw new Error(payload.error?.message ?? "Falha ao enfileirar cenário.");
      if (payload.data?.scenario) {
        setScenarios((items) => items.map((item) => item.id === id ? payload.data!.scenario : item));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao enfileirar cenário.");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Sparkle size={16} aria-hidden /> Command Center / Scenario Lab
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Testar decisões antes de agir</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Compare estratégias com populações sintéticas, várias sementes e revisão do Council. Os resultados são hipóteses simuladas — não previsões calibradas nem fatos do CRM.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cenários</p><p className="mt-1 text-2xl font-semibold">{scenarios.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Em execução</p><p className="mt-1 text-2xl font-semibold">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><AlertTriangle size={18} aria-hidden /><p className="text-sm text-muted-foreground">Sintético por padrão; evidência real continua somente leitura.</p></CardContent></Card>
      </section>

      {error ? <Card><CardContent className="flex items-center gap-3 p-4 text-sm"><AlertTriangle size={18} aria-hidden /><span>{error}</span></CardContent></Card> : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader><CardTitle>Novo cenário</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título opcional" maxLength={160} />
            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ex.: O que acontece se aumentarmos o preço de €49 para €79?"
              rows={6}
              maxLength={4000}
            />
            <Button onClick={() => void createScenario()} disabled={submitting || question.trim().length < 8} className="w-full">
              {submitting ? "Criando…" : "Criar cenário"}
            </Button>
            <p className="text-xs text-muted-foreground">A organização é derivada da sessão. O cliente não envia nem escolhe tenant.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cenários recentes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {loading ? <div className="h-32 animate-pulse rounded-lg bg-muted" /> : scenarios.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Nenhum cenário criado ainda.</div>
            ) : scenarios.map((scenario) => (
              <div key={scenario.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><Badge variant="secondary">{statusLabel[scenario.status] ?? scenario.status}</Badge>{scenario.updated_at ? <span className="text-xs text-muted-foreground"><Clock size={12} className="mr-1 inline" aria-hidden />{new Date(scenario.updated_at).toLocaleString("pt-PT")}</span> : null}</div>
                    <h2 className="mt-3 font-medium">{scenario.title || "Cenário sem título"}</h2>
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{scenario.question}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={scenario.status === "READY" ? "default" : "outline"}
                    disabled={scenario.status !== "READY" || runningId === scenario.id}
                    onClick={() => void requestRun(scenario.id)}
                  >
                    {runningId === scenario.id ? "Enfileirando…" : scenario.status === "READY" ? "Simular" : "Aguardando preparo"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
