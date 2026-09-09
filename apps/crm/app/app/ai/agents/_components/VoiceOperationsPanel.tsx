import { getRequestPool } from "@/lib/agent-engine/db/request-pool";

function maskPhone(value: string): string {
  return value.length <= 4 ? "••••" : `••• ${value.slice(-4)}`;
}

function durationLabel(startedAt: Date | string | null, endedAt: Date | string | null): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export async function VoiceOperationsPanel({ organizationId }: { organizationId: string }) {
  let calls: Array<{
    id: string;
    contact_id: string | null;
    direction: string;
    caller_number: string;
    called_number: string;
    state: string;
    started_at: string | null;
    ended_at: string | null;
    created_at: string;
  }> = [];
  let degraded = false;
  try {
    const db = getRequestPool();
    const result = await db.query<typeof calls[number]>(
      `select id, contact_id, direction, caller_number, called_number, state,
              started_at::text, ended_at::text, created_at::text
         from voice_calls
        where organization_id = $1
        order by created_at desc
        limit 8`,
      [organizationId],
    );
    calls = result.rows;
  } catch {
    degraded = true;
  }

  const active = calls.filter((call) => ["ringing", "connecting", "active", "held", "transferring"].includes(call.state)).length;

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm" aria-labelledby="voice-operations-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="voice-operations-title" className="text-base font-semibold">Agente de Ligação</h2>
            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">Voice Engine</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Chamadas Telnyx atendidas pelo mesmo Agent OS, memória e políticas do CRM.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-md bg-muted px-2.5 py-1.5">Ativas: {active}</span>
          <span className="rounded-md bg-muted px-2.5 py-1.5">Últimas: {calls.length}</span>
        </div>
      </div>

      {degraded ? (
        <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Dados de voz indisponíveis. O restante do CRM continua operacional.
        </div>
      ) : calls.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Nenhuma chamada registrada ainda. O Voice Engine permanece isolado até a ativação do número e das credenciais.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="pb-2 pr-4 font-medium">Estado</th>
                <th className="pb-2 pr-4 font-medium">Direção</th>
                <th className="pb-2 pr-4 font-medium">Cliente</th>
                <th className="pb-2 pr-4 font-medium">Número</th>
                <th className="pb-2 pr-4 font-medium">Duração</th>
                <th className="pb-2 font-medium">Início</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => {
                const customerNumber = call.direction === "inbound" ? call.caller_number : call.called_number;
                return (
                  <tr key={call.id} className="border-b last:border-0">
                    <td className="py-3 pr-4"><span className="rounded-full bg-muted px-2 py-1 text-xs">{call.state}</span></td>
                    <td className="py-3 pr-4">{call.direction === "inbound" ? "Entrada" : "Saída"}</td>
                    <td className="py-3 pr-4">{call.contact_id ? "Identificado" : "Desconhecido"}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{maskPhone(customerNumber)}</td>
                    <td className="py-3 pr-4 tabular-nums">{durationLabel(call.started_at, call.ended_at)}</td>
                    <td className="py-3 text-muted-foreground">{new Date(call.created_at).toLocaleString("pt-PT")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
