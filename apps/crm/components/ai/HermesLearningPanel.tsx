"use client";

import { useEffect, useState } from "react";

type HermesSummary = {
  candidates?: number;
  experiments?: number;
  outcomes?: number;
  recurring_failures?: Array<{ signature: string; count: number }>;
  safety_rollbacks?: number;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: HermesSummary };

export function HermesLearningPanel() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/ai/hermes/summary", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ data?: HermesSummary } & HermesSummary>;
      })
      .then((payload) => {
        if (cancelled) return;
        setState({ kind: "ready", data: payload.data ?? payload });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "Falha ao carregar Hermes",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="hermes-learning-title">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id="hermes-learning-title" className="text-lg font-semibold">Hermes Learning OS</h2>
          <p className="text-sm text-text-muted">
            Aprendizado governado: observa, propõe, avalia e envia para aprovação. Nunca autoativa mudanças.
          </p>
        </div>
        <span className="rounded-full border px-2 py-1 text-xs text-text-muted">READ ONLY</span>
      </div>

      {state.kind === "loading" && <p className="text-sm text-text-muted">Carregando aprendizado…</p>}
      {state.kind === "error" && (
        <p className="text-sm text-red-600" role="alert">Não foi possível carregar o Hermes: {state.message}</p>
      )}
      {state.kind === "ready" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Candidatos" value={state.data.candidates ?? 0} />
            <Metric label="Experimentos" value={state.data.experiments ?? 0} />
            <Metric label="Outcomes" value={state.data.outcomes ?? 0} />
            <Metric label="Rollbacks safety" value={state.data.safety_rollbacks ?? 0} />
          </div>

          {(state.data.candidates ?? 0) === 0 &&
          (state.data.experiments ?? 0) === 0 &&
          (state.data.outcomes ?? 0) === 0 ? (
            <p className="text-sm text-text-muted">Ainda não há evidência de aprendizado para esta organização.</p>
          ) : null}

          {(state.data.recurring_failures?.length ?? 0) > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-medium">Falhas recorrentes</h3>
              <ul className="space-y-1 text-sm text-text-muted">
                {state.data.recurring_failures?.slice(0, 5).map((item) => (
                  <li key={item.signature} className="flex justify-between gap-4">
                    <span className="truncate">{item.signature}</span>
                    <span>{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
