"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChartLineUp, ClockCountdown, Buildings, Sparkle, CalendarBlank } from "@/lib/ui/icons";

const sectionLinks = [
  { href: "/app/content-os", label: "Visão geral", icon: ChartLineUp, exact: true },
  { href: "/app/content-os/radar", label: "Radar de notícias", icon: ClockCountdown },
  { href: "/app/content-os/competitors", label: "Concorrentes", icon: Buildings },
  { href: "/app/content-os/create", label: "Criar conteúdo", icon: Sparkle },
  { href: "/app/content-os/calendar", label: "Calendário", icon: CalendarBlank },
] as const;

export function ContentOsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Content OS</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Conteúdo que trabalha por você</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Descubra, decida, crie, publique e aprenda em um fluxo único.</p>
        </div>
        <nav aria-label="Navegação do Content OS" className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-1">
          {sectionLinks.map(({ href, label, icon: Icon }) => {
            const active = href === "/app/content-os" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent-soft hover:text-foreground",
                )}
              >
                <Icon size={16} weight={active ? "fill" : "regular"} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </div>
  );
}
