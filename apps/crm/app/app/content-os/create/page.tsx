import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { ContentCreationWorkspace } from "./workspace";

export const dynamic = "force-dynamic";

export default async function ContentOsCreatePage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) redirect("/403");
  return <ContentCreationWorkspace canApprove={ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager} />;
}
