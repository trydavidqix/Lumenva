import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";

import { ScenarioLabClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function ScenarioLabPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg || (!user.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager)) {
    redirect("/403");
  }

  return <ScenarioLabClient />;
}
