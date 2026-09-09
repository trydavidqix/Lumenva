import { Badge } from "@/components/ui/badge";

export type ContentJobState = "queued" | "running" | "succeeded" | "failed" | "cancelled";

const labels: Record<ContentJobState, string> = {
  queued: "Na fila",
  running: "Em andamento",
  succeeded: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
};

const variants: Record<ContentJobState, "neutral" | "info" | "success" | "error" | "warning"> = {
  queued: "neutral",
  running: "info",
  succeeded: "success",
  failed: "error",
  cancelled: "warning",
};

export function JobStatus({ state }: { state: ContentJobState }) {
  return <Badge variant={variants[state]}>{labels[state]}</Badge>;
}
