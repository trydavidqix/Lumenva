import { requireAuth } from "@/lib/auth/server";
import { CreatorsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function CreatorsPage() {
  await requireAuth();
  return <CreatorsClient />;
}

