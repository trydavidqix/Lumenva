import { requireAuth } from "@/lib/auth/server";
import { SecurityClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  await requireAuth();

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Segurança</h1>
        <p className="text-sm text-muted-foreground">Sessões e segurança da conta.</p>
      </header>

      <SecurityClient />
    </div>
  );
}
