"use client";

import { PublicationCalendar, type PublicationEvent } from "@/components/content-os/PublicationCalendar";

export function CalendarClient({ events = [], timeZone }: { events?: PublicationEvent[]; timeZone?: string }) {
  return <div className="flex h-full flex-col gap-6 p-6"><header><p className="text-sm font-medium text-accent">Content OS</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">Calendário de publicações</h1><p className="mt-1 max-w-2xl text-sm text-text-muted">Acompanhe o que está agendado, publicado ou precisa de intervenção.</p></header><PublicationCalendar events={events} timeZone={timeZone} /></div>;
}

