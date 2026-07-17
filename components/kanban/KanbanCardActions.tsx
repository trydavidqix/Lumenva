"use client";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { DotsThree, PencilSimple, Users } from "@/lib/ui/icons";
import { useWinLead, useEditLead } from "@/hooks/kanban/useUpdateLead";
import { useAssignableMembers } from "@/hooks/inbox/useAssignableMembers";
import { LoseLeadDialog } from "./LoseLeadDialog";
import { EditLeadDialog } from "./EditLeadDialog";
import type { Lead } from "@/lib/types/leads";

interface KanbanCardActionsProps {
  lead: Lead;
  pipelineId: string;
}

export function KanbanCardActions({ lead, pipelineId }: KanbanCardActionsProps) {
  const [loseOpen, setLoseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const winMutation = useWinLead(pipelineId);
  const editMutation = useEditLead(pipelineId);
  const { data: members } = useAssignableMembers(true);

  const reassign = (ownerUserId: string | null) => {
    if (ownerUserId === lead.owner_user_id) return;
    editMutation.mutate({ leadId: lead.id, patch: { owner_user_id: ownerUserId } });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
            onClick={(e) => e.stopPropagation()}
            aria-label="Ações do lead"
          >
            <DotsThree size={16} weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem
            onSelect={() => {
              setEditOpen(true);
            }}
          >
            <PencilSimple size={14} className="mr-2" /> Editar
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Users size={14} className="mr-2" /> Responsável
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                disabled={editMutation.isPending || lead.owner_user_id === null}
                onSelect={() => reassign(null)}
              >
                Sem responsável
              </DropdownMenuItem>
              {(members ?? []).length > 0 && <DropdownMenuSeparator />}
              {(members ?? []).map((m) => (
                <DropdownMenuItem
                  key={m.user_id}
                  disabled={editMutation.isPending || m.user_id === lead.owner_user_id}
                  onSelect={() => reassign(m.user_id)}
                >
                  {m.full_name ?? "Sem nome"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            disabled={winMutation.isPending}
            onSelect={() => {
              winMutation.mutate({ leadId: lead.id });
            }}
          >
            Marcar como ganho
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setLoseOpen(true);
            }}
          >
            Marcar como perdido
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LoseLeadDialog
        open={loseOpen}
        onOpenChange={setLoseOpen}
        leadId={lead.id}
        pipelineId={pipelineId}
      />
      <EditLeadDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        lead={lead}
        pipelineId={pipelineId}
      />
    </>
  );
}
