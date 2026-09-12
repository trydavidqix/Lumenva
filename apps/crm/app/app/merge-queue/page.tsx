import { redirect } from "next/navigation";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { MergeQueueList } from "./_components/MergeQueueList";

export const dynamic = "force-dynamic";

export default async function MergeQueuePage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!user.is_platform_admin && !["manager", "admin", "owner"].includes(activeOrg.role)) redirect("/app");
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Fila de merges</h1>
        <p className="text-sm text-muted-foreground">Revise possíveis contactos duplicados antes de mesclar ou descartar.</p>
      </header>
      <MergeQueueList />
    </div>
  );
}
