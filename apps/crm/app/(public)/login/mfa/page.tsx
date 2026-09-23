import { redirect } from "next/navigation";
import { loadAuthUser } from "@/lib/auth/server";

export const metadata = { title: "Verificação em duas etapas" };

export default async function MfaChallengePage() {
  const user = await loadAuthUser();
  if (!user) redirect("/login");

  // MFA is not required in F4 Firebase auth migration.
  redirect("/app/inbox");
}
