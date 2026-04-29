import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isMfaEnrolled, loadAuthUser, requiresMfa, resolveActiveOrg } from "@/lib/auth/server";
import { AuthProvider } from "@/hooks/auth/AuthProvider";
import { AppShell } from "./_components/AppShell";
import { MfaEnrollGate } from "@/components/auth/MfaEnrollGate";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await loadAuthUser();
  if (!user) redirect("/login");

  const activeOrg = await resolveActiveOrg(user);

  // EPIC-02: gate /app/* on completed onboarding. Cheap targeted SELECT.
  if (activeOrg) {
    const admin = createAdminClient();
    const { data: orgRow } = await admin
      .from("organizations")
      .select("onboarded_at")
      .eq("id", activeOrg.orgId)
      .maybeSingle();
    if (orgRow && !orgRow.onboarded_at) redirect("/onboarding");
  }

  // Read sidebar collapsed state SSR to avoid flash.
  const store = await cookies();
  const collapsed = store.get("sidebar_collapsed")?.value === "1";

  const enrolled = await isMfaEnrolled();
  const mustEnroll = requiresMfa(activeOrg?.role, user.is_platform_admin) && !enrolled;

  return (
    <AuthProvider user={user} activeOrg={activeOrg}>
      {mustEnroll ? <MfaEnrollGate /> : <AppShell sidebarCollapsed={collapsed}>{children}</AppShell>}
    </AuthProvider>
  );
}
