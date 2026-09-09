"use client";

import * as React from "react";
import { ContentEditor, EMPTY_CONTENT_DRAFT, type ContentDraft } from "@/components/content-os/ContentEditor";
import { ApprovalPanel, type ApprovalEvent } from "@/components/content-os/ApprovalPanel";

export function ContentCreationWorkspace({ canApprove }: { canApprove: boolean }) {
  const [draft, setDraft] = React.useState<ContentDraft>(EMPTY_CONTENT_DRAFT);
  const [events, setEvents] = React.useState<ApprovalEvent[]>([]);
  const [saved, setSaved] = React.useState<ContentDraft>(EMPTY_CONTENT_DRAFT);
  async function save(next: ContentDraft) { setSaved(next); }
  async function transition(status: ContentDraft["status"], note: string) {
    setDraft((current) => ({ ...current, status }));
    setEvents((current) => [...current, { status, actor: "Você", at: new Date().toISOString(), note: note || undefined }]);
  }
  return <div className="flex h-full flex-col gap-6 p-4 sm:p-6"><ContentEditor onChange={setDraft} onSave={save} /><ApprovalPanel status={draft.status} events={events} canApprove={canApprove} onTransition={transition} /><span className="sr-only" aria-live="polite">{saved.title ? "Rascunho salvo" : ""}</span></div>;
}
