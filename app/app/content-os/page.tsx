import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ContentOsShell } from "@/components/content-os/ContentOsShell";
import { ContentOsOverview } from "./_client";

export const dynamic = "force-dynamic";

export default async function ContentOsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  const canManage = user.is_platform_admin || activeOrg?.role === "manager" || activeOrg?.role === "admin";
  return <ContentOsShell><ContentOsOverview canManage={canManage} /></ContentOsShell>;
}
