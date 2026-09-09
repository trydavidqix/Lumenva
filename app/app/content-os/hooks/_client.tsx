"use client";

import { HookLibrary, type ContentHook } from "@/components/content-os/HookLibrary";

export function HooksClient({ hooks = [] }: { hooks?: ContentHook[] }) {
  return <div className="flex h-full flex-col gap-6 p-6"><header><p className="text-sm font-medium text-accent">Content OS</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">Biblioteca de hooks</h1><p className="mt-1 max-w-2xl text-sm text-text-muted">Aberturas reutilizáveis por etapa do funil e canal, com sinal de uso real.</p></header><HookLibrary hooks={hooks} /></div>;
}

