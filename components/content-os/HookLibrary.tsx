"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, MagnifyingGlass } from "@/lib/ui/icons";

export interface ContentHook {
  id: string;
  text: string;
  category: string;
  funnel?: string;
  channel?: string;
  usageCount: number;
  performance?: { label: string; value: string };
}

export function HookLibrary({
  hooks,
  onCopy,
}: {
  hooks: ContentHook[];
  onCopy?: (hook: ContentHook) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const categories = useMemo(
    () => Array.from(new Set(hooks.map((hook) => hook.category))).sort(),
    [hooks],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return hooks.filter((hook) => {
      const matchesQuery = !normalized || `${hook.text} ${hook.category} ${hook.channel ?? ""}`.toLocaleLowerCase().includes(normalized);
      return matchesQuery && (category === "all" || hook.category === category);
    });
  }, [category, hooks, query]);

  return (
    <section className="space-y-4" aria-label="Biblioteca de hooks">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar hooks</span>
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por texto, categoria ou canal" className="pl-9" />
        </label>
        <label>
          <span className="sr-only">Filtrar por categoria</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 rounded-sm border border-border bg-surface px-3 text-sm text-text">
            <option value="all">Todas as categorias</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-text-muted">Nenhum hook encontrado.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((hook) => (
            <article key={hook.id} className="flex h-full flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-xs">
              <p className="text-base leading-7 text-text">“{hook.text}”</p>
              <div className="flex flex-wrap gap-2"><Badge>{hook.category}</Badge>{hook.funnel ? <Badge variant="neutral">{hook.funnel}</Badge> : null}{hook.channel ? <Badge variant="neutral">{hook.channel}</Badge> : null}</div>
              <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs"><div><dt className="text-text-muted">Usos</dt><dd className="mt-1 font-medium text-text">{hook.usageCount}</dd></div><div><dt className="text-text-muted">Sinal</dt><dd className="mt-1 font-medium text-text">{hook.performance ? `${hook.performance.label}: ${hook.performance.value}` : "Ainda sem dados"}</dd></div></dl>
              <Button type="button" size="sm" variant="secondary" onClick={() => onCopy?.(hook)}><Copy size={14} /> Copiar hook</Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

