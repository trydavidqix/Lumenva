"use client";

import { Button } from "@/components/ui/button";
import { MediaGrid, type MediaAsset } from "@/components/content-os/MediaGrid";

export function MediaClient({ assets = [] }: { assets?: MediaAsset[] }) {
  return <div className="flex h-full flex-col gap-6 p-6"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-accent">Content OS</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">Media Studio</h1><p className="mt-1 max-w-2xl text-sm text-text-muted">Assets duráveis e jobs de geração com estado visível do início ao fim.</p></div><Button type="button">Gerar mídia</Button></header><MediaGrid assets={assets} /></div>;
}

