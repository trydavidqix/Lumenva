import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

interface ChannelRow {
  id: string;
  display_name: string | null;
  status: string;
  phone_number: string | null;
  daily_message_limit: number;
  is_warmup_complete: boolean | null;
  last_health_check_at: string | null;
  waha_session_name: string;
}

export default async function WhatsAppSettingsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!user.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    redirect("/403");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("channel_sessions")
    .select(
      "id, display_name, status, phone_number, daily_message_limit, is_warmup_complete, last_health_check_at, waha_session_name",
    )
    .eq("organization_id", activeOrg.orgId)
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as ChannelRow[];

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Sessões WAHA conectadas. Edição e re-warm — em breve (requer container WAHA ativo).
        </p>
      </header>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Limite diário</TableHead>
              <TableHead>Warm-up</TableHead>
              <TableHead>Último health</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Nenhuma sessão WAHA conectada.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    {r.display_name ?? r.waha_session_name}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.status}</TableCell>
                  <TableCell className="font-mono text-xs">{r.phone_number ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.daily_message_limit}</TableCell>
                  <TableCell className="text-xs">
                    {r.is_warmup_complete ? "completo" : "em curso"}
                  </TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground">
                    {r.last_health_check_at
                      ? new Date(r.last_health_check_at).toLocaleString("pt-BR")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
