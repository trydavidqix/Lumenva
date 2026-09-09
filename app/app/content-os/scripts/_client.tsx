"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScriptCard, type ContentScript, type ScriptStatus } from "@/components/content-os/ScriptCard";

const EMPTY: ContentScript[] = [];

export function ScriptsClient({ scripts = EMPTY }: { scripts?: ContentScript[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ScriptStatus | "all">("all");
  const [channel, setChannel] = useState("all");
  const channels = useMemo(() => Array.from(new Set(scripts.map((script) => script.channel))).sort(), [scripts]);
  const filtered = useMemo(() => { const needle = query.trim().toLocaleLowerCase(); return scripts.filter((script) => (!needle || `${script.title} ${script.summary ?? ""} ${script.campaign ?? ""}`.toLocaleLowerCase().includes(needle)) && (status === "all" || script.status === status) && (channel === "all" || script.channel === channel)); }, [channel, query, scripts, status]);
  return <div className="flex h-full flex-col gap-6 p-6"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-accent">Content OS</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">Roteiros</h1><p className="mt-1 max-w-2xl text-sm text-text-muted">Roteiros versionados, aprovados e ligados às campanhas da equipe.</p></div><Button type="button">Novo roteiro</Button></header><div className="flex flex-col gap-3 sm:flex-row"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar roteiro ou campanha" aria-label="Buscar roteiro ou campanha" /><select value={status} onChange={(event) => setStatus(event.target.value as ScriptStatus | "all")} className="h-9 rounded-sm border border-border bg-surface px-3 text-sm text-text"><option value="all">Todos os estados</option><option value="draft">Rascunho</option><option value="review">Em revisão</option><option value="approved">Aprovado</option><option value="archived">Arquivado</option></select><select value={channel} onChange={(event) => setChannel(event.target.value)} className="h-9 rounded-sm border border-border bg-surface px-3 text-sm text-text"><option value="all">Todos os canais</option>{channels.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>{filtered.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((script) => <ScriptCard key={script.id} script={script} />)}</div> : <div className="rounded-lg border border-dashed border-border p-12 text-center"><h2 className="font-medium text-text">{scripts.length ? "Nenhum roteiro corresponde aos filtros" : "Nenhum roteiro criado"}</h2><p className="mt-1 text-sm text-text-muted">{scripts.length ? "Ajuste os filtros para ver outros roteiros." : "Crie o primeiro roteiro para reutilizar o conhecimento editorial da equipe."}</p></div>}</div>;
}

