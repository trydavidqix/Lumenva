"use client";
import { useEffect, useState } from "react";
import { MagnifyingGlass } from "@/lib/ui/icons";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export type InboxTab = "unassigned" | "mine" | "all" | "closed" | "ai";

export interface InboxFiltersValue {
  tab: InboxTab;
  search: string;
  onlyUnread: boolean;
}

interface Props {
  value: InboxFiltersValue;
  onChange: (next: InboxFiltersValue) => void;
}

export function InboxFilters({ value, onChange }: Props) {
  const [searchInput, setSearchInput] = useState(value.search);

  // Debounce search input → propagate to parent.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== value.search) {
        onChange({ ...value, search: searchInput });
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  return (
    <div className="space-y-3 border-b border-border bg-background px-3 py-3">
      <div className="relative">
        <MagnifyingGlass
          size={14}
          weight="regular"
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar mensagens…"
          className="h-8 pl-8 text-sm"
          aria-label="Buscar conversas"
        />
      </div>

      <Tabs
        value={value.tab}
        onValueChange={(v) => onChange({ ...value, tab: v as InboxTab })}
      >
        <TabsList className="grid h-8 w-full grid-cols-5">
          <TabsTrigger value="unassigned" className="text-[11px]">
            Não atribuídos
          </TabsTrigger>
          <TabsTrigger value="mine" className="text-[11px]">
            Meus
          </TabsTrigger>
          <TabsTrigger value="all" className="text-[11px]">
            Todos
          </TabsTrigger>
          <TabsTrigger value="closed" className="text-[11px]">
            Fechados
          </TabsTrigger>
          <TabsTrigger value="ai" className="text-[11px]">
            IA
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center justify-between">
        <Label htmlFor="only-unread" className="text-xs text-muted-foreground">
          Apenas não lidos
        </Label>
        <Switch
          id="only-unread"
          checked={value.onlyUnread}
          onCheckedChange={(v) => onChange({ ...value, onlyUnread: v })}
        />
      </div>
    </div>
  );
}
