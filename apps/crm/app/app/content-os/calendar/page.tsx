import { requireAuth } from "@/lib/auth/server";
import { CalendarClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  await requireAuth();
  return <CalendarClient />;
}

