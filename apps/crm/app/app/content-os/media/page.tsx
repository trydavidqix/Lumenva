import { requireAuth } from "@/lib/auth/server";
import { MediaClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  await requireAuth();
  return <MediaClient />;
}

