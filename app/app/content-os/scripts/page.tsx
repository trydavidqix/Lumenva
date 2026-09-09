import { requireAuth } from "@/lib/auth/server";
import { ScriptsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function ScriptsPage() {
  await requireAuth();
  return <ScriptsClient />;
}

