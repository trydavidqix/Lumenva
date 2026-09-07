"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { CreatorCard, type ContentCreator } from "@/components/content-os/CreatorCard";

export function CreatorsClient({ creators = [] }: { creators?: ContentCreator[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => { const needle = query.trim().toLocaleLowerCase(); return creators.filter((creator) => !needle || `${creator.name} ${creator.role ?? ""} ${creator.speciality ?? ""} ${creator.channels.join(" ")}`.toLocaleLowerCase().includes(needle)); }, [creators, query]);
  return <div className="flex h-full flex-col gap-6 p-6"><header><p className="text-sm font-medium text-accent">Content OS</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">Criadores</h1><p className="mt-1 max-w-2xl text-sm text-text-muted">Perfis e atribuições ligados às campanhas, sem métricas inventadas.</p></header><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar criador, especialidade ou canal" aria-label="Buscar criador" />{filtered.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((creator) => <CreatorCard key={creator.id} creator={creator} />)}</div> : <div className="rounded-lg border border-dashed border-border p-12 text-center"><h2 className="font-medium text-text">Nenhum criador disponível</h2><p className="mt-1 text-sm text-text-muted">Os perfis atribuíveis aparecerão aqui quando forem cadastrados.</p></div>}</div>;
}

