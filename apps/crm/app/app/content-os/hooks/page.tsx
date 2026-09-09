import { requireAuth } from "@/lib/auth/server";
import { HooksClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function HooksPage() {
  await requireAuth();
  return <HooksClient />;
}

